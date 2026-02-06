import { Hono } from 'hono';
import type { Context } from 'hono';
import type { DB } from '../../db/index.js';

export function createAuditRouter(db: DB) {
  const app = new Hono();

  // Query audit logs with filtering
  app.get('/logs', async (c: Context) => {
    try {
      const query = c.req.query();
      const limit = parseInt(query.limit || '100');
      const offset = parseInt(query.offset || '0');
      const actor = query.actor;
      const action = query.action;
      const target = query.target;
      const startDate = query.start_date;
      const endDate = query.end_date;

      let sql = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];

      if (actor) {
        sql += ' AND actor = ?';
        params.push(actor);
      }

      if (action) {
        sql += ' AND action = ?';
        params.push(action);
      }

      if (target) {
        sql += ' AND target LIKE ?';
        params.push(`%${target}%`);
      }

      if (startDate) {
        sql += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        sql += ' AND timestamp <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = (db as any).db.exec(sql, params);
      const logs = result.length && result[0].values.length
        ? result[0].values.map((values: any[]) => {
            const obj: any = {};
            result[0].columns.forEach((col: string, i: number) => {
              obj[col] = values[i];
            });
            return obj;
          })
        : [];

      // Get total count for pagination
      let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
      const countParams: any[] = [];

      if (actor) {
        countSql += ' AND actor = ?';
        countParams.push(actor);
      }

      if (action) {
        countSql += ' AND action = ?';
        countParams.push(action);
      }

      if (target) {
        countSql += ' AND target LIKE ?';
        countParams.push(`%${target}%`);
      }

      if (startDate) {
        countSql += ' AND timestamp >= ?';
        countParams.push(startDate);
      }

      if (endDate) {
        countSql += ' AND timestamp <= ?';
        countParams.push(endDate);
      }

      const countResult = (db as any).db.exec(countSql, countParams);
      const total = countResult.length && countResult[0].values.length
        ? countResult[0].values[0][0]
        : 0;

      return c.json({
        success: true,
        data: logs,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + logs.length < total,
        },
      });
    } catch (error: any) {
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });

  // Get specific audit log entry
  app.get('/logs/:id', async (c: Context) => {
    try {
      const { id } = c.req.param();
      const result = (db as any).db.exec('SELECT * FROM audit_logs WHERE id = ?', [id]);

      if (!result.length || !result[0].values.length) {
        return c.json({
          success: false,
          error: 'Audit log not found',
        }, 404);
      }

      const log: any = {};
      result[0].columns.forEach((col: string, i: number) => {
        log[col] = result[0].values[0][i];
      });

      return c.json({
        success: true,
        data: log,
      });
    } catch (error: any) {
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });

  // Get audit statistics
  app.get('/stats', async (c: Context) => {
    try {
      const query = c.req.query();
      const days = parseInt(query.days || '7');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Actions by type
      const actionResult = (db as any).db.exec(`
        SELECT action, COUNT(*) as count
        FROM audit_logs
        WHERE timestamp >= ?
        GROUP BY action
        ORDER BY count DESC
      `, [startDate.toISOString()]);
      
      const actionStats = actionResult.length && actionResult[0].values.length
        ? actionResult[0].values.map((v: any[]) => ({ action: v[0], count: v[1] }))
        : [];

      // Actions by actor
      const actorResult = (db as any).db.exec(`
        SELECT actor_name, COUNT(*) as count
        FROM audit_logs
        WHERE timestamp >= ?
        GROUP BY actor_name
        ORDER BY count DESC
        LIMIT 10
      `, [startDate.toISOString()]);
      
      const actorStats = actorResult.length && actorResult[0].values.length
        ? actorResult[0].values.map((v: any[]) => ({ actor: v[0], count: v[1] }))
        : [];

      // Actions over time (daily)
      const timelineResult = (db as any).db.exec(`
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM audit_logs
        WHERE timestamp >= ?
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      `, [startDate.toISOString()]);
      
      const timelineStats = timelineResult.length && timelineResult[0].values.length
        ? timelineResult[0].values.map((v: any[]) => ({ date: v[0], count: v[1] }))
        : [];

      return c.json({
        success: true,
        data: {
          period_days: days,
          by_action: actionStats,
          by_actor: actorStats,
          timeline: timelineStats,
        },
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
