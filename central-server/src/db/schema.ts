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

  // Provision tokens
  db.run(`
    CREATE TABLE IF NOT EXISTS provision_tokens (
      token TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tags TEXT,
      platform TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      used_by_satellite_id TEXT,
      is_revoked INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (used_by_satellite_id) REFERENCES satellites(id)
    );
  `);

  // Metrics table for time-series data
  db.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      satellite_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      metric_type TEXT NOT NULL,
      cpu_usage REAL,
      memory_total INTEGER,
      memory_used INTEGER,
      memory_percent REAL,
      disk_total INTEGER,
      disk_used INTEGER,
      disk_percent REAL,
      network_bytes_sent INTEGER,
      network_bytes_recv INTEGER,
      load_avg_1 REAL,
      load_avg_5 REAL,
      load_avg_15 REAL,
      process_count INTEGER,
      uptime_seconds INTEGER,
      FOREIGN KEY (satellite_id) REFERENCES satellites(id) ON DELETE CASCADE
    );
  `);

  // API keys table
  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      permissions TEXT NOT NULL,
      expires_at TEXT,
      last_used_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_satellites_status ON satellites(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_satellites_last_seen ON satellites(last_seen);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_satellite_tags_tag ON satellite_tags(tag);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_satellite_id ON sessions(satellite_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_provision_tokens_expires_at ON provision_tokens(expires_at);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_provision_tokens_created_by ON provision_tokens(created_by);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_satellite_timestamp ON metrics(satellite_id, timestamp);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);`);
}
