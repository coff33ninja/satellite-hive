import { z } from 'zod';

// Command execution validation
export const executeCommandSchema = z.object({
  command: z.string()
    .min(1, 'Command cannot be empty')
    .max(10000, 'Command too long')
    .refine(
      (cmd) => !cmd.includes('\0'),
      'Command contains null bytes'
    ),
  timeout_seconds: z.number()
    .int()
    .min(1)
    .max(3600)
    .optional()
    .default(30),
});

// Terminal session creation
export const createTerminalSchema = z.object({
  satellite_id: z.string().regex(/^sat_[a-zA-Z0-9]+$/),
  shell: z.string().max(255).optional(),
  cols: z.number().int().min(20).max(500).optional().default(80),
  rows: z.number().int().min(10).max(200).optional().default(24),
});

// Provision token creation
export const createProvisionTokenSchema = z.object({
  name: z.string().min(1).max(255),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  platform: z.enum(['linux', 'windows', 'darwin']),
  expires_in_hours: z.number().int().min(1).max(8760).optional().default(48),
});

// API key creation
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(z.string()).min(1).max(50),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

// Satellite update
export const updateSatelliteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// User login
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password required'),
});

// Query parameters validation
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const auditQuerySchema = paginationSchema.extend({
  actor: z.string().max(255).optional(),
  action: z.string().max(100).optional(),
  target: z.string().max(255).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export const metricsQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(720).optional().default(24),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
});

// Validation helper
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (body: unknown): Promise<{ success: true; data: T } | { success: false; error: string }> => {
    try {
      const data = schema.parse(body);
      return { success: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        return { success: false, error: messages.join(', ') };
      }
      return { success: false, error: 'Validation failed' };
    }
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (query: unknown): { success: true; data: T } | { success: false; error: string } => {
    try {
      const data = schema.parse(query);
      return { success: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        return { success: false, error: messages.join(', ') };
      }
      return { success: false, error: 'Validation failed' };
    }
  };
}
