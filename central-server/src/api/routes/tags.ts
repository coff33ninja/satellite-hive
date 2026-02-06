import { Hono } from 'hono';
import type { Context } from 'hono';
import type { DeviceRegistry } from '../../services/deviceRegistry.js';
import type { AuditLogger } from '../../services/auditLogger.js';

export function createTagsRouter(registry: DeviceRegistry, auditLogger: AuditLogger) {
  const app = new Hono();

  // Get all tags with satellite counts
  app.get('/', async (c: Context) => {
    try {
      const satellites = registry.getAllSatellites();
      const tagCounts: Record<string, number> = {};
      
      satellites.forEach(s => {
        s.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      const tags = Object.entries(tagCounts).map(([name, count]) => ({
        name,
        count,
      }));

      return c.json({
        success: true,
        data: tags,
      });
    } catch (error: any) {
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });

  // Get satellites by tag
  app.get('/:tag/satellites', async (c: Context) => {
    try {
      const { tag } = c.req.param();
      const satellites = registry.getAllSatellites()
        .filter(s => s.tags.includes(tag))
        .map(s => ({
          id: s.id,
          name: s.name,
          hostname: s.hostname,
          os: s.os,
          status: registry.isOnline(s.id) ? 'online' : 'offline',
          tags: s.tags,
          lastSeen: s.lastSeen,
        }));

      return c.json({
        success: true,
        data: satellites,
      });
    } catch (error: any) {
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });

  return app;
}
