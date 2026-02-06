import type { Context, Next } from 'hono';
import type { DB } from '../db/index.js';
import { createHash } from 'crypto';

export function createApiKeyMiddleware(db: DB) {
  return async (c: Context, next: Next) => {
    const apiKey = c.req.header('X-API-Key');

    if (!apiKey) {
      return await next(); // Let JWT auth handle it
    }

    if (!apiKey.startsWith('sk_')) {
      return c.json({
        success: false,
        error: 'Invalid API key format',
      }, 401);
    }

    try {
      const keyHash = createHash('sha256').update(apiKey).digest('hex');
      const result = (db as any).db.exec(
        `SELECT k.*, u.id as user_id, u.email, u.roles, u.is_active as user_active
         FROM api_keys k
         JOIN users u ON k.user_id = u.id
         WHERE k.key_hash = ? AND k.is_active = 1`,
        [keyHash]
      );

      if (!result.length || !result[0].values.length) {
        return c.json({
          success: false,
          error: 'Invalid API key',
        }, 401);
      }

      const row: any = {};
      result[0].columns.forEach((col: string, i: number) => {
        row[col] = result[0].values[0][i];
      });

      // Check if key is expired
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        return c.json({
          success: false,
          error: 'API key expired',
        }, 401);
      }

      // Check if user is active
      if (row.user_active !== 1) {
        return c.json({
          success: false,
          error: 'User account is inactive',
        }, 401);
      }

      // Update last used timestamp
      (db as any).db.run(
        'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
        [row.id]
      );
      (db as any).save();

      // Set user context
      c.set('user', {
        id: row.user_id,
        email: row.email,
        roles: JSON.parse(row.roles),
        isActive: row.user_active === 1,
        passwordHash: '', // Not needed for API key auth
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Set API key permissions
      c.set('apiKeyPermissions', JSON.parse(row.permissions));

      await next();
    } catch (error: any) {
      return c.json({
        success: false,
        error: 'Authentication failed',
      }, 500);
    }
  };
}
