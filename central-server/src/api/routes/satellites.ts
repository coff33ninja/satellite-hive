import { Hono } from 'hono';
import { DeviceRegistry } from '../../services/deviceRegistry.js';
import { AuditLogger } from '../../services/auditLogger.js';
import { AgentHub } from '../../ws/agentHub.js';
import { nanoid } from 'nanoid';

export function createSatellitesRouter(
  registry: DeviceRegistry,
  auditLogger: AuditLogger,
  agentHub: AgentHub
) {
  const app = new Hono();

  // List all satellites
  app.get('/', (c) => {
    const satellites = registry.getAllSatellites();
    return c.json({
      success: true,
      data: satellites.map(s => ({
        ...s,
        isOnline: registry.isOnline(s.id),
      })),
    });
  });

  // Get satellite details
  app.get('/:id', (c) => {
    const id = c.req.param('id');
    const satellite = registry.getSatellite(id);

    if (!satellite) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Satellite not found' },
      }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...satellite,
        isOnline: registry.isOnline(id),
      },
    });
  });

  // Execute command on satellite
  app.post('/:id/exec', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    if (!registry.isOnline(id)) {
      return c.json({
        success: false,
        error: { code: 'SATELLITE_OFFLINE', message: 'Satellite is not connected' },
      }, 503);
    }

    const requestId = `req_${nanoid(12)}`;
    const success = agentHub.sendCommand(id, {
      type: 'exec',
      request_id: requestId,
      command: body.command,
      timeout_seconds: body.timeout_seconds || 30,
      env: body.env || {},
    });

    if (!success) {
      return c.json({
        success: false,
        error: { code: 'SEND_FAILED', message: 'Failed to send command' },
      }, 500);
    }

    auditLogger.log({
      actorType: 'user',
      actorId: 'admin', // TODO: Get from JWT
      action: 'exec',
      targetType: 'satellite',
      targetId: id,
      details: { command: body.command },
      result: 'success',
    });

    return c.json({
      success: true,
      data: { request_id: requestId },
    });
  });

  return app;
}
