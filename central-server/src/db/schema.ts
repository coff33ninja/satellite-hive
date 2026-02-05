import type { Database as SqlJsDatabase } from 'sql.js';

export function initializeDatabase(db: SqlJsDatabase) {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      roles TEXT NOT NULL DEFAULT '["viewer"]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Satellites table
  db.run(`
    CREATE TABLE IF NOT EXISTS satellites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      system_info TEXT,
      hostname TEXT,
      os TEXT,
      os_version TEXT,
      arch TEXT,
      last_ip TEXT,
      last_seen TEXT,
      first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      agent_version TEXT,
      capabilities TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Satellite tags
  db.run(`
    CREATE TABLE IF NOT EXISTS satellite_tags (
      satellite_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (satellite_id, tag),
      FOREIGN KEY (satellite_id) REFERENCES satellites(id) ON DELETE CASCADE
    );
  `);

  // Sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      satellite_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      cols INTEGER NOT NULL DEFAULT 120,
      rows INTEGER NOT NULL DEFAULT 40,
      shell TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT,
      end_reason TEXT,
      exit_code INTEGER,
      FOREIGN KEY (satellite_id) REFERENCES satellites(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Audit logs
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      actor_ip TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      target_name TEXT,
      details TEXT,
      result TEXT NOT NULL,
      error_message TEXT
    );
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_satellites_status ON satellites(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_satellites_last_seen ON satellites(last_seen);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_satellite_tags_tag ON satellite_tags(tag);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_satellite_id ON sessions(satellite_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);`);
}
