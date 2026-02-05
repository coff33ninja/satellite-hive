import { Hono } from 'hono';
import { DB } from '../../db/index.js';

export function createHealthRouter(db: DB) {
  const app = new Hono();

  // Basic health check
  app.get('/', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Readiness check (can accept traffic)
  app.get('/ready', async (c) => {
    try {
      // Check database connectivity
      db.getAllSatellites();
      
      return c.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
        },
      });
    } catch (error) {
      return c.json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
        },
        error: (error as Error).message,
      }, 503);
    }
  });

  // Liveness check (process is running)
  app.get('/live', (c) => {
    return c.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memory: process.memoryUsage(),
    });
  });

  return app;
}
