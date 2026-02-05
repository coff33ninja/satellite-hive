# Communication Protocol Specification

> Wire protocol for Satellite Hive communications

---

## 1. Overview

This document defines the communication protocol between:
- Satellite Agents ↔ Central Server
- Web UI ↔ Central Server
- MCP Client ↔ Central Server

All communications use WebSocket with JSON-encoded messages over TLS.

---

## 2. Transport Layer

### 2.1 Agent Connection

```
Endpoint: wss://{server}/ws/agent
```

**Connection Flow:**
```
Agent                                    Server
  │                                         │
  │ ─────── WebSocket Connect ──────────►   │
  │                                         │
  │ ◄───── Connection Accepted ──────────   │
  │                                         │
  │ ─────── Handshake Message ──────────►   │
  │         (auth token, system info)       │
  │                                         │
  │ ◄───── Handshake Response ───────────   │
  │         (accept/reject)                 │
  │                                         │
  │ ◄────── Heartbeat Ping ──────────────   │
  │ ─────── Heartbeat Pong ──────────────►  │
  │         (+ metrics)                     │
  │                                         │
  │ ◄────── Command Request ─────────────   │
  │ ─────── Command Response ────────────►  │
  │                                         │
```

### 2.2 UI Connection

```
Endpoint: wss://{server}/ws/ui?token={jwt_token}
```

**Connection Flow:**
```
Browser                                  Server
  │                                         │
  │ ─────── WebSocket Connect ──────────►   │
  │         (JWT in query string)           │
  │                                         │
  │ ◄───── Connection Accepted ──────────   │
  │                                         │
  │ ◄───── Initial State ────────────────   │
  │         (satellite list)                │
  │                                         │
  │ ◄───── Real-time Events ─────────────   │
  │         (status changes, metrics)       │
  │                                         │
  │ ─────── Actions ─────────────────────►  │
  │         (session input, commands)       │
  │                                         │
```

---

## 3. Message Format

### 3.1 Base Message Structure

All messages follow this structure:

```typescript
interface Message {
  // Message type identifier
  type: string;
  
  // Request ID for request/response correlation
  request_id?: string;
  
  // Timestamp (ISO 8601)
  timestamp?: string;
  
  // Payload (varies by message type)
  [key: string]: any;
}
```

### 3.2 Message Encoding

- Format: JSON
- Encoding: UTF-8
- Binary data: Base64 encoded

---

## 4. Agent Protocol

### 4.1 Handshake (Agent → Server)

Sent immediately after WebSocket connection.

```json
{
  "type": "handshake",
  "agent_id": "sat_xxxxxxxxxxxx",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "version": "1.0.0",
  "protocol_version": "1",
  "system": {
    "hostname": "web-server-01",
    "os": "linux",
    "os_version": "Ubuntu 22.04.3 LTS",
    "arch": "x86_64",
    "kernel": "5.15.0-91-generic",
    "uptime_seconds": 86400,
    "cpu_cores": 4,
    "memory_total_mb": 8192,
    "memory_available_mb": 4096,
    "disk_total_gb": 100,
    "disk_available_gb": 45,
    "ip_addresses": [
      {"interface": "eth0", "ipv4": "192.168.1.100", "ipv6": "fe80::1"}
    ],
    "mac_addresses": [
      {"interface": "eth0", "mac": "00:11:22:33:44:55"}
    ]
  },
  "capabilities": ["shell", "pty", "power", "file_transfer", "metrics"],
  "tags": ["production", "web"],
  "name": "web-server-01"
}
```

### 4.2 Handshake Response (Server → Agent)

```json
// Success
{
  "type": "handshake_ack",
  "success": true,
  "server_time": "2026-02-05T05:42:00Z",
  "heartbeat_interval": 30,
  "config": {
    // Optional config updates
  }
}

// Failure
{
  "type": "handshake_ack",
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid or expired token"
  }
}
```

### 4.3 Heartbeat (Bidirectional)

**Server → Agent (Ping):**
```json
{
  "type": "heartbeat_ping",
  "timestamp": "2026-02-05T05:42:00Z"
}
```

**Agent → Server (Pong):**
```json
{
  "type": "heartbeat_pong",
  "timestamp": "2026-02-05T05:42:00Z",
  "metrics": {
    "cpu_percent": 15.5,
    "memory_percent": 50.2,
    "disk_percent": 55.0,
    "load_average": [0.5, 0.7, 0.8],
    "network_rx_bytes": 1234567890,
    "network_tx_bytes": 987654321,
    "active_sessions": 1
  }
}
```

### 4.4 Command Execution

**Server → Agent (Request):**
```json
{
  "type": "exec",
  "request_id": "req_xxxxxxxxxxxx",
  "command": "ls -la /var/log",
  "timeout_seconds": 30,
  "env": {
    "CUSTOM_VAR": "value"
  }
}
```

