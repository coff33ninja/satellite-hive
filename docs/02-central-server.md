# Central Server Specification

> The brain of the Satellite Hive system

---

## 1. Overview

The Central Server is the coordination hub for all satellites. It handles device registration, authentication, command routing, session management, and provides APIs for the web UI and MCP integration.

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement |
|----|-------------|
| CS-F01 | Server MUST accept WebSocket connections from satellites |
| CS-F02 | Server MUST authenticate satellites via tokens |
| CS-F03 | Server MUST maintain a registry of connected satellites |
| CS-F04 | Server MUST route commands to appropriate satellites |
| CS-F05 | Server MUST provide REST API for web UI |
| CS-F06 | Server MUST provide WebSocket API for real-time updates |
| CS-F07 | Server MUST expose MCP interface for AI integration |
| CS-F08 | Server MUST generate provisioned agent binaries |
| CS-F09 | Server MUST persist satellite data to database |
| CS-F10 | Server MUST log all commands for audit |

### 2.2 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| CS-N01 | Server SHOULD support 1000+ concurrent satellites |
| CS-N02 | API response time SHOULD be < 100ms (p95) |
| CS-N03 | Server SHOULD be horizontally scalable |
| CS-N04 | Server MUST support graceful shutdown |
| CS-N05 | Server SHOULD have < 1 minute recovery time |

---

## 3. Architecture

```
                         ┌─────────────────────────────────────┐
                         │          Central Server             │
                         │                                     │
   ┌───────────┐         │  ┌─────────────────────────────┐   │
   │  Web UI   │◄───────►│  │        HTTP Server          │   │
   │ (Browser) │  REST   │  │  - REST API (/api/v1/*)     │   │
   └───────────┘  + WS   │  │  - WebSocket (/ws/ui)       │   │
                         │  │  - Static files             │   │
                         │  └─────────────────────────────┘   │
                         │                 │                   │
   ┌───────────┐         │  ┌─────────────────────────────┐   │
   │ Satellite │◄───────►│  │     Agent WebSocket Hub     │   │
   │  Agents   │   WS    │  │  - Connection management    │   │
   └───────────┘         │  │  - Message routing          │   │
                         │  │  - Session multiplexing     │   │
                         │  └─────────────────────────────┘   │
                         │                 │                   │
   ┌───────────┐         │  ┌─────────────────────────────┐   │
   │    AI     │◄───────►│  │        MCP Server           │   │
   │  Client   │  stdio  │  │  - Tools                    │   │
   └───────────┘         │  │  - Resources                │   │
                         │  │  - Prompts                  │   │
                         │  └─────────────────────────────┘   │
                         │                 │                   │
                         │  ┌─────────────────────────────┐   │
                         │  │      Core Services          │   │
                         │  │  - DeviceRegistry           │   │
                         │  │  - SessionManager           │   │
                         │  │  - CommandRouter            │   │
                         │  │  - ProvisioningService      │   │
                         │  │  - AuditLogger              │   │
                         │  └─────────────────────────────┘   │
                         │                 │                   │
                         │  ┌─────────────────────────────┐   │
                         │  │        Database             │   │
                         │  │  (SQLite / PostgreSQL)      │   │
                         │  └─────────────────────────────┘   │
                         └─────────────────────────────────────┘
```

---

## 4. Configuration

