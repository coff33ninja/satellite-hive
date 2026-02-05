# Satellite Agent Specification

> The lightweight daemon running on managed devices

---

## 1. Overview

The Satellite Agent is a cross-platform daemon that runs on each managed device in the hive. It maintains a persistent connection to the central server and executes commands on behalf of authorized users and AI systems.

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement |
|----|-------------|
| SA-F01 | Agent MUST connect to central server on startup |
| SA-F02 | Agent MUST automatically reconnect on connection loss |
| SA-F03 | Agent MUST send periodic heartbeats (configurable interval) |
| SA-F04 | Agent MUST execute shell commands and return output |
| SA-F05 | Agent MUST support interactive PTY sessions |
| SA-F06 | Agent MUST execute system commands (shutdown, reboot) |
| SA-F07 | Agent MUST report system information on handshake |
| SA-F08 | Agent MUST support self-update when instructed |
| SA-F09 | Agent SHOULD run as a system service (daemon) |
| SA-F10 | Agent SHOULD support Windows, Linux, and macOS |

### 2.2 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| SA-N01 | Memory usage SHOULD be < 50MB idle |
| SA-N02 | CPU usage SHOULD be < 1% idle |
| SA-N03 | Binary size SHOULD be < 20MB |
| SA-N04 | Startup time SHOULD be < 2 seconds |
| SA-N05 | Reconnect attempts MUST use exponential backoff |

---

## 3. Configuration

Configuration is embedded at build/provision time. The agent reads from:
1. Embedded config (highest priority, immutable)
2. Config file: `satellite.yaml` or `satellite.json`
3. Environment variables (prefix: `SATELLITE_`)

### 3.1 Configuration Schema

```yaml
# satellite.yaml
server:
  url: "wss://hive.example.com/agent"
  # Alternative URLs for failover
  fallback_urls:
    - "wss://hive-backup.example.com/agent"

agent:
  # Unique identifier (auto-generated if not set)
  id: "sat_xxxxxxxxxxxx"
  # Authentication token (provisioned by server)
  token: "eyJhbGciOiJIUzI1NiIs..."
  # Human-readable name
  name: "web-server-01"
  # Tags for grouping
  tags:
    - production
    - web
    - us-east-1

heartbeat:
  # Interval in seconds
  interval: 30
  # Timeout before considering connection dead
  timeout: 10

reconnect:
  # Initial delay in seconds
  initial_delay: 1
  # Maximum delay (exponential backoff cap)
  max_delay: 300
  # Maximum attempts (0 = infinite)
  max_attempts: 0

shell:
  # Default shell for command execution
  # Auto-detected if not set
  default: "/bin/bash"  # or "powershell.exe" on Windows
  
  # Environment variables to set for all commands
  env:
    SATELLITE_MANAGED: "true"

security:
  # Allow shutdown/reboot commands
  allow_power_commands: true
  # Allow arbitrary shell execution
  allow_shell: true
  # Allowed command prefixes (empty = allow all)
  allowed_commands: []
  # Blocked command prefixes
  blocked_commands:
    - "rm -rf /"
    - "format"

logging:
  # Log level: debug, info, warn, error
  level: "info"
  # Log file path (empty = stdout only)
  file: "/var/log/satellite-agent.log"
  # Max log file size in MB
  max_size: 100
  # Number of rotated files to keep
  max_backups: 3
```

---

## 4. Lifecycle

### 4.1 Startup Sequence

```
┌─────────────────┐
│   Agent Start   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Load Config    │
│  (embedded +    │
│   file + env)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Collect System  │
│    Info         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Connect to      │◄──────────────┐
│ Central Server  │               │
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐    Fail       │
│   Handshake     │───────────────┤
│   (register)    │               │
└────────┬────────┘               │
         │ Success                │
         ▼                        │
┌─────────────────┐               │
│  Main Loop      │               │
│  - Heartbeat    │               │
│  - Cmd handling │               │
└────────┬────────┘               │
         │ Disconnect             │
         └────────────────────────┘
```

