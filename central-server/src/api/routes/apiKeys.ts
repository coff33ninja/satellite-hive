import { Hono } from 'hono';
import type { Context } from 'hono';
import type { DB } from '../../db/index.js';
import type { User } from '../../types/index.js';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

export function createApiKeysRouter(db: DB) {
  const app = new Hono();

  // Create new API key
  app.post('/', async (c: Context) => {
    try {
      const user = c.get('user') as User;
      const body = await c.req.json();
      const { name, permissions, expiresInDays } = body;

      if (!name || !permissions || !Array.isArray(permissions)) {
        return c.json({
          success: false,
          error: 'Name and permissions array required',
        }, 400);
      }

      // Generate API key
      const apiKey = `sk_${nanoid(32)}`;
      const keyHash = createHash('sha256').update(apiKey).digest('hex');
      const id = `key_${nanoid(12)}`;

      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      (db as any).db.run(
        `INSERT INTO api_keys (
          id, name, key_hash, user_id, permissions, expires_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          name,
          keyHash,
          user.id,
          JSON.stringify(permissions),
          expiresAt?.toISOString() || null,
          1,
        ]
      );
      (db as any).save();

      return c.json({
        success: true,
        data: {
          id,
          name,
          api_key: apiKey, // Only returned once!
          permissions,
          expires_at: expiresAt,
          message: 'Save this API key securely. It will not be shown again.',
        },
      });
    } catch (error: any) {
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });

  // List API keys (without revealing the actual keys)
  app.get('/', async (c: Context) => {
    try {
      const user = c.get('user') as User;
      const result = (db as any).db.exec(
        'SELECT id, name, permissions, expires_at, last_used_at, is_active, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC',
        [user.id]
      );

      const keys = result.length && result[0].values.length
        ? result[0].values.map((values: any[]) => {
            const obj: any = {};
            result[0].columns.forEach((col: string, i: number) => {
              obj[col] = values[i];
            });
            obj.permissions = JSON.parse(obj.permissions);
            return obj;
          })
        : [];

      return c.json({
        success: true,
        data: keys,
      });
    } catch (error: any) {
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });

  // Revoke API key
  app.delete('/:id', async (c: Context) => {
    try {
      const user = c.get('user') as User;
      const { id } = c.req.param();

      (db as any).db.run(
        'UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?',
        [id, user.id]
      );
      (db as any).save();

      return c.json({
        success: true,
        message: 'API key revoked',
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