```yaml
# server.yaml
server:
  host: "0.0.0.0"
  port: 3000
  # External URL (for generating agent configs)
  external_url: "https://hive.example.com"

tls:
  enabled: true
  cert_file: "/etc/satellite-hive/cert.pem"
  key_file: "/etc/satellite-hive/key.pem"
  # Auto-generate self-signed cert if files don't exist
  auto_generate: false

database:
  # sqlite or postgres
  driver: "sqlite"
  # SQLite path or Postgres connection string
  connection: "./data/hive.db"
  # Connection pool settings (postgres only)
  max_connections: 20
  min_connections: 5

auth:
  # JWT secret for web UI sessions
  jwt_secret: "${JWT_SECRET}"
  # JWT expiration
  jwt_expiration: "24h"
  # API key for admin operations
  admin_api_key: "${ADMIN_API_KEY}"

agents:
  # Heartbeat timeout (mark offline after this)
  heartbeat_timeout: "90s"
  # Maximum concurrent sessions per agent
  max_sessions_per_agent: 10
  # Token expiration (0 = never)
  token_expiration: "0"

provisioning:
  # Path to agent binary templates
  binary_templates_path: "./binaries"
  # Supported platforms
  platforms:
    - os: linux
      arch: amd64
      binary: "satellite-agent-linux-amd64"
    - os: linux
      arch: arm64
      binary: "satellite-agent-linux-arm64"
    - os: windows
      arch: amd64
      binary: "satellite-agent-windows-amd64.exe"
    - os: darwin
      arch: amd64
      binary: "satellite-agent-darwin-amd64"
    - os: darwin
      arch: arm64
      binary: "satellite-agent-darwin-arm64"

mcp:
  enabled: true
  # Transport: stdio or http
  transport: "stdio"

logging:
  level: "info"
  format: "json"  # or "text"
  file: "./logs/server.log"

audit:
  enabled: true
  # Retention in days
  retention_days: 90
```

---

## 5. REST API

Base path: `/api/v1`

### 5.1 Authentication

All API endpoints (except `/auth/*`) require authentication via:
- `Authorization: Bearer <jwt_token>` header (for web UI)
- `X-API-Key: <api_key>` header (for programmatic access)

### 5.2 Endpoints

#### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login with username/password |
| POST | `/auth/logout` | Invalidate session |
| POST | `/auth/refresh` | Refresh JWT token |
| GET | `/auth/me` | Get current user info |

#### Satellites

| Method | Path | Description |
|--------|------|-------------|
| GET | `/satellites` | List all satellites |
| GET | `/satellites/:id` | Get satellite details |
| PUT | `/satellites/:id` | Update satellite (name, tags) |
| DELETE | `/satellites/:id` | Remove satellite from hive |
| POST | `/satellites/:id/exec` | Execute command on satellite |
| POST | `/satellites/:id/power` | Send power command |
| GET | `/satellites/:id/sessions` | List active sessions |

#### Sessions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions` | Create new terminal session |
| GET | `/sessions/:id` | Get session info |
| DELETE | `/sessions/:id` | Terminate session |

#### Provisioning

| Method | Path | Description |
|--------|------|-------------|
| POST | `/provision` | Generate provisioned agent |
| GET | `/provision/platforms` | List available platforms |
| GET | `/provision/download/:token` | Download provisioned binary |

#### Groups & Tags

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tags` | List all tags |
| GET | `/satellites/by-tag/:tag` | List satellites by tag |
| POST | `/groups` | Create group |
| GET | `/groups` | List groups |
| POST | `/groups/:id/exec` | Execute on group |

#### Audit

| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit/logs` | Query audit logs |
| GET | `/audit/logs/:id` | Get specific log entry |

### 5.3 API Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "SATELLITE_NOT_FOUND",
    "message": "Satellite with ID sat_xxx not found"
  }
}
```

**Paginated:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

---

## 6. WebSocket APIs

### 6.1 UI WebSocket (`/ws/ui`)

For real-time updates to the web UI.

**Connection:**
```
wss://hive.example.com/ws/ui?token=<jwt_token>
```

**Server → Client Messages:**

```json
// Satellite came online
{
  "event": "satellite:online",
  "data": {
    "id": "sat_xxx",
    "name": "web-server-01",
    "system": { ... }
  }
}

// Satellite went offline
{
  "event": "satellite:offline",
  "data": {
    "id": "sat_xxx",
    "last_seen": "2026-02-05T05:42:00Z"
  }
}

// Satellite metrics update
{
  "event": "satellite:metrics",
  "data": {
    "id": "sat_xxx",
    "metrics": { ... }
  }
}

// Terminal output
{
  "event": "session:output",
  "data": {
    "session_id": "sess_xxx",
    "output": "base64_encoded_data"
  }
}

// Session ended
{
  "event": "session:ended",
  "data": {
    "session_id": "sess_xxx",
    "reason": "user_terminated"
  }
}
```

**Client → Server Messages:**

```json
// Terminal input
{
  "action": "session:input",
  "data": {
    "session_id": "sess_xxx",
    "input": "base64_encoded_data"
  }
}

// Resize terminal
{
  "action": "session:resize",
  "data": {
    "session_id": "sess_xxx",
    "cols": 120,
    "rows": 40
  }
}