### 4.2 Handshake Payload

Sent immediately after WebSocket connection established:

```json
{
  "type": "handshake",
  "agent_id": "sat_xxxxxxxxxxxx",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "version": "1.0.0",
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
      {"interface": "eth0", "ipv4": "192.168.1.100", "ipv6": "fe80::1"},
      {"interface": "lo", "ipv4": "127.0.0.1", "ipv6": "::1"}
    ],
    "mac_addresses": [
      {"interface": "eth0", "mac": "00:11:22:33:44:55"}
    ]
  },
  "capabilities": [
    "shell",
    "pty",
    "power",
    "file_transfer",
    "metrics"
  ],
  "tags": ["production", "web", "us-east-1"],
  "name": "web-server-01"
}
```

### 4.3 Heartbeat

Sent at configured interval:

```json
{
  "type": "heartbeat",
  "agent_id": "sat_xxxxxxxxxxxx",
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

---

## 5. Command Handling

### 5.1 Command Types

| Type | Description |
|------|-------------|
| `exec` | Execute a one-shot command, return output |
| `pty_start` | Start an interactive PTY session |
| `pty_input` | Send input to active PTY session |
| `pty_resize` | Resize PTY dimensions |
| `pty_end` | Terminate PTY session |
| `power` | System power commands (shutdown, reboot) |
| `update` | Self-update the agent |
| `config` | Update runtime configuration |

### 5.2 Exec Command

**Request:**
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

**Response:**
```json
{
  "type": "exec_result",
  "request_id": "req_xxxxxxxxxxxx",
  "exit_code": 0,
  "stdout": "total 12345\ndrwxr-xr-x...",
  "stderr": "",
  "duration_ms": 45,
  "truncated": false
}
```

### 5.3 PTY Session

**Start PTY:**
```json
{
  "type": "pty_start",
  "session_id": "sess_xxxxxxxxxxxx",
  "shell": "/bin/bash",
  "cols": 120,
  "rows": 40,
  "env": {
    "TERM": "xterm-256color"
  }
}
```

**PTY Output (streamed):**
```json
{
  "type": "pty_output",
  "session_id": "sess_xxxxxxxxxxxx",
  "data": "base64_encoded_output"
}
```

**PTY Input:**
```json
{
  "type": "pty_input",
  "session_id": "sess_xxxxxxxxxxxx",
  "data": "base64_encoded_input"
}
```

**PTY Resize:**
```json
{
  "type": "pty_resize",
  "session_id": "sess_xxxxxxxxxxxx",
  "cols": 200,
  "rows": 50
}
```

### 5.4 Power Commands

**Request:**
```json
{
  "type": "power",
  "request_id": "req_xxxxxxxxxxxx",
  "action": "shutdown",  // or "reboot", "sleep", "hibernate"
  "delay_seconds": 60,
  "message": "Scheduled maintenance"
}
```

**Response:**
```json
{
  "type": "power_result",
  "request_id": "req_xxxxxxxxxxxx",
  "success": true,
  "message": "Shutdown scheduled in 60 seconds"
}
```

---

## 6. Error Handling

### 6.1 Error Response Format

```json
{
  "type": "error",
  "request_id": "req_xxxxxxxxxxxx",
  "code": "COMMAND_TIMEOUT",
  "message": "Command execution timed out after 30 seconds",
  "details": {
    "partial_stdout": "...",
    "partial_stderr": "..."
  }
}
```

### 6.2 Error Codes

| Code | Description |
|------|-------------|
| `AUTH_FAILED` | Authentication/token invalid |
| `COMMAND_TIMEOUT` | Command execution timed out |
| `COMMAND_BLOCKED` | Command blocked by security policy |
| `PERMISSION_DENIED` | Insufficient permissions |
| `SESSION_NOT_FOUND` | PTY session does not exist |
| `RESOURCE_EXHAUSTED` | Too many sessions or resource limit hit |
| `INTERNAL_ERROR` | Unexpected agent error |

---

## 7. Security Considerations

### 7.1 Command Filtering

The agent implements a security filter for commands:

```go
func isCommandAllowed(cmd string) bool {
    // Check blocked commands first
    for _, blocked := range config.Security.BlockedCommands {
        if strings.HasPrefix(cmd, blocked) {
            return false
        }
    }
    
    // If allowed list is empty, allow all (except blocked)
    if len(config.Security.AllowedCommands) == 0 {
        return true
    }
    
    // Check allowed commands
    for _, allowed := range config.Security.AllowedCommands {
        if strings.HasPrefix(cmd, allowed) {
            return true
        }
    }
    
    return false
}
```

### 7.2 Token Security

- Tokens are stored encrypted at rest (using OS keychain where available)
- Tokens are never logged
- Token rotation supported via `config` command

---

## 8. Platform-Specific Notes

### 8.1 Linux

- Runs as systemd service
- Uses `/dev/ptmx` for PTY
- Power commands via `systemctl` or direct syscalls
- Config stored in `/etc/satellite/`
- Logs to `/var/log/satellite/`

### 8.2 Windows

- Runs as Windows Service
- Uses ConPTY for pseudo-terminal
- Power commands via `shutdown.exe` or Win32 API
- Config stored in `%ProgramData%\Satellite\`
- Logs to `%ProgramData%\Satellite\logs\`

### 8.3 macOS

- Runs as launchd daemon
- Uses `/dev/ptmx` for PTY
- Power commands via `osascript` or direct syscalls
- Config stored in `/Library/Application Support/Satellite/`
- Logs to `/Library/Logs/Satellite/`

---

## 9. Build & Distribution

### 9.1 Provisioning Flow

```
┌──────────────────┐     ┌──────────────────┐
│     Web UI       │     │  Central Server  │
│  (User clicks    │────►│  Generate agent  │
│   "Download")    │     │  with embedded   │
└──────────────────┘     │  config          │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  Binary with:    │
                         │  - Server URL    │
                         │  - Agent ID      │
                         │  - Auth token    │
                         │  - Tags          │
                         └──────────────────┘
