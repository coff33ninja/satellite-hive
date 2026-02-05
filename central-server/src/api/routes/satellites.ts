import { Hono, Context } from 'hono';
import { DeviceRegistry } from '../../services/deviceRegistry.js';
import { AuditLogger } from '../../services/auditLogger.js';
import { AgentHub } from '../../ws/agentHub.js';

interface User {
  id: string;
  email?: string;
  roles: string[];
}

type Variables = {
  user: User;
};

export function createSatellitesRouter(
  registry: DeviceRegistry,
  auditLogger: AuditLogger,
  agentHub: AgentHub
) {
  const app = new Hono<{ Variables: Variables }>();

  // List all satellites
  app.get('/', async (c) => {
    try {
      const { status, tags, search, limit = '50' } = c.req.query();
      
      let satellites = registry.getAllSatellites();

      // Filter by status
      if (status && status !== 'all') {
        satellites = satellites.filter(s => s.status === status);
      }

      // Filter by tags
      if (tags) {
        const tagList = tags.split(',').map(t => t.trim());
        satellites = satellites.filter(s => 
          tagList.every(tag => s.tags.includes(tag))
        );
      }

      // Search by name or hostname
      if (search) {
        const searchLower = search.toLowerCase();
        satellites = satellites.filter(s => 
          s.name.toLowerCase().includes(searchLower) ||
          s.hostname?.toLowerCase().includes(searchLower)
        );
      }

      // Limit results
      const limitNum = parseInt(limit, 10);
      if (limitNum > 0) {
        satellites = satellites.slice(0, limitNum);
      }

      // Add online status from registry
      const enrichedSatellites = satellites.map(s => ({
        ...s,
        isOnline: registry.isOnline(s.id),
      }));

      return c.json({
        success: true,
        data: enrichedSatellites,
        total: enrichedSatellites.length,
      });
    } catch (error) {
      console.error('[API] Error listing satellites:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list satellites',
        },
      }, 500);
    }
  });

  // Get single satellite
  app.get('/:id', async (c) => {
    try {
      const { id } = c.req.param();
      
      const satellite = registry.getSatellite(id);
      if (!satellite) {
        return c.json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Satellite ${id} not found`,
          },
        }, 404);
      }

      // Add online status
      const enrichedSatellite = {
        ...satellite,
        isOnline: registry.isOnline(id),
      };

      return c.json({
        success: true,
        data: enrichedSatellite,
      });
    } catch (error) {
      console.error('[API] Error getting satellite:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get satellite',
        },
      }, 500);
    }
  });

  // Update satellite
  app.put('/:id', async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json();
      const user = c.get('user');

      const satellite = registry.getSatellite(id);
      if (!satellite) {
        return c.json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Satellite ${id} not found`,
          },
        }, 404);
      }

      // Update allowed fields
      const updates: any = {};
      if (body.name) updates.name = body.name;
      if (body.tags) updates.tags = body.tags;

      // TODO: Implement update in database
      // For now, just return success
      
      await auditLogger.log({
        actorType: 'user',
        actorId: user.id,
        actorName: user.email || user.id,
        action: 'satellite_updated',
        targetType: 'satellite',
        targetId: id,
        targetName: satellite.name,
        details: updates,
        result: 'success',
      });

      return c.json({
        success: true,
        data: { ...satellite, ...updates },
      });
    } catch (error) {
      console.error('[API] Error updating satellite:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update satellite',
        },
      }, 500);
    }
  });

  // Delete satellite
  app.delete('/:id', async (c) => {
    try {
      const { id } = c.req.param();
      const user = c.get('user');

      const satellite = registry.getSatellite(id);
      if (!satellite) {
        return c.json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Satellite ${id} not found`,
          },
        }, 404);
      }

      // TODO: Implement soft delete in database
      // For now, just disconnect if online
      if (registry.isOnline(id)) {
        const ws = registry.getConnection(id);
        ws?.close();
      }

      await auditLogger.log({
        actorType: 'user',
        actorId: user.id,
        actorName: user.email || user.id,
        action: 'satellite_deleted',
        targetType: 'satellite',
        targetId: id,
        targetName: satellite.name,
        result: 'success',
      });

      return c.json({
        success: true,
        message: 'Satellite deleted',
      });
    } catch (error) {
      console.error('[API] Error deleting satellite:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete satellite',
        },
      }, 500);
    }
  });

  // Execute command on satellite
  app.post('/:id/exec', async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json();
      const user = c.get('user');

      const satellite = registry.getSatellite(id);
      if (!satellite) {
        return c.json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Satellite ${id} not found`,
          },
        }, 404);
      }

      if (!registry.isOnline(id)) {
        return c.json({
          success: false,
          error: {
            code: 'SATELLITE_OFFLINE',
            message: 'Satellite is not connected',
          },
        }, 503);
      }

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const command = {
        type: 'exec',
        request_id: requestId,
        command: body.command,
        timeout_seconds: body.timeout_seconds || 30,
        env: body.env || {},
      };

      const sent = agentHub.sendCommand(id, command);
      if (!sent) {
        return c.json({
          success: false,
          error: {
            code: 'SEND_FAILED',
            message: 'Failed to send command to satellite',
          },
        }, 500);
      }

      await auditLogger.log({
        actorType: 'user',
        actorId: user.id,
        actorName: user.email || user.id,
        action: 'exec',
        targetType: 'satellite',
        targetId: id,
        targetName: satellite.name,
        details: { command: body.command },
        result: 'success',
      });

      // Wait for result (with timeout)
      const timeout = (body.timeout_seconds || 30) * 1000 + 5000; // Add 5s buffer
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        const result = agentHub.getCommandResult(requestId);
        if (result) {
          return c.json({
            success: true,
            data: result,
          });
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return c.json({
        success: false,
        error: {
          code: 'COMMAND_TIMEOUT',
          message: 'Command execution timed out',
        },
      }, 504);
    } catch (error) {
      console.error('[API] Error executing command:', error);
      return c.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to execute command',
        },
      }, 500);
    }
  });

  return app;
}
