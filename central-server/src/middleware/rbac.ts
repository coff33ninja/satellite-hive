import type { Context, Next } from 'hono';
import type { User } from '../types/index.js';

export type Permission = 
  | 'satellites:read'
  | 'satellites:write'
  | 'satellites:delete'
  | 'satellites:execute'
  | 'sessions:read'
  | 'sessions:write'
  | 'sessions:delete'
  | 'provision:read'
  | 'provision:write'
  | 'provision:delete'
  | 'audit:read'
  | 'metrics:read'
  | 'users:read'
  | 'users:write'
  | 'users:delete';

export type Role = 'admin' | 'operator' | 'viewer';

// Role-based permissions matrix
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'satellites:read',
    'satellites:write',
    'satellites:delete',
    'satellites:execute',
    'sessions:read',
    'sessions:write',
    'sessions:delete',
    'provision:read',
    'provision:write',
    'provision:delete',
    'audit:read',
    'metrics:read',
    'users:read',
    'users:write',
    'users:delete',
  ],
  operator: [
    'satellites:read',
    'satellites:write',
    'satellites:execute',
    'sessions:read',
    'sessions:write',
    'sessions:delete',
    'provision:read',
    'audit:read',
    'metrics:read',
  ],
  viewer: [
    'satellites:read',
    'sessions:read',
    'audit:read',
    'metrics:read',
  ],
};

export function hasPermission(user: User, permission: Permission): boolean {
  // Check if any of the user's roles grants the permission
  return user.roles.some(role => {
    const permissions = ROLE_PERMISSIONS[role as Role];
    return permissions && permissions.includes(permission);
  });
}

export function requirePermission(permission: Permission) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as User | undefined;

    if (!user) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    if (!hasPermission(user, permission)) {
      return c.json({
        success: false,
        error: 'Insufficient permissions',
        required: permission,
      }, 403);
    }

    await next();
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as User | undefined;

    if (!user) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    const hasAny = permissions.some(p => hasPermission(user, p));

    if (!hasAny) {
      return c.json({
        success: false,
        error: 'Insufficient permissions',
        required_any: permissions,
      }, 403);
    }

    await next();
  };
}

export function requireAllPermissions(...permissions: Permission[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as User | undefined;

    if (!user) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    const hasAll = permissions.every(p => hasPermission(user, p));

    if (!hasAll) {
      return c.json({
        success: false,
        error: 'Insufficient permissions',
        required_all: permissions,
      }, 403);
    }

    await next();
  };
}

export function requireRole(role: Role) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as User | undefined;

    if (!user) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    if (!user.roles.includes(role)) {
      return c.json({
        success: false,
        error: 'Insufficient role',
        required_role: role,
      }, 403);
    }

    await next();
  };
}
