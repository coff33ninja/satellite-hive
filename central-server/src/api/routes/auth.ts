import { Hono } from 'hono';
import { sign } from 'jsonwebtoken';
import { compare } from 'bcryptjs';
import { DB } from '../../db/index.js';
import type { Config } from '../../types/index.js';

export function createAuthRouter(db: DB, config: Config) {
  const app = new Hono();

  app.post('/login', async (c) => {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Email and password required' },
      }, 400);
    }

    const user = db.getUserByEmail(email);
    if (!user || !user.isActive) {
      return c.json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid credentials' },
      }, 401);
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return c.json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid credentials' },
      }, 401);
    }

    const token = sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
      },
      config.auth.jwt_secret,
      { expiresIn: config.auth.jwt_expiration }
    );

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles,
        },
      },
    });
  });

  return app;
}