```

### 9.2 Embedded Config

Config is embedded at build time:

```go
// Embedded at build time via ldflags
var (
    EmbeddedServerURL = ""
    EmbeddedAgentID   = ""
    EmbeddedToken     = ""
    EmbeddedTags      = ""
)
```

Build command:
```bash
go build -ldflags "-X main.EmbeddedServerURL=wss://... -X main.EmbeddedAgentID=sat_xxx -X main.EmbeddedToken=eyJ..." -o satellite-agent
```

---

## 10. Metrics & Observability

### 10.1 Exposed Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `satellite_uptime_seconds` | Gauge | Agent uptime |
| `satellite_connection_status` | Gauge | 1 = connected, 0 = disconnected |
| `satellite_reconnect_total` | Counter | Number of reconnection attempts |
| `satellite_commands_total` | Counter | Total commands executed |
| `satellite_command_duration_seconds` | Histogram | Command execution duration |
| `satellite_pty_sessions_active` | Gauge | Active PTY sessions |
| `satellite_heartbeat_latency_ms` | Gauge | Last heartbeat round-trip time |

### 10.2 Health Check

Local health endpoint (optional, disabled by default):

```
GET http://localhost:9847/health
```

Response:
```json
{
  "status": "healthy",
  "connected": true,
  "uptime_seconds": 86400,
  "version": "1.0.0"
}
```

---

## 11. Future Enhancements

- [ ] File transfer support (upload/download)
- [ ] Plugin system for custom commands
- [ ] Local caching of commands for offline operation
- [ ] Wake-on-LAN support
- [ ] Hardware inventory reporting
- [ ] Process monitoring and auto-restart

