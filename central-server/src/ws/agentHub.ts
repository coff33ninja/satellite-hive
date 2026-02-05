import { WebSocket } from 'ws';
import type { WebSocket as WSWebSocket } from 'ws';
import { DeviceRegistry } from '../services/deviceRegistry.js';
import { SessionManager } from '../services/sessionManager.js';
import { AuditLogger } from '../services/auditLogger.js';
import type { Config } from '../types/index.js';

export class AgentHub {
  private registry: DeviceRegistry;
  private sessionManager: SessionManager;
  private auditLogger: AuditLogger;
  private config: Config;
  private heartbeatIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    registry: DeviceRegistry,
    sessionManager: SessionManager,
    auditLogger: AuditLogger,
    config: Config
  ) {
    this.registry = registry;
    this.sessionManager = sessionManager;
    this.auditLogger = auditLogger;
    this.config = config;
  }

  handleConnection(ws: WSWebSocket) {
    let satelliteId: string | undefined;
    let authenticated = false;

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'handshake' && !authenticated) {
          // Handle handshake
          console.log('[AgentHub] Received handshake:', JSON.stringify(message, null, 2));
          
          const result = await this.registry.register({
            agentId: message.agent_id,
            token: message.token,
            name: message.name,
            version: message.version,
            systemInfo: message.system,
            capabilities: message.capabilities || [],
            tags: message.tags || [],
          });

          satelliteId = result.satellite.id;
          authenticated = true;

          this.registry.setConnection(satelliteId, ws);

          // Send handshake acknowledgment with agent ID
          ws.send(JSON.stringify({
            type: 'handshake_ack',
            success: true,
            agent_id: satelliteId,
            server_time: new Date().toISOString(),
            heartbeat_interval: 30,
          }));

          // Start heartbeat
          this.startHeartbeat(satelliteId, ws);

          this.auditLogger.log({
            actorType: 'system',
            action: 'satellite_connected',
            targetType: 'satellite',
            targetId: satelliteId,
            targetName: result.satellite.name,
            result: 'success',
          });

          console.log(`[AgentHub] Satellite ${satelliteId} connected`);
        } else if (authenticated && satelliteId) {
          // Handle other message types
          this.handleAgentMessage(satelliteId, message, ws);
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            error: { code: 'AUTH_REQUIRED', message: 'Handshake required' },
          }));
        }
      } catch (error) {
        console.error('[AgentHub] Error handling message:', error);
        console.error('[AgentHub] Error stack:', (error as Error).stack);
        ws.send(JSON.stringify({
          type: 'error',
          error: { code: 'INTERNAL_ERROR', message: 'Failed to process message' },
        }));
      }
    });

    ws.on('close', () => {
      if (satelliteId) {
        this.registry.removeConnection(satelliteId);
        this.stopHeartbeat(satelliteId);
        console.log(`[AgentHub] Satellite ${satelliteId} disconnected`);

        this.auditLogger.log({
          actorType: 'system',
          action: 'satellite_disconnected',
          targetType: 'satellite',
          targetId: satelliteId,
          result: 'success',
        });
      }
    });

    ws.on('error', (error) => {
      console.error('[AgentHub] WebSocket error:', error);
    });
  }

  private handleAgentMessage(satelliteId: string, message: any, ws: WSWebSocket) {
    switch (message.type) {
      case 'heartbeat_pong':
        // Update last seen
        this.registry.getSatellite(satelliteId);
        break;

      case 'exec_result':
        // Command execution result
        console.log(`[AgentHub] Exec result from ${satelliteId}:`, {
          request_id: message.request_id,
          exit_code: message.exit_code,
          success: message.success,
        });
        // Store result for retrieval
        this.storeCommandResult(message.request_id, message);
        break;

      case 'pty_started':
        console.log(`[AgentHub] PTY started: ${message.session_id}`);
        break;

      case 'pty_output':
        // Terminal output - forward to UI
        if (message.session_id) {
          const data = Buffer.from(message.data, 'base64');
          this.sessionManager.addOutput(message.session_id, data);
          this.broadcastToUI({
            event: 'session:output',
            data: {
              session_id: message.session_id,
              output: message.data,
            },
          });
        }
        break;

      case 'pty_ended':
        // Terminal session ended
        if (message.session_id) {
          this.sessionManager.terminate(
            message.session_id,
            message.reason || 'exited',
            message.exit_code
          );
          this.broadcastToUI({
            event: 'session:ended',
            data: {
              session_id: message.session_id,
              reason: message.reason,
              exit_code: message.exit_code,
            },
          });
        }
        break;

      case 'error':
        console.error(`[AgentHub] Error from ${satelliteId}:`, message.error);
        break;

      default:
        console.log(`[AgentHub] Unknown message type: ${message.type}`);
    }
  }

  private commandResults = new Map<string, any>();

  private storeCommandResult(requestId: string, result: any) {
    this.commandResults.set(requestId, result);
    // Clean up after 5 minutes
    setTimeout(() => this.commandResults.delete(requestId), 5 * 60 * 1000);
  }

  getCommandResult(requestId: string): any {
    return this.commandResults.get(requestId);
  }

  private uiConnections = new Set<WSWebSocket>();

  registerUIConnection(ws: WSWebSocket) {
    this.uiConnections.add(ws);
    ws.on('close', () => this.uiConnections.delete(ws));
  }

  private broadcastToUI(message: any) {
    const data = JSON.stringify(message);
    for (const ws of this.uiConnections) {
      if (ws.readyState === 1) { // OPEN
        ws.send(data);
      }
    }
  }

  private startHeartbeat(satelliteId: string, ws: WSWebSocket) {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'heartbeat_ping',
          timestamp: new Date().toISOString(),
        }));
      }
    }, 30000); // 30 seconds

    this.heartbeatIntervals.set(satelliteId, interval);
  }

  private stopHeartbeat(satelliteId: string) {
    const interval = this.heartbeatIntervals.get(satelliteId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(satelliteId);
    }
  }

  // Send command to satellite
  sendCommand(satelliteId: string, command: any): boolean {
    const ws = this.registry.getConnection(satelliteId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    ws.send(JSON.stringify(command));
    return true;
  }
}
