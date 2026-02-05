# Database Schema Specification

> Data models and schema for Satellite Hive

---

## 1. Overview

Satellite Hive uses a relational database (SQLite for development/small deployments, PostgreSQL for production). This document defines the schema, relationships, and migration strategy.

---

## 2. Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│    users    │     │   satellites    │     │   sessions   │
├─────────────┤     ├─────────────────┤     ├──────────────┤
│ id (PK)     │     │ id (PK)         │     │ id (PK)      │
│ email       │     │ name            │     │ satellite_id │──┐
│ password    │     │ token_hash      │     │ user_id      │──┼──┐
│ roles       │     │ status          │     │ status       │  │  │
│ created_at  │     │ system_info     │     │ created_at   │  │  │
│ updated_at  │     │ last_seen       │     │ ended_at     │  │  │
└─────────────┘     │ created_at      │     └──────────────┘  │  │
      │             └─────────────────┘            │          │  │
      │                     │                      │          │  │
      │             ┌───────┴───────┐              │          │  │
      │             │               │              │          │  │
      │      ┌──────┴──────┐ ┌──────┴──────┐      │          │  │
      │      │satellite_tags│ │   metrics   │      │          │  │
      │      ├─────────────┤ ├─────────────┤      │          │  │
      │      │satellite_id │ │satellite_id │      │          │  │
      │      │ tag         │ │ timestamp   │      │          │  │
      │      └─────────────┘ │ cpu, memory │      │          │  │
      │                      └─────────────┘      │          │  │
      │                                           │          │  │
      └───────────────────────┬───────────────────┘          │  │
                              │                              │  │
                       ┌──────┴──────┐                       │  │
                       │ audit_logs  │◄──────────────────────┘  │
                       ├─────────────┤                          │
                       │ id (PK)     │                          │
                       │ actor_type  │◄─────────────────────────┘
                       │ actor_id    │
                       │ action      │
                       │ target_type │
                       │ target_id   │
                       │ details     │
                       │ result      │
                       │ timestamp   │
                       └─────────────┘

┌─────────────┐     ┌─────────────────┐
│  api_keys   │     │ provision_tokens│
├─────────────┤     ├─────────────────┤
│ id (PK)     │     │ id (PK)         │
│ key_hash    │     │ token           │
│ name        │     │ satellite_id    │
│ user_id (FK)│     │ platform        │
│ scopes      │     │ tags            │
│ expires_at  │     │ expires_at      │
│ created_at  │     │ created_at      │
└─────────────┘     └─────────────────┘
```

---

## 3. Tables

### 3.1 users

Stores user accounts for web UI access.

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,                    -- user_xxxxxxxxxxxx
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,            -- Argon2id hash
    roles TEXT NOT NULL DEFAULT '["viewer"]', -- JSON array
    first_name TEXT,
    last_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP,
    password_changed_at TIMESTAMP,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
```

### 3.2 satellites

Stores registered satellite agents.

```sql
CREATE TABLE satellites (
    id TEXT PRIMARY KEY,                    -- sat_xxxxxxxxxxxx
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,               -- SHA-256 of token
    status TEXT NOT NULL DEFAULT 'offline', -- online, offline
    
    -- System information (JSON)
    system_info TEXT,                       -- Full system info from handshake
    
    -- Quick access fields (denormalized from system_info)
    hostname TEXT,
    os TEXT,
    os_version TEXT,
    arch TEXT,
    
    -- Connection info
    last_ip TEXT,
    last_seen TIMESTAMP,
    first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Agent info
    agent_version TEXT,
    capabilities TEXT,                      -- JSON array
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Soft delete
    deleted_at TIMESTAMP
);

CREATE INDEX idx_satellites_status ON satellites(status);
CREATE INDEX idx_satellites_last_seen ON satellites(last_seen);
CREATE INDEX idx_satellites_deleted_at ON satellites(deleted_at);
```

### 3.3 satellite_tags

Many-to-many relationship for satellite tags.

```sql
CREATE TABLE satellite_tags (
    satellite_id TEXT NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (satellite_id, tag)
);

CREATE INDEX idx_satellite_tags_tag ON satellite_tags(tag);
```

### 3.4 sessions

Stores active and historical terminal sessions.

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                    -- sess_xxxxxxxxxxxx
    satellite_id TEXT NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    
    status TEXT NOT NULL DEFAULT 'active',  -- active, ended, error
    
    -- Terminal settings
    cols INTEGER NOT NULL DEFAULT 120,
    rows INTEGER NOT NULL DEFAULT 40,
    shell TEXT,
    
    -- Timing
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    
    -- End reason
    end_reason TEXT,                        -- user_terminated, timeout, error, satellite_disconnected
    exit_code INTEGER
);

