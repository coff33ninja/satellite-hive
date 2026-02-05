import { nanoid } from 'nanoid';
import { DB } from '../db/index.js';
import type { Session } from '../types/index.js';

export class SessionManager {
  private db: DB;
  private activeSessions = new Map<string, {
    session: Session;
    outputBuffer: Buffer[];
  }>();

  constructor(db: DB) {
    this.db = db;
  }

  create(params: {
    satelliteId: string;
    userId: string;
    cols?: number;
    rows?: number;
    shell?: string;
  }): Session {
    const session: Session = {
      id: `sess_${nanoid(12)}`,
      satelliteId: params.satelliteId,
      userId: params.userId,
      status: 'active',
      cols: params.cols || 120,
      rows: params.rows || 40,
      shell: params.shell,
      createdAt: new Date(),
    };

    this.db.createSession(session);
    this.activeSessions.set(session.id, { session, outputBuffer: [] });

    return session;
  }

  get(id: string): Session | undefined {
    const active = this.activeSessions.get(id);
    if (active) return active.session;
    return this.db.getSessionById(id);
  }

  terminate(id: string, reason: string, exitCode?: number) {
    this.db.updateSessionStatus(id, 'ended', reason, exitCode);
    this.activeSessions.delete(id);
  }

  addOutput(sessionId: string, data: Buffer) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.outputBuffer.push(data);
      // Keep only last 100 chunks
      if (session.outputBuffer.length > 100) {
        session.outputBuffer.shift();
      }
    }
  }

  getRecentOutput(sessionId: string): Buffer[] {
    const session = this.activeSessions.get(sessionId);
    return session?.outputBuffer || [];
  }

  isActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  list(): Session[] {
    return this.db.getAllSessions();
  }
}