**Agent → Server (Response):**
```json
{
  "type": "exec_result",
  "request_id": "req_xxxxxxxxxxxx",
  "success": true,
  "exit_code": 0,
  "stdout": "total 12345\ndrwxr-xr-x...",
  "stderr": "",
  "duration_ms": 45,
  "truncated": false
}
```

### 4.5 PTY Session

**Start Session (Server → Agent):**
```json
{
  "type": "pty_start",
  "request_id": "req_xxxxxxxxxxxx",
  "session_id": "sess_xxxxxxxxxxxx",
  "shell": "/bin/bash",
  "cols": 120,
  "rows": 40,
  "env": {
    "TERM": "xterm-256color",
    "LANG": "en_US.UTF-8"
  }
}
```

**Start Response (Agent → Server):**
```json
{
  "type": "pty_started",
  "request_id": "req_xxxxxxxxxxxx",
  "session_id": "sess_xxxxxxxxxxxx",
  "success": true,
  "pid": 12345
}
```

**PTY Output (Agent → Server):**
```json
{
  "type": "pty_output",
  "session_id": "sess_xxxxxxxxxxxx",
  "data": "dXNlckB3ZWItc2VydmVyLTAxOn4kIA=="  // Base64
}
```

**PTY Input (Server → Agent):**
```json
{
  "type": "pty_input",
  "session_id": "sess_xxxxxxxxxxxx",
  "data": "bHMgLWxhCg=="  // Base64: "ls -la\n"
}
```

**PTY Resize (Server → Agent):**
```json
{
  "type": "pty_resize",
  "session_id": "sess_xxxxxxxxxxxx",
  "cols": 200,
  "rows": 50
}
```

**PTY End (Server → Agent):**
```json
{
  "type": "pty_end",
  "session_id": "sess_xxxxxxxxxxxx"
}
```

**PTY Ended (Agent → Server):**
```json
{
  "type": "pty_ended",
  "session_id": "sess_xxxxxxxxxxxx",
  "exit_code": 0,
  "reason": "exited"  // or "killed", "timeout", "error"
}
```

### 4.6 Power Commands

**Server → Agent:**
```json
{
  "type": "power",
  "request_id": "req_xxxxxxxxxxxx",
  "action": "reboot",  // shutdown, reboot, sleep, hibernate
  "delay_seconds": 60,
  "message": "Scheduled maintenance"
}
```

**Agent → Server:**
```json
{
  "type": "power_result",
  "request_id": "req_xxxxxxxxxxxx",
  "success": true,
  "message": "Reboot scheduled in 60 seconds"
}
```

### 4.7 Config Update

**Server → Agent:**
```json
{
  "type": "config_update",
  "request_id": "req_xxxxxxxxxxxx",
  "config": {
    "heartbeat_interval": 60,
    "logging_level": "debug"
  }
}
```

### 4.8 Agent Update

**Server → Agent:**
```json
{
  "type": "update",
  "request_id": "req_xxxxxxxxxxxx",
  "version": "1.1.0",
  "download_url": "https://hive.example.com/agent/download/1.1.0",
  "checksum": "sha256:abc123...",
  "force": false
}
```

---

## 5. UI Protocol

### 5.1 Initial State (Server → UI)

Sent immediately after connection:

```json
{
  "event": "initial_state",
  "data": {
    "satellites": [
      {
        "id": "sat_xxx",
        "name": "web-server-01",
        "status": "online",
        "system": { ... },
        "metrics": { ... },
        "tags": ["production", "web"]
      }
    ],
    "user": {
      "id": "user_xxx",
      "email": "admin@example.com",
      "roles": ["admin"]
    }
  }
}
```

### 5.2 Satellite Events (Server → UI)

```json
// Satellite online
{
  "event": "satellite:online",
  "data": {
    "id": "sat_xxx",
    "name": "web-server-01",
    "system": { ... }
  }
}

// Satellite offline
{
  "event": "satellite:offline",
  "data": {
    "id": "sat_xxx",
    "last_seen": "2026-02-05T05:42:00Z"
  }
}

// Metrics update
{
  "event": "satellite:metrics",
  "data": {
    "id": "sat_xxx",
    "metrics": {
      "cpu_percent": 45.2,
      "memory_percent": 62.1
    }
  }
}

// Satellite updated (name, tags, etc.)
{
  "event": "satellite:updated",
  "data": {
    "id": "sat_xxx",
    "changes": {
      "name": "new-name",
      "tags": ["new", "tags"]
    }
  }
}

// Satellite removed
{
  "event": "satellite:removed",
  "data": {
    "id": "sat_xxx"
  }
}
```

### 5.3 Session Events (Server → UI)

```json
// Session started
{
  "event": "session:started",
  "data": {
    "session_id": "sess_xxx",
    "satellite_id": "sat_xxx",
    "created_at": "2026-02-05T05:42:00Z"
  }
}

// Session output
{
  "event": "session:output",
  "data": {
    "session_id": "sess_xxx",
    "output": "dXNlckB3ZWItc2VydmVyLTAxOn4kIA=="  // Base64
  }
}

// Session ended
{
  "event": "session:ended",
  "data": {
    "session_id": "sess_xxx",
    "reason": "user_terminated",
    "exit_code": 0
  }
}
```