CREATE INDEX idx_sessions_satellite_id ON sessions(satellite_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
```

### 3.5 metrics

Time-series metrics from satellites.

```sql
CREATE TABLE metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    satellite_id TEXT NOT NULL REFERENCES satellites(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Metrics
    cpu_percent REAL,
    memory_percent REAL,
    disk_percent REAL,
    load_1m REAL,
    load_5m REAL,
    load_15m REAL,
    network_rx_bytes BIGINT,
    network_tx_bytes BIGINT,
    active_sessions INTEGER
);

CREATE INDEX idx_metrics_satellite_timestamp ON metrics(satellite_id, timestamp);

-- Partition by time (PostgreSQL) or use separate tables per time period
```

### 3.6 audit_logs

Comprehensive audit trail.

```sql
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,                    -- audit_xxxxxxxxxxxx
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Actor (who performed the action)
    actor_type TEXT NOT NULL,               -- user, api_key, mcp, system
    actor_id TEXT,
    actor_name TEXT,
    actor_ip TEXT,
    
    -- Action
    action TEXT NOT NULL,                   -- login, exec, session_start, power, etc.
    
    -- Target (what was acted upon)
    target_type TEXT,                       -- satellite, user, session, etc.
    target_id TEXT,
    target_name TEXT,
    
    -- Details
    details TEXT,                           -- JSON with action-specific data
    
    -- Result
    result TEXT NOT NULL,                   -- success, failure
    error_message TEXT
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_type, actor_id);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

### 3.7 api_keys

API keys for programmatic access.

```sql
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,                    -- ak_xxxxxxxxxxxx
    key_hash TEXT NOT NULL UNIQUE,          -- SHA-256 of key
    key_prefix TEXT NOT NULL,               -- First 8 chars for identification
    
    name TEXT NOT NULL,
    description TEXT,
    
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    scopes TEXT NOT NULL DEFAULT '[]',      -- JSON array of allowed scopes
    
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
```

### 3.8 provision_tokens

Temporary tokens for agent provisioning.

```sql
CREATE TABLE provision_tokens (
    id TEXT PRIMARY KEY,                    -- ptok_xxxxxxxxxxxx
    token_hash TEXT NOT NULL UNIQUE,
    
    -- Pre-configured satellite info
    satellite_id TEXT NOT NULL,             -- Pre-generated sat_xxx ID
    name TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',        -- JSON array
    
    -- Platform
    platform_os TEXT NOT NULL,
    platform_arch TEXT NOT NULL,
    
    -- Creator
    created_by TEXT NOT NULL REFERENCES users(id),
    
    -- Validity
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_provision_tokens_token_hash ON provision_tokens(token_hash);
CREATE INDEX idx_provision_tokens_expires_at ON provision_tokens(expires_at);
```

### 3.9 groups (Future)

