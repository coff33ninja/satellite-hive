import { readFileSync } from 'fs';
import { parse } from 'yaml';
import type { Config } from './types/index.js';

export function loadConfig(path: string = './server.yaml'): Config {
  const content = readFileSync(path, 'utf-8');
  const config = parse(content) as Config;

  // Environment variable overrides
  if (process.env.JWT_SECRET) {
    config.auth.jwt_secret = process.env.JWT_SECRET;
  }
  if (process.env.DATABASE_URL) {
    config.database.connection = process.env.DATABASE_URL;
  }

  return config;
}
