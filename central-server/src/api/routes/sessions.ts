import { Hono } from 'hono';
import { SessionManager } from '../../services/sessionManager.js';
import { DeviceRegistry } from '../../services/deviceRegistry.js';
import { AuditLogger } from '../../services/auditLogger.js';
import { AgentHub } from '../../ws/agentHub.js';
import { nanoid } from 'nanoid';

type Variables = {
  user: {
    id: string;
    email?: string;
    roles: string[];
  };
};

export function createSessionsRouter(
  sessionManager: SessionManager,
  registry: DeviceRegistry,
  auditLogger: AuditLogger,
  agentHub: AgentHub
) {
  const app = new Hono<{ Variables: Variables }>();

  // Create new terminal session
  app.post('/', async (c) => {
    try {
      const body = await c.req.json();
      const user = c.get('user');
      const { satellite_id, cols, rows, shell } = body;

      if (!satellite_id) {
        return c.json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'satellite_id is required',
          },
        }, 400);
      }

      const satellite = registry.getSatellite(satellite_id);
      if (!satellite) {
        return c.json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Satellite ${satellite_id} not found`,
          },
        }, 404);
      }

      if (!registry.isOnline(satellite_id)) {
        return c.json({
          success: false,
          error: {
            code: 'SATELLITE_OFFLINE',
            message: 'Satellite is not connected',
          },
        }, 503);
      }

      // Create session in database
      const session = sessionManager.create({
        satelliteId: satellite_id,
        userId: user.id,
        cols: cols || 120,
        rows: rows || 40,
        shell,
      });

      // Send PTY start command to agent
      const success = agentHub.sendCommand(satellite_id, {
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

      if (!success) {
        // Clean up session if command failed to send
        sessionManager.terminate(session.id, 'send_failed');
        return c.json({
          success: false,
          error: {
            code: 'SEND_FAILED',
            message: 'Failed to start session on satellite',
          },
        }, 500);
      }

      await auditLogger.log({
        actorType: 'user',
        actorId: user.id,
        actorName: user.email || user.id,
        action: 'session_created',
        targetType: 'session',
        targetId: session.id,
        details: { satellite_id, cols, rows, shell },
        result: 'success',
      });

      return c.json({
        success: true,
        data: session,
      }, 201);
    } catch (error) {
      console.error('[API] Error creating session:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create session',
        },
      }, 500);
    }
  });

  // Get session by ID
  app.get('/:id', async (c) => {
    try {
      const { id } = c.req.param();
      
      const session = sessionManager.get(id);
      if (!session) {
        return c.json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Session ${id} not found`,
          },
        }, 404);
      }

      return c.json({
        success: true,
        data: {
          ...session,
          isActive: sessionManager.isActive(id),
        },
      });
    } catch (error) {
      console.error('[API] Error getting session:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get session',
        },
      }, 500);
    }
  });

  // List all sessions (with optional filters)
  app.get('/', async (c) => {
    try {
      const { satellite_id, user_id, status } = c.req.query();
      
      let sessions = sessionManager.list();

      // Filter by satellite
      if (satellite_id) {
        sessions = sessions.filter((s: any) => s.satelliteId === satellite_id);
      }

      // Filter by user
      if (user_id) {
        sessions = sessions.filter((s: any) => s.userId === user_id);
      }

      // Filter by status
      if (status) {
        sessions = sessions.filter((s: any) => s.status === status);
      }

      // Add active status
      const enrichedSessions = sessions.map((s: any) => ({
        ...s,
        isActive: sessionManager.isActive(s.id),
      }));

      return c.json({
        success: true,
        data: enrichedSessions,
        total: enrichedSessions.length,
      });
    } catch (error) {
      console.error('[API] Error listing sessions:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list sessions',
        },
      }, 500);
    }
  });

  // Terminate session
  app.delete('/:id', async (c) => {
    try {
      const { id } = c.req.param();
      const user = c.get('user');
      
      const session = sessionManager.get(id);
      if (!session) {
        return c.json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Session ${id} not found`,
          },
        }, 404);
      }

      // Send PTY end command to agent if still active
      if (sessionManager.isActive(id)) {
        agentHub.sendCommand(session.satelliteId, {
          type: 'pty_end',
          session_id: id,
        });
      }

      // Terminate in database
      sessionManager.terminate(id, 'user_terminated');

      await auditLogger.log({
        actorType: 'user',
        actorId: user.id,
        actorName: user.email || user.id,
        action: 'session_terminated',
        targetType: 'session',
        targetId: id,
        details: { satellite_id: session.satelliteId },
        result: 'success',
      });

      return c.json({
        success: true,
        message: 'Session terminated',
      });
    } catch (error) {
      console.error('[API] Error terminating session:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to terminate session',
        },
      }, 500);
    }
  });

  return app;
}