```sql
CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    
    -- Dynamic membership via tag query
    tag_query TEXT,                         -- e.g., "production AND web"
    
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. TypeScript Types

```typescript
// User
interface User {
  id: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type Role = 'admin' | 'operator' | 'viewer';

// Satellite
interface Satellite {
  id: string;
  name: string;
  tokenHash: string;
  status: 'online' | 'offline';
  systemInfo?: SystemInfo;
  hostname?: string;
  os?: string;
  osVersion?: string;
  arch?: string;
  lastIp?: string;
  lastSeen?: Date;
  firstSeen: Date;
  agentVersion?: string;
  capabilities: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

interface SystemInfo {
  hostname: string;
  os: string;
  osVersion: string;
  arch: string;
  kernel?: string;
  uptimeSeconds: number;
  cpuCores: number;
  memoryTotalMb: number;
  memoryAvailableMb: number;
  diskTotalGb: number;
  diskAvailableGb: number;
  ipAddresses: NetworkInterface[];
  macAddresses: MacAddress[];
}

// Session
interface Session {
  id: string;
  satelliteId: string;
  userId: string;
  status: 'active' | 'ended' | 'error';
  cols: number;
  rows: number;
  shell?: string;
  createdAt: Date;
  endedAt?: Date;
  endReason?: string;
  exitCode?: number;
}

// Metrics
interface Metrics {
  id: number;
  satelliteId: string;
  timestamp: Date;
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  load1m?: number;
  load5m?: number;
  load15m?: number;
  networkRxBytes?: number;
  networkTxBytes?: number;
  activeSessions?: number;
}

// Audit Log
interface AuditLog {
  id: string;
  timestamp: Date;
  actorType: 'user' | 'api_key' | 'mcp' | 'system';
  actorId?: string;
  actorName?: string;
  actorIp?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, any>;
  result: 'success' | 'failure';
  errorMessage?: string;
}

// API Key
interface ApiKey {
  id: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  description?: string;
  userId: string;
  scopes: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
}

// Provision Token
interface ProvisionToken {
  id: string;
  tokenHash: string;
  satelliteId: string;
  name: string;
  tags: string[];
  platformOs: string;
  platformArch: string;
  createdBy: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}
```

---

## 5. Migrations

### 5.1 Migration Strategy

- Use numbered migration files
- Each migration is idempotent
- Support both up and down migrations
- Track applied migrations in `schema_migrations` table

```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 Example Migration

**001_initial_schema.sql:**
```sql
-- Up
CREATE TABLE users ( ... );
CREATE TABLE satellites ( ... );
-- ... all initial tables

INSERT INTO schema_migrations (version) VALUES (1);

-- Down
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS satellite_tags;
DROP TABLE IF EXISTS satellites;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS users;
DELETE FROM schema_migrations WHERE version = 1;
```

---

## 6. Queries

### 6.1 Common Queries

**Get online satellites with tags:**
```sql
SELECT 
    s.*,
    GROUP_CONCAT(st.tag) as tags
FROM satellites s
LEFT JOIN satellite_tags st ON s.id = st.satellite_id
WHERE s.status = 'online'
  AND s.deleted_at IS NULL
GROUP BY s.id
ORDER BY s.name;
```

**Get satellites by tag:**
```sql
SELECT DISTINCT s.*
FROM satellites s
INNER JOIN satellite_tags st ON s.id = st.satellite_id
WHERE st.tag IN ('production', 'web')
  AND s.deleted_at IS NULL
GROUP BY s.id
HAVING COUNT(DISTINCT st.tag) = 2;  -- Must have ALL tags
```

**Get recent metrics for satellite:**
```sql
SELECT *
FROM metrics
WHERE satellite_id = ?
  AND timestamp > datetime('now', '-1 hour')
ORDER BY timestamp DESC
LIMIT 100;
```

**Get audit logs for satellite:**
```sql
SELECT *
FROM audit_logs
WHERE target_type = 'satellite'
  AND target_id = ?
ORDER BY timestamp DESC
LIMIT 50;
```

### 6.2 Aggregation Queries

**Satellite count by status:**
```sql
SELECT 
    status,
    COUNT(*) as count
FROM satellites
WHERE deleted_at IS NULL
GROUP BY status;
```

**Active sessions per satellite:**
```sql
SELECT 
    satellite_id,
    COUNT(*) as active_sessions
FROM sessions
WHERE status = 'active'
GROUP BY satellite_id;
```

**Hourly command count:**
```sql
SELECT 
    strftime('%Y-%m-%d %H:00', timestamp) as hour,
    COUNT(*) as commands
FROM audit_logs
WHERE action = 'exec'
  AND timestamp > datetime('now', '-24 hours')
GROUP BY hour
ORDER BY hour;
```

---

## 7. Data Retention

### 7.1 Retention Policies

| Data | Retention | Rationale |
|------|-----------|-----------|
| Audit logs | 90 days | Compliance |
| Metrics | 30 days | Performance |
| Sessions | 30 days | History |
| Deleted satellites | 7 days | Recovery window |

### 7.2 Cleanup Jobs

```sql
-- Delete old metrics
DELETE FROM metrics
WHERE timestamp < datetime('now', '-30 days');

-- Delete old audit logs
DELETE FROM audit_logs
WHERE timestamp < datetime('now', '-90 days');

-- Purge soft-deleted satellites
DELETE FROM satellites
WHERE deleted_at IS NOT NULL
  AND deleted_at < datetime('now', '-7 days');

-- Delete expired provision tokens
DELETE FROM provision_tokens
WHERE expires_at < datetime('now')
  OR used_at IS NOT NULL;
```

---

## 8. Performance Considerations

### 8.1 Indexes

All foreign keys and frequently queried columns are indexed.

### 8.2 Partitioning (PostgreSQL)

For high-volume deployments, partition metrics by time:

```sql
CREATE TABLE metrics (
    id BIGSERIAL,
    satellite_id TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    -- ... other columns
) PARTITION BY RANGE (timestamp);

CREATE TABLE metrics_2026_02 PARTITION OF metrics
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

### 8.3 Connection Pooling

- SQLite: Single connection (serialized)
- PostgreSQL: Use PgBouncer or similar

---

## 9. Backup Strategy

### 9.1 SQLite

```bash
# Online backup
sqlite3 hive.db ".backup '/backup/hive_$(date +%Y%m%d).db'"

# With WAL mode
sqlite3 hive.db "PRAGMA wal_checkpoint(TRUNCATE)"
cp hive.db /backup/
```

### 9.2 PostgreSQL

```bash
# Full backup
pg_dump -Fc satellite_hive > /backup/hive_$(date +%Y%m%d).dump

# Continuous archiving (WAL)
# Configure archive_command in postgresql.conf
```

---

## 10. Future Enhancements

- [ ] Read replicas for scaling
- [ ] Time-series database for metrics (TimescaleDB, InfluxDB)
- [ ] Full-text search for audit logs (Elasticsearch)
- [ ] Caching layer (Redis)