// Subscribe to satellite updates
{
  "action": "subscribe",
  "data": {
    "satellites": ["sat_xxx", "sat_yyy"]
  }
}
```

### 6.2 Agent WebSocket (`/ws/agent`)

For satellite agent connections. See [05-protocol.md](./05-protocol.md) for full protocol specification.

**Connection:**
```
wss://hive.example.com/ws/agent
```

---

## 7. Core Services

### 7.1 DeviceRegistry

Manages the in-memory and persistent state of all satellites.

```typescript
interface DeviceRegistry {
  // Register new satellite or update existing
  register(satellite: SatelliteInfo): Promise<Satellite>;
  
  // Mark satellite as offline
  markOffline(id: string): Promise<void>;
  
  // Get satellite by ID
  get(id: string): Promise<Satellite | null>;
  
  // List all satellites with filters
  list(filters: SatelliteFilters): Promise<Satellite[]>;
  
  // Update satellite metadata
  update(id: string, updates: SatelliteUpdates): Promise<Satellite>;
  
  // Remove satellite
  remove(id: string): Promise<void>;
  
  // Get satellites by tag
  getByTag(tag: string): Promise<Satellite[]>;
  
  // Subscribe to satellite events
  subscribe(callback: (event: SatelliteEvent) => void): Unsubscribe;
}
```

### 7.2 SessionManager

Manages terminal sessions between UI and satellites.

```typescript
interface SessionManager {
  // Create new session
  create(params: CreateSessionParams): Promise<Session>;
  
  // Get session by ID
  get(id: string): Promise<Session | null>;
  
  // List sessions (optionally filtered)
  list(filters?: SessionFilters): Promise<Session[]>;
  
  // Send input to session
  sendInput(id: string, data: Buffer): Promise<void>;
  
  // Resize session terminal
  resize(id: string, cols: number, rows: number): Promise<void>;
  
  // Terminate session
  terminate(id: string): Promise<void>;
  
  // Subscribe to session events
  subscribe(id: string, callback: (event: SessionEvent) => void): Unsubscribe;
}
```

### 7.3 CommandRouter

Routes commands to appropriate satellites.

```typescript
interface CommandRouter {
  // Execute command on single satellite
  exec(satelliteId: string, command: ExecCommand): Promise<ExecResult>;
  
  // Execute command on multiple satellites
  execMulti(satelliteIds: string[], command: ExecCommand): Promise<Map<string, ExecResult>>;
  
  // Execute command on satellites matching tag
  execByTag(tag: string, command: ExecCommand): Promise<Map<string, ExecResult>>;
  
  // Send power command
  power(satelliteId: string, action: PowerAction): Promise<PowerResult>;
}
```

### 7.4 ProvisioningService

Generates pre-configured agent binaries.

```typescript
interface ProvisioningService {
  // Generate provisioned agent
  provision(params: ProvisionParams): Promise<ProvisionResult>;
  
  // Get download URL for provisioned agent
  getDownloadUrl(token: string): string;
  
  // List available platforms
  listPlatforms(): Platform[];
  
  // Validate provision token
  validateToken(token: string): Promise<ProvisionInfo | null>;
}

interface ProvisionParams {
  name: string;
  tags: string[];
  platform: {
    os: 'linux' | 'windows' | 'darwin';
    arch: 'amd64' | 'arm64';
  };
  // Optional custom config overrides
  config?: Partial<AgentConfig>;
}
```

### 7.5 AuditLogger

Records all actions for compliance and debugging.

```typescript
interface AuditLogger {
  // Log an action
  log(entry: AuditEntry): Promise<void>;
  
  // Query logs
  query(params: AuditQuery): Promise<AuditEntry[]>;
  
  // Get specific entry
  get(id: string): Promise<AuditEntry | null>;
}

