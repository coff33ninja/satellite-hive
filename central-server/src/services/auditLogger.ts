import { nanoid } from 'nanoid';
import { DB } from '../db/index.js';

export class AuditLogger {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  log(entry: {
    actorType: 'user' | 'api_key' | 'mcp' | 'system';
    actorId?: string;
    actorName?: string;
    actorIp?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    details?: any;
    result: 'success' | 'failure';
    errorMessage?: string;
  }) {
    this.db.createAuditLog({
      id: `audit_${nanoid(12)}`,
      ...entry,
    });
  }
}
