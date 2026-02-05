import Database from 'better-sqlite3';
import { initializeDatabase } from './schema.js';
import type { User, Satellite, Session } from '../types/index.js';

export class DB {
  private db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    initializeDatabase(this.db);
  }

  // Users
  createUser(user: Omit<User, 'createdAt' | 'updatedAt'>) {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, roles, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(user.id, user.email, user.passwordHash, JSON.stringify(user.roles), user.isActive ? 1 : 0);
  }

  getUserByEmail(email: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;
    if (!row) return undefined;
    return {
      ...row,
      roles: JSON.parse(row.roles),
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  getUserById(id: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return {
      ...row,
      roles: JSON.parse(row.roles),
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // Satellites
  createSatellite(satellite: Omit<Satellite, 'createdAt' | 'updatedAt' | 'tags'>) {
    const stmt = this.db.prepare(`
      INSERT INTO satellites (
        id, name, token_hash, status, system_info, hostname, os, os_version, arch,
        last_ip, last_seen, first_seen, agent_version, capabilities
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      satellite.id,
      satellite.name,
      satellite.tokenHash,
      satellite.status,
      satellite.systemInfo ? JSON.stringify(satellite.systemInfo) : null,
      satellite.hostname,
      satellite.os,
      satellite.osVersion,
      satellite.arch,
      satellite.lastIp,
      satellite.lastSeen?.toISOString(),
      satellite.firstSeen.toISOString(),
      satellite.agentVersion,
      JSON.stringify(satellite.capabilities)
    );
  }

  getSatelliteById(id: string): Satellite | undefined {
    const stmt = this.db.prepare('SELECT * FROM satellites WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;

    const tags = this.getSatelliteTags(id);
    return this.rowToSatellite(row, tags);
  }

  getAllSatellites(): Satellite[] {
    const stmt = this.db.prepare('SELECT * FROM satellites ORDER BY name');
    const rows = stmt.all() as any[];
    return rows.map(row => {
      const tags = this.getSatelliteTags(row.id);
      return this.rowToSatellite(row, tags);
    });
  }

  updateSatelliteStatus(id: string, status: 'online' | 'offline', lastSeen?: Date, lastIp?: string) {
    const stmt = this.db.prepare(`
      UPDATE satellites 
      SET status = ?, last_seen = ?, last_ip = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, lastSeen?.toISOString(), lastIp, id);
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
    const stmt = this.db.prepare('SELECT tag FROM satellite_tags WHERE satellite_id = ?');
    const rows = stmt.all(satelliteId) as any[];
    return rows.map(r => r.tag);
  }

  addSatelliteTag(satelliteId: string, tag: string) {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO satellite_tags (satellite_id, tag) VALUES (?, ?)');
    stmt.run(satelliteId, tag);
  }

  // Sessions
  createSession(session: Omit<Session, 'createdAt' | 'endedAt' | 'endReason' | 'exitCode'>) {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, satellite_id, user_id, status, cols, rows, shell)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(session.id, session.satelliteId, session.userId, session.status, session.cols, session.rows, session.shell);
  }

  getSessionById(id: string): Session | undefined {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return this.rowToSession(row);
  }

  updateSessionStatus(id: string, status: 'ended' | 'error', endReason?: string, exitCode?: number) {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = ?, ended_at = CURRENT_TIMESTAMP, end_reason = ?, exit_code = ?
      WHERE id = ?
    `);
    stmt.run(status, endReason, exitCode, id);
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
    const stmt = this.db.prepare(`
      INSERT INTO audit_logs (
        id, actor_type, actor_id, actor_name, actor_ip, action,
        target_type, target_id, target_name, details, result, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
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
    );
  }

  close() {
    this.db.close();
  }
}
