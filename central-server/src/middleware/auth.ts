import { Context, Next } from 'hono';
import { verify } from 'jsonwebtoken';
import type { Config } from '../types/index.js';

export function createAuthMiddleware(config: Config) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    const apiKey = c.req.header('X-API-Key');

    // Check API key
    if (apiKey) {
      if (apiKey === config.auth.admin_api_key) {
        c.set('user', { id: 'api', roles: ['admin'] });
        return next();
      }
      return c.json({
        success: false,
        error: { code: 'AUTH_INVALID', message: 'Invalid API key' },
      }, 401);
    }

    // Check JWT
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' },
      }, 401);
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verify(token, config.auth.jwt_secret) as any;
      c.set('user', decoded);
      return next();
    } catch (error) {
      return c.json({
        success: false,
        error: { code: 'AUTH_INVALID', message: 'Invalid or expired token' },
      }, 401);
    }
  };
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user || !user.roles) {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      }, 403);
    }

    const hasRole = roles.some(role => user.roles.includes(role));
    if (!hasRole) {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      }, 403);
    }

    return next();
  };
}
