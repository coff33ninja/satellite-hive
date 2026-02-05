import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { initializeDatabase } from './schema.js';
import type { User, Satellite, Session } from '../types/index.js';

export class DB {
  private db: SqlJsDatabase;
  private dbPath: string;

  constructor(path: string) {
    this.dbPath = path;
    // Constructor is now synchronous wrapper - actual init happens in static create()
    throw new Error('Use DB.create() instead of new DB()');
  }

  static async create(path: string): Promise<DB> {
    const SQL = await initSqlJs();
    const instance = Object.create(DB.prototype);
    instance.dbPath = path;
    
    // Ensure directory exists
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    if (existsSync(path)) {
      const buffer = readFileSync(path);
      instance.db = new SQL.Database(buffer);
    } else {
      instance.db = new SQL.Database();
    }
    
    initializeDatabase(instance.db);
    instance.save();
    return instance;
  }

  private save() {
    const data = this.db.export();
    writeFileSync(this.dbPath, data);
  }

  // Users
  createUser(user: Omit<User, 'createdAt' | 'updatedAt'>) {
    this.db.run(`
      INSERT INTO users (id, email, password_hash, roles, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [user.id, user.email, user.passwordHash, JSON.stringify(user.roles), user.isActive ? 1 : 0]);
    this.save();
  }

  getUserByEmail(email: string): User | undefined {
    const result = this.db.exec('SELECT * FROM users WHERE email = ?', [email]);
    if (!result.length || !result[0].values.length) return undefined;
    const row = this.rowToObject(result[0].columns, result[0].values[0]);
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      roles: JSON.parse(row.roles),
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  getUserById(id: string): User | undefined {
    const result = this.db.exec('SELECT * FROM users WHERE id = ?', [id]);
    if (!result.length || !result[0].values.length) return undefined;
    const row = this.rowToObject(result[0].columns, result[0].values[0]);
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      roles: JSON.parse(row.roles),
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private rowToObject(columns: string[], values: any[]): any {
    const obj: any = {};
    columns.forEach((col, i) => {
      obj[col] = values[i];
    });
    return obj;
  }

  // Satellites
  createSatellite(satellite: Omit<Satellite, 'createdAt' | 'updatedAt' | 'tags'>) {
    // Log all values to debug
    console.log('[DB] Creating satellite with values:', {
      id: satellite.id,
      name: satellite.name,
      tokenHash: satellite.tokenHash,
      status: satellite.status,
      hostname: satellite.hostname,
      os: satellite.os,
      osVersion: satellite.osVersion,
      arch: satellite.arch,
      lastIp: satellite.lastIp,
      lastSeen: satellite.lastSeen,
      firstSeen: satellite.firstSeen,
      agentVersion: satellite.agentVersion,
    });
    
    this.db.run(`
      INSERT INTO satellites (
        id, name, token_hash, status, system_info, hostname, os, os_version, arch,
        last_ip, last_seen, first_seen, agent_version, capabilities
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      satellite.id,
      satellite.name,
      satellite.tokenHash,
      satellite.status,
      satellite.systemInfo ? JSON.stringify(satellite.systemInfo) : null,
      satellite.hostname,
      satellite.os,
      satellite.osVersion,
      satellite.arch,
      satellite.lastIp || null,
      satellite.lastSeen?.toISOString() || null,
      satellite.firstSeen.toISOString(),
      satellite.agentVersion,
      JSON.stringify(satellite.capabilities)
    ]);
    this.save();
  }

  getSatelliteById(id: string): Satellite | undefined {
    const result = this.db.exec('SELECT * FROM satellites WHERE id = ?', [id]);
    if (!result.length || !result[0].values.length) return undefined;
    const row = this.rowToObject(result[0].columns, result[0].values[0]);
    const tags = this.getSatelliteTags(id);
    return this.rowToSatellite(row, tags);
  }

  getAllSatellites(): Satellite[] {
    const result = this.db.exec('SELECT * FROM satellites ORDER BY name');
    if (!result.length) return [];
    return result[0].values.map(values => {
      const row = this.rowToObject(result[0].columns, values);
      const tags = this.getSatelliteTags(row.id);
      return this.rowToSatellite(row, tags);
    });
  }

  updateSatelliteStatus(id: string, status: 'online' | 'offline', lastSeen?: Date, lastIp?: string) {
    this.db.run(`
      UPDATE satellites 
      SET status = ?, last_seen = ?, last_ip = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, lastSeen?.toISOString() || null, lastIp || null, id]);
    this.save();
  }

  private rowToSatellite(row: any, tags: string[]): Satellite {
    return {
      id: row.id,
      name: row.name,
      tokenHash: row.token_hash,
      status: row.status,
      systemInfo: row.system_info ? JSON.parse(row.system_info) : undefined,
      hostname: row.hostname,
      os: row.os,
      osVersion: row.os_version,
      arch: row.arch,
      lastIp: row.last_ip,
      lastSeen: row.last_seen ? new Date(row.last_seen) : undefined,
      firstSeen: new Date(row.first_seen),
      agentVersion: row.agent_version,
      capabilities: JSON.parse(row.capabilities || '[]'),
      tags,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // Tags
  getSatelliteTags(satelliteId: string): string[] {
    const result = this.db.exec('SELECT tag FROM satellite_tags WHERE satellite_id = ?', [satelliteId]);
    if (!result.length) return [];
    return result[0].values.map(v => v[0] as string);
  }

  addSatelliteTag(satelliteId: string, tag: string) {
    this.db.run('INSERT OR IGNORE INTO satellite_tags (satellite_id, tag) VALUES (?, ?)', [satelliteId, tag]);
    this.save();
  }

  // Sessions
  createSession(session: Omit<Session, 'createdAt' | 'endedAt' | 'endReason' | 'exitCode'>) {
    this.db.run(`
      INSERT INTO sessions (id, satellite_id, user_id, status, cols, rows, shell)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [session.id, session.satelliteId, session.userId, session.status, session.cols, session.rows, session.shell]);
    this.save();
  }

  getSessionById(id: string): Session | undefined {
    const result = this.db.exec('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!result.length || !result[0].values.length) return undefined;
    const row = this.rowToObject(result[0].columns, result[0].values[0]);
    return this.rowToSession(row);
  }

  updateSessionStatus(id: string, status: 'ended' | 'error', endReason?: string, exitCode?: number) {
    this.db.run(`
      UPDATE sessions 
      SET status = ?, ended_at = CURRENT_TIMESTAMP, end_reason = ?, exit_code = ?
      WHERE id = ?
    `, [status, endReason, exitCode, id]);
    this.save();
  }

  private rowToSession(row: any): Session {
    return {
      id: row.id,
      satelliteId: row.satellite_id,
      userId: row.user_id,
      status: row.status,
      cols: row.cols,
      rows: row.rows,
      shell: row.shell,
      createdAt: new Date(row.created_at),
      endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
      endReason: row.end_reason,
      exitCode: row.exit_code,
    };
  }

  // Audit logs
  createAuditLog(log: {
    id: string;
    actorType: string;
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
    this.db.run(`
      INSERT INTO audit_logs (
        id, actor_type, actor_id, actor_name, actor_ip, action,
        target_type, target_id, target_name, details, result, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      log.id,
      log.actorType,
      log.actorId,
      log.actorName,
      log.actorIp,
      log.action,
      log.targetType,
      log.targetId,
      log.targetName,
      log.details ? JSON.stringify(log.details) : null,
      log.result,
      log.errorMessage
    ]);
    this.save();
  }

  close() {
    this.db.close();
  }
}