interface AuditEntry {
  id: string;
  timestamp: Date;
  actor: {
    type: 'user' | 'api_key' | 'mcp';
    id: string;
    name: string;
  };
  action: string;
  target: {
    type: 'satellite' | 'session' | 'group';
    id: string;
  };
  details: Record<string, any>;
  result: 'success' | 'failure';
  error?: string;
}
```

---

## 8. Authentication & Authorization

### 8.1 User Authentication

- Web UI users authenticate via username/password
- Server issues JWT tokens on successful auth
- Tokens include user ID, roles, and expiration

```typescript
interface JWTPayload {
  sub: string;        // User ID
  email: string;
  roles: string[];    // ['admin', 'operator', 'viewer']
  iat: number;
  exp: number;
}
```

### 8.2 Agent Authentication

- Agents authenticate via provisioned tokens
- Tokens are validated on handshake
- Invalid tokens result in connection termination

### 8.3 Role-Based Access Control

| Role | Capabilities |
|------|--------------|
| `admin` | Full access, user management, provisioning |
| `operator` | Execute commands, manage sessions |
| `viewer` | Read-only access to satellite status |

### 8.4 API Key Authentication

- API keys are used for programmatic access
- Keys have associated permissions/scopes
- Keys can be rotated without affecting users

---

## 9. Error Handling

### 9.1 Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required |
| `AUTH_INVALID` | 401 | Invalid credentials or token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `SATELLITE_OFFLINE` | 503 | Satellite is not connected |
| `SESSION_LIMIT` | 429 | Too many active sessions |
| `COMMAND_TIMEOUT` | 504 | Command execution timed out |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 10. Clustering & Scalability

For production deployments with many satellites:

### 10.1 Horizontal Scaling

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │  Server 1   │   │  Server 2   │   │  Server 3   │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                 │                 │
           └─────────────────┼─────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
               ┌────┴────┐      ┌─────┴─────┐
               │  Redis  │      │ PostgreSQL│
               │ (pubsub)│      │           │
               └─────────┘      └───────────┘
```

### 10.2 Session Affinity

- Satellites maintain sticky connections to their original server
- Redis pub/sub used for cross-server communication
- PostgreSQL for persistent state

---

## 11. Monitoring

### 11.1 Health Endpoints

```
GET /health        → Basic health check
GET /health/ready  → Readiness (can accept traffic)
GET /health/live   → Liveness (process is running)
```

### 11.2 Metrics (Prometheus)

| Metric | Type | Description |
|--------|------|-------------|
| `hive_satellites_total` | Gauge | Total registered satellites |
| `hive_satellites_online` | Gauge | Currently connected satellites |
| `hive_sessions_active` | Gauge | Active terminal sessions |
| `hive_commands_total` | Counter | Commands executed |
| `hive_command_duration_seconds` | Histogram | Command execution time |
| `hive_websocket_connections` | Gauge | Active WebSocket connections |
| `hive_api_requests_total` | Counter | API requests by endpoint |
| `hive_api_request_duration_seconds` | Histogram | API response time |

---

## 12. Directory Structure

```
central-server/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Configuration loader
│   ├── server.ts             # HTTP/WS server setup
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── satellites.ts
│   │   │   ├── sessions.ts
│   │   │   ├── provision.ts
│   │   │   └── audit.ts
│   │   └── middleware/
│   │       ├── auth.ts
│   │       ├── rateLimit.ts
│   │       └── errorHandler.ts
│   │
│   ├── ws/
│   │   ├── agentHub.ts       # Agent WebSocket handling
│   │   └── uiHub.ts          # UI WebSocket handling
│   │
│   ├── services/
│   │   ├── deviceRegistry.ts
│   │   ├── sessionManager.ts
│   │   ├── commandRouter.ts
│   │   ├── provisioning.ts
│   │   └── auditLogger.ts
│   │
│   ├── mcp/
│   │   ├── server.ts         # MCP server setup
│   │   ├── tools.ts          # MCP tools
│   │   └── resources.ts      # MCP resources
│   │
│   ├── db/
│   │   ├── schema.ts         # Database schema
│   │   ├── migrations/
│   │   └── queries/
│   │
│   └── types/
│       └── index.ts          # TypeScript types
│
├── binaries/                 # Agent binary templates
├── data/                     # SQLite database
├── logs/                     # Log files
├── package.json
├── tsconfig.json
└── server.yaml               # Configuration
```

---

## 13. Future Enhancements

- [ ] Multi-tenancy support
- [ ] SSO/SAML integration
- [ ] Webhook notifications
- [ ] Custom dashboards
- [ ] Alert rules and notifications
- [ ] Backup and restore
- [ ] Disaster recovery