### 5.4 UI Actions (UI → Server)

```json
// Create session
{
  "action": "session:create",
  "request_id": "ui_req_xxx",
  "data": {
    "satellite_id": "sat_xxx",
    "cols": 120,
    "rows": 40
  }
}

// Session input
{
  "action": "session:input",
  "data": {
    "session_id": "sess_xxx",
    "input": "bHMgLWxhCg=="  // Base64
  }
}

// Session resize
{
  "action": "session:resize",
  "data": {
    "session_id": "sess_xxx",
    "cols": 200,
    "rows": 50
  }
}

// Close session
{
  "action": "session:close",
  "data": {
    "session_id": "sess_xxx"
  }
}

// Subscribe to satellites
{
  "action": "subscribe",
  "data": {
    "satellites": ["sat_xxx", "sat_yyy"]  // or ["*"] for all
  }
}

// Unsubscribe
{
  "action": "unsubscribe",
  "data": {
    "satellites": ["sat_xxx"]
  }
}
```

### 5.5 Action Responses (Server → UI)

```json
// Success
{
  "event": "action:result",
  "request_id": "ui_req_xxx",
  "success": true,
  "data": {
    "session_id": "sess_xxx"
  }
}

// Failure
{
  "event": "action:result",
  "request_id": "ui_req_xxx",
  "success": false,
  "error": {
    "code": "SATELLITE_OFFLINE",
    "message": "Satellite is not connected"
  }
}
```

---

## 6. Error Messages

### 6.1 Error Structure

```json
{
  "type": "error",
  "request_id": "req_xxx",  // If applicable
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }  // Optional additional info
  }
}
```

### 6.2 Error Codes

| Code | Description |
|------|-------------|
| `AUTH_FAILED` | Authentication failed |
| `AUTH_EXPIRED` | Token expired |
| `FORBIDDEN` | Permission denied |
| `NOT_FOUND` | Resource not found |
| `INVALID_MESSAGE` | Malformed message |
| `INVALID_TYPE` | Unknown message type |
| `SATELLITE_OFFLINE` | Satellite not connected |
| `SESSION_NOT_FOUND` | Session doesn't exist |
| `COMMAND_TIMEOUT` | Command timed out |
| `COMMAND_BLOCKED` | Command blocked by policy |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

---

## 7. Protocol Versioning

### 7.1 Version Negotiation

The handshake includes protocol version:

```json
{
  "type": "handshake",
  "protocol_version": "1",
  // ...
}
```

Server responds with supported version:

```json
{
  "type": "handshake_ack",
  "protocol_version": "1",
  // ...
}
```

### 7.2 Version Compatibility

| Protocol Version | Changes |
|-----------------|---------|
| 1 | Initial version |

---

## 8. Connection Management

### 8.1 Keep-Alive

- WebSocket ping/pong frames for connection health
- Application-level heartbeats every 30 seconds (configurable)
- Connection considered dead after 3 missed heartbeats

### 8.2 Reconnection

Agents should implement exponential backoff:

```
Attempt 1: 1 second
Attempt 2: 2 seconds
Attempt 3: 4 seconds
Attempt 4: 8 seconds
...
Maximum: 300 seconds (5 minutes)
```

### 8.3 Graceful Shutdown

**Agent → Server (before disconnect):**
```json
{
  "type": "disconnect",
  "reason": "shutdown"  // or "update", "restart"
}
```

---

## 9. Security

### 9.1 TLS Requirements

- Minimum: TLS 1.2
- Recommended: TLS 1.3
- Certificate validation required (no self-signed in production)

### 9.2 Token Refresh

Agents can request new tokens:

```json
// Agent → Server
{
  "type": "token_refresh",
  "current_token": "eyJ..."
}

// Server → Agent
{
  "type": "token_refresh_result",
  "success": true,
  "new_token": "eyJ...",
  "expires_at": "2026-03-05T05:42:00Z"
}
```

---

## 10. Message Size Limits

| Context | Limit |
|---------|-------|
| General message | 1 MB |
| Command stdout/stderr | 10 MB |
| PTY output chunk | 64 KB |
| File transfer chunk | 1 MB |

Messages exceeding limits will be rejected or truncated.

---

## 11. Flow Control

### 11.1 PTY Output Throttling

If the UI can't keep up with PTY output:

```json
// UI → Server
{
  "action": "session:throttle",
  "data": {
    "session_id": "sess_xxx",
    "pause": true
  }
}
```

### 11.2 Backpressure

Server may send:

```json
{
  "event": "backpressure",
  "data": {
    "delay_ms": 100
  }
}
```

Clients should delay subsequent messages.

---

## 12. Future Extensions

- Binary message support for efficiency
- Message compression (gzip, zstd)
- Multiplexed streams
- QUIC transport option

