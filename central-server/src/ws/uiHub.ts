import { WebSocket } from 'ws';
import { verify } from 'jsonwebtoken';
import { DeviceRegistry } from '../services/deviceRegistry.js';
import { SessionManager } from '../services/sessionManager.js';
import { AgentHub } from './agentHub.js';
import type { Config } from '../types/index.js';
import { nanoid } from 'nanoid';

export class UIHub {
  private registry: DeviceRegistry;
  private sessionManager: SessionManager;
  private agentHub: AgentHub;
  private config: Config;

  constructor(
    registry: DeviceRegistry,
    sessionManager: SessionManager,
    agentHub: AgentHub,
    config: Config
  ) {
    this.registry = registry;
    this.sessionManager = sessionManager;
    this.agentHub = agentHub;
    this.config = config;
  }

  handleConnection(ws: WebSocket, token: string) {
    let userId: string | undefined;

    try {
      const decoded = verify(token, this.config.auth.jwt_secret) as any;
      userId = decoded.sub;
    } catch (error) {
      ws.send(JSON.stringify({
        event: 'error',
        error: { code: 'AUTH_FAILED', message: 'Invalid token' },
      }));
      ws.close();
      return;
    }

    // Register with agent hub for broadcasts
    this.agentHub.registerUIConnection(ws);

    // Send initial state
    const satellites = this.registry.getAllSatellites();
    ws.send(JSON.stringify({
      event: 'initial_state',
      data: {
        satellites: satellites.map(s => ({
          ...s,
          isOnline: this.registry.isOnline(s.id),
        })),
      },
    }));

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleUIMessage(userId!, message, ws);
      } catch (error) {
        console.error('[UIHub] Error handling message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`[UIHub] UI disconnected: ${userId}`);
    });
  }

  private handleUIMessage(userId: string, message: any, ws: WebSocket) {
    const { action, request_id, data } = message;

    switch (action) {
      case 'session:create':
        this.handleCreateSession(userId, data, request_id, ws);
        break;

      case 'session:input':
        this.handleSessionInput(data);
        break;

      case 'session:resize':
        this.handleSessionResize(data);
        break;

      case 'session:close':
        this.handleCloseSession(data);
        break;

      default:
        console.log(`[UIHub] Unknown action: ${action}`);
    }
  }

  private handleCreateSession(userId: string, data: any, requestId: string, ws: WebSocket) {
    const { satellite_id, cols, rows, shell } = data;

    if (!this.registry.isOnline(satellite_id)) {
      ws.send(JSON.stringify({
        event: 'action:result',
        request_id: requestId,
        success: false,
        error: { code: 'SATELLITE_OFFLINE', message: 'Satellite is not connected' },
      }));
      return;
    }

    // Create session in database
    const session = this.sessionManager.create({
      satelliteId: satellite_id,
      userId,
      cols: cols || 120,
      rows: rows || 40,
      shell,
    });

    // Send PTY start command to agent
    const success = this.agentHub.sendCommand(satellite_id, {
      type: 'pty_start',
      request_id: `req_${nanoid(12)}`,
      session_id: session.id,
      shell,
      cols: session.cols,
      rows: session.rows,
      env: {
        TERM: 'xterm-256color',
        LANG: 'en_US.UTF-8',
      },
    });

    if (success) {
      ws.send(JSON.stringify({
        event: 'action:result',
        request_id: requestId,
        success: true,
        data: { session_id: session.id },
      }));
    } else {
      ws.send(JSON.stringify({
        event: 'action:result',
        request_id: requestId,
        success: false,
        error: { code: 'SEND_FAILED', message: 'Failed to start session' },
      }));
    }
  }

  private handleSessionInput(data: any) {
    const { session_id, input } = data;
    const session = this.sessionManager.get(session_id);

    if (!session || !this.sessionManager.isActive(session_id)) {
      return;
    }

    this.agentHub.sendCommand(session.satelliteId, {
      type: 'pty_input',
      session_id,
      data: input,
    });
  }

  private handleSessionResize(data: any) {
    const { session_id, cols, rows } = data;
    const session = this.sessionManager.get(session_id);

    if (!session || !this.sessionManager.isActive(session_id)) {
      return;
    }

    this.agentHub.sendCommand(session.satelliteId, {
      type: 'pty_resize',
      session_id,
      cols,
      rows,
    });
  }

  private handleCloseSession(data: any) {
    const { session_id } = data;
    const session = this.sessionManager.get(session_id);

    if (!session) {
      return;
    }

    this.agentHub.sendCommand(session.satelliteId, {
      type: 'pty_end',
      session_id,
    });

    this.sessionManager.terminate(session_id, 'user_terminated');
  }
}
