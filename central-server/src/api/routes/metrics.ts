import { Hono } from 'hono';
import type { Context } from 'hono';
import type { MetricsCollector } from '../../services/metricsCollector.js';
import type { DeviceRegistry } from '../../services/deviceRegistry.js';

export function createMetricsRouter(
  metricsCollector: MetricsCollector,
  registry: DeviceRegistry
) {
  const app = new Hono();

  // Get latest metrics for a satellite
  app.get('/satellites/:id/latest', async (c: Context) => {
    try {
      const { id } = c.req.param();
      const satellite = registry.getSatellite(id);

      if (!satellite) {
        return c.json({
          success: false,
          error: 'Satellite not found',
        }, 404);
      }

      const metrics = metricsCollector.getLatestMetrics(id);

      return c.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });

  // Get metrics history for a satellite
  app.get('/satellites/:id/history', async (c: Context) => {
    try {
      const { id } = c.req.param();
      const query = c.req.query();
      const hours = parseInt(query.hours || '24');
      const limit = parseInt(query.limit || '100');

      const satellite = registry.getSatellite(id);

      if (!satellite) {
        return c.json({
          success: false,
          error: 'Satellite not found',
        }, 404);
      }

      const history = metricsCollector.getMetricsHistory(id, hours, limit);

      return c.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });

  // Get aggregated metrics for a satellite
  app.get('/satellites/:id/aggregated', async (c: Context) => {
    try {
      const { id } = c.req.param();
      const query = c.req.query();
      const hours = parseInt(query.hours || '24');

      const satellite = registry.getSatellite(id);

      if (!satellite) {
        return c.json({
          success: false,
          error: 'Satellite not found',
        }, 404);
      }

      const aggregated = metricsCollector.getAggregatedMetrics(id, hours);

      return c.json({
        success: true,
        data: aggregated,
      });
    } catch (error: any) {
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });

  // Get fleet-wide metrics summary
  app.get('/fleet/summary', async (c: Context) => {
    try {
      const satellites = registry.getAllSatellites();
      const summary = {
        total_satellites: satellites.length,
        online_satellites: satellites.filter(s => registry.isOnline(s.id)).length,
        metrics: [] as any[],
      };

      // Get latest metrics for each online satellite
      for (const satellite of satellites) {
        if (registry.isOnline(satellite.id)) {
          const metrics = metricsCollector.getLatestMetrics(satellite.id);
          if (metrics) {
            summary.metrics.push({
              satellite_id: satellite.id,
              satellite_name: satellite.name,
              ...metrics,
            });
          }
        }
      }

      return c.json({
        success: true,
        data: summary,
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
