# MCP Server Specification

> AI integration via Model Context Protocol

---

## 1. Overview

The MCP (Model Context Protocol) Server exposes the Satellite Hive functionality to AI systems. This enables AI-powered fleet management, automated operations, and intelligent command execution across the hive.

---

## 2. MCP Basics

The Model Context Protocol defines three primary primitives:

| Primitive | Description |
|-----------|-------------|
| **Tools** | Functions the AI can call to perform actions |
| **Resources** | Data the AI can read (devices, logs, etc.) |
| **Prompts** | Pre-defined templates for common operations |

---

## 3. Transport

### 3.1 stdio Transport (Default)

The MCP server runs as a subprocess, communicating via stdin/stdout.

**Launch command:**
```bash
satellite-hive-server --mcp
```

**MCP Client Configuration (e.g., Claude Desktop):**
```json
{
  "mcpServers": {
    "satellite-hive": {
      "command": "satellite-hive-server",
      "args": ["--mcp"],
      "env": {
        "HIVE_CONFIG": "/path/to/server.yaml"
      }
    }
  }
}
```

### 3.2 HTTP Transport (Optional)

For web-based AI integrations:

```
POST /mcp/v1/tools/call
POST /mcp/v1/resources/read
```

---

## 4. Tools

### 4.1 Tool: `list_satellites`

List all satellites in the hive with optional filtering.

**Schema:**
```json
{
  "name": "list_satellites",
  "description": "List all satellites in the hive. Can filter by status, tags, or search query.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": ["online", "offline", "all"],
        "default": "all",
        "description": "Filter by connection status"
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Filter by tags (AND logic)"
      },
      "search": {
        "type": "string",
        "description": "Search by name or hostname"
      },
      "limit": {
        "type": "number",
        "default": 50,
        "description": "Maximum results to return"
      }
    }
  }
}
```

**Example Call:**
```json
{
  "name": "list_satellites",
  "arguments": {
    "status": "online",
    "tags": ["production", "web"]
  }
}
```

**Example Response:**
```json
{
  "satellites": [
    {
      "id": "sat_abc123",
      "name": "web-server-01",
      "status": "online",
      "hostname": "web-server-01.example.com",
      "os": "linux",
      "tags": ["production", "web", "us-east-1"],
      "last_seen": "2026-02-05T05:42:00Z",
      "metrics": {
        "cpu_percent": 45.2,
        "memory_percent": 62.1
      }
    }
  ],
  "total": 1
}
```

---

### 4.2 Tool: `get_satellite`

Get detailed information about a specific satellite.

**Schema:**
```json
{
  "name": "get_satellite",
  "description": "Get detailed information about a specific satellite by ID or name.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "Satellite ID (sat_xxx) or name"
      }
    },
    "required": ["id"]
  }
}
```

**Example Response:**
```json
{
  "id": "sat_abc123",
  "name": "web-server-01",
  "status": "online",
  "system": {
    "hostname": "web-server-01.example.com",
    "os": "linux",
    "os_version": "Ubuntu 22.04.3 LTS",
    "arch": "x86_64",
    "kernel": "5.15.0-91-generic",
    "uptime_seconds": 864000,
    "cpu_cores": 8,
    "memory_total_mb": 16384,
    "memory_available_mb": 6144,
    "disk_total_gb": 500,
    "disk_available_gb": 234,
    "ip_addresses": [
      {"interface": "eth0", "ipv4": "192.168.1.100"}
    ]
  },
  "capabilities": ["shell", "pty", "power", "metrics"],
  "tags": ["production", "web", "us-east-1"],
  "first_seen": "2026-01-15T10:30:00Z",
  "last_seen": "2026-02-05T05:42:00Z",
  "active_sessions": 0,
  "metrics": {
    "cpu_percent": 45.2,
    "memory_percent": 62.1,
    "disk_percent": 53.2,
    "load_average": [2.1, 1.8, 1.5]
  }
}
```

---

### 4.3 Tool: `execute_command`

Execute a shell command on one or more satellites.

**Schema:**
```json
{
  "name": "execute_command",
  "description": "Execute a shell command on one or more satellites. Use with caution - commands are executed with the agent's privileges.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "targets": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Satellite IDs or names. Can also use 'tag:production' syntax."
      },
      "command": {
        "type": "string",
        "description": "The shell command to execute"
      },
      "timeout_seconds": {
        "type": "number",
        "default": 30,
        "description": "Command timeout in seconds"
      },
      "env": {
        "type": "object",
        "additionalProperties": { "type": "string" },
        "description": "Environment variables to set"
      }
    },
    "required": ["targets", "command"]
  }
}
```

**Example Call:**
```json
{
  "name": "execute_command",
  "arguments": {
    "targets": ["tag:production"],
    "command": "df -h /",
    "timeout_seconds": 10
  }
}
```

**Example Response:**
```json
{
  "results": [
    {
      "satellite_id": "sat_abc123",
      "satellite_name": "web-server-01",
      "success": true,
      "exit_code": 0,
      "stdout": "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       500G  266G  234G  53% /\n",
      "stderr": "",
      "duration_ms": 45
    },
    {
      "satellite_id": "sat_def456",
      "satellite_name": "web-server-02",
      "success": true,
      "exit_code": 0,
      "stdout": "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       500G  312G  188G  63% /\n",
      "stderr": "",
      "duration_ms": 52
    }
  ],
  "summary": {
    "total": 2,
    "succeeded": 2,
    "failed": 0
  }
}
```

---

### 4.4 Tool: `power_command`

Send power commands (shutdown, reboot) to satellites.

**Schema:**
```json
{
  "name": "power_command",
  "description": "Send power commands to satellites. DANGEROUS - use with extreme caution. Requires explicit confirmation.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "targets": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Satellite IDs or names"
      },
      "action": {
        "type": "string",
        "enum": ["shutdown", "reboot", "sleep", "hibernate"],
        "description": "Power action to perform"
      },
      "delay_seconds": {
        "type": "number",
        "default": 60,
        "description": "Delay before action (gives time to cancel)"
      },
      "message": {
        "type": "string",
        "description": "Message to display to logged-in users"
      },
      "confirm": {
        "type": "boolean",
        "description": "Must be true to execute. Safety check."
      }
    },
    "required": ["targets", "action", "confirm"]
  }
}
```

**Example Call:**
```json
{
  "name": "power_command",
  "arguments": {
    "targets": ["sat_abc123"],
    "action": "reboot",
    "delay_seconds": 60,
    "message": "Scheduled maintenance reboot",
    "confirm": true
  }
}
```

---

### 4.5 Tool: `create_session`

Create an interactive terminal session to a satellite.

**Schema:**
```json
{
  "name": "create_session",
  "description": "Create an interactive terminal session to a satellite. Returns a session ID for use with session_input and session_read tools.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "satellite_id": {
        "type": "string",
        "description": "Satellite ID or name"
      },
      "shell": {
        "type": "string",
        "description": "Shell to use (default: system default)"
      },
      "cols": {
        "type": "number",
        "default": 120,
        "description": "Terminal width"
      },
      "rows": {
        "type": "number",
        "default": 40,
        "description": "Terminal height"
      }
    },
    "required": ["satellite_id"]
  }
}
```

**Example Response:**
```json
{
  "session_id": "sess_xyz789",
  "satellite_id": "sat_abc123",
  "created_at": "2026-02-05T05:42:00Z",
  "status": "active"
}
```

---

### 4.6 Tool: `session_input`

Send input to an active terminal session.

**Schema:**
```json
{
  "name": "session_input",
  "description": "Send input (keystrokes) to an active terminal session.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "session_id": {
        "type": "string",
        "description": "Session ID from create_session"
      },
      "input": {
        "type": "string",
        "description": "Text to send (use \\n for Enter, \\t for Tab)"
      }
    },
    "required": ["session_id", "input"]
  }
}
```

---

### 4.7 Tool: `session_read`

Read output from an active terminal session.

**Schema:**
```json
{
  "name": "session_read",
  "description": "Read recent output from an active terminal session.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "session_id": {
        "type": "string",
        "description": "Session ID from create_session"
      },
      "wait_ms": {
        "type": "number",
        "default": 500,
        "description": "Wait time for output (milliseconds)"
      }
    },
    "required": ["session_id"]
  }
}
```

**Example Response:**
```json
{
  "session_id": "sess_xyz789",
  "output": "user@web-server-01:~$ ls\napp  config  logs  scripts\nuser@web-server-01:~$ ",
  "status": "active"
}
```

---

### 4.8 Tool: `close_session`

Close an active terminal session.

**Schema:**
```json
{
  "name": "close_session",
  "description": "Close an active terminal session.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "session_id": {
        "type": "string",
        "description": "Session ID to close"
      }
    },
    "required": ["session_id"]
  }
}
```

---

### 4.9 Tool: `provision_agent`

Generate a new pre-configured agent for deployment.

**Schema:**
```json
{
  "name": "provision_agent",
  "description": "Generate a pre-configured agent binary for a new satellite.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Name for the new satellite"
      },
      "tags": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Tags to assign"
      },
      "platform": {
        "type": "object",
        "properties": {
          "os": {
            "type": "string",
            "enum": ["linux", "windows", "darwin"]
          },
          "arch": {
            "type": "string",
            "enum": ["amd64", "arm64"]
          }
        },
        "required": ["os", "arch"]
      }
    },
    "required": ["name", "platform"]
  }
}
```

**Example Response:**
```json
{
  "agent_id": "sat_new123",
  "download_url": "https://hive.example.com/api/v1/provision/download/tok_xxx",
  "download_token": "tok_xxx",
  "expires_at": "2026-02-06T05:42:00Z",
  "install_command": {
    "linux": "curl -fsSL https://hive.example.com/api/v1/provision/download/tok_xxx | sudo bash",
    "windows": "irm https://hive.example.com/api/v1/provision/download/tok_xxx | iex",
    "darwin": "curl -fsSL https://hive.example.com/api/v1/provision/download/tok_xxx | bash"
  }
}
```

---

### 4.10 Tool: `get_audit_logs`

Query audit logs for compliance and debugging.

**Schema:**
```json
{
  "name": "get_audit_logs",
  "description": "Query audit logs for actions performed on satellites.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "satellite_id": {
        "type": "string",
        "description": "Filter by satellite ID"
      },
      "actor": {
        "type": "string",
        "description": "Filter by actor (user ID or 'mcp')"
      },
      "action": {
        "type": "string",
        "description": "Filter by action type"
      },
      "since": {
        "type": "string",
        "format": "date-time",
        "description": "Start time (ISO 8601)"
      },
      "until": {
        "type": "string",
        "format": "date-time",
        "description": "End time (ISO 8601)"
      },
      "limit": {
        "type": "number",
        "default": 50
      }
    }
  }
}
```

---

## 5. Resources

### 5.1 Resource: `satellite://{id}`

Read detailed satellite information.

**URI Template:** `satellite://{satellite_id}`

**Example:** `satellite://sat_abc123`

**Contents:**
```json
{
  "uri": "satellite://sat_abc123",
  "mimeType": "application/json",
  "text": "{\"id\":\"sat_abc123\",\"name\":\"web-server-01\",...}"
}
```

---

### 5.2 Resource: `satellites://list`

Read the list of all satellites.

**URI:** `satellites://list`

---

### 5.3 Resource: `metrics://{satellite_id}`

Read current metrics for a satellite.

**URI Template:** `metrics://{satellite_id}`

**Contents:**
```json
{
  "cpu_percent": 45.2,
  "memory_percent": 62.1,
  "disk_percent": 53.2,
  "load_average": [2.1, 1.8, 1.5],
  "network_rx_bytes": 1234567890,
  "network_tx_bytes": 987654321,
  "timestamp": "2026-02-05T05:42:00Z"
}
```

---

### 5.4 Resource: `audit://recent`

Read recent audit log entries.

**URI:** `audit://recent?limit=50`

---

## 6. Prompts

### 6.1 Prompt: `fleet_status`

Get an overview of fleet health.

**Schema:**
```json
{
  "name": "fleet_status",
  "description": "Generate a summary of fleet health and status",
  "arguments": []
}
```

**Generated Prompt:**
```
Please analyze the current status of the satellite fleet and provide:
1. Total satellites (online vs offline)
2. Any satellites with high resource usage (CPU > 80%, Memory > 80%, Disk > 90%)
3. Any satellites that haven't checked in recently
4. Summary of tags/groups distribution

Use the list_satellites tool to gather this information.
```

---

### 6.2 Prompt: `troubleshoot`

Troubleshoot a specific satellite.

**Schema:**
```json
{
  "name": "troubleshoot",
  "description": "Troubleshoot issues on a specific satellite",
  "arguments": [
    {
      "name": "satellite",
      "description": "Satellite ID or name",
      "required": true
    },
    {
      "name": "issue",
      "description": "Description of the issue",
      "required": false
    }
  ]
}
```

**Generated Prompt:**
```
Troubleshoot the satellite "{satellite}":
{issue ? "Reported issue: " + issue : ""}

Steps:
1. Get satellite details using get_satellite
2. Check current metrics
3. Execute diagnostic commands:
   - Check disk space: df -h
   - Check memory: free -m
   - Check running processes: ps aux --sort=-%mem | head -20
   - Check recent logs: journalctl -n 50 --no-pager
4. Analyze results and provide recommendations
```

---

### 6.3 Prompt: `deploy_update`

Deploy an update across the fleet.

**Schema:**
```json
{
  "name": "deploy_update",
  "description": "Help deploy an update across multiple satellites",
  "arguments": [
    {
      "name": "targets",
      "description": "Target satellites (IDs, names, or tags)",
      "required": true
    },
    {
      "name": "command",
      "description": "Update command to run",
      "required": true
    }
  ]
}
```

---

## 7. Error Handling

### 7.1 Tool Errors

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "Error: Satellite 'sat_abc123' is offline. Last seen: 2026-02-05T04:30:00Z"
    }
  ]
}
```

### 7.2 Error Codes

| Code | Description |
|------|-------------|
| `SATELLITE_NOT_FOUND` | Satellite does not exist |
| `SATELLITE_OFFLINE` | Satellite is not connected |
| `SESSION_NOT_FOUND` | Session does not exist |
| `COMMAND_TIMEOUT` | Command timed out |
| `PERMISSION_DENIED` | Action not allowed |
| `INVALID_ARGUMENTS` | Invalid tool arguments |

---

## 8. Safety Considerations

### 8.1 Dangerous Operations

The following tools require extra confirmation:
- `power_command` - Requires `confirm: true`
- `execute_command` with destructive commands - Should prompt user

### 8.2 Rate Limiting

- Tools are rate-limited to prevent abuse
- Default: 60 tool calls per minute
- `execute_command`: 30 calls per minute
- `power_command`: 5 calls per minute

### 8.3 Audit Trail

All MCP tool calls are logged with:
- Timestamp
- Tool name and arguments
- Actor: `mcp`
- Result (success/failure)

---

## 9. Implementation

### 9.1 TypeScript Implementation

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "satellite-hive",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_satellites",
      description: "List all satellites in the hive",
      inputSchema: { /* ... */ }
    },
    // ... more tools
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case "list_satellites":
      return handleListSatellites(args);
    case "execute_command":
      return handleExecuteCommand(args);
    // ... more handlers
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 10. Future Enhancements

- [ ] Streaming tool responses for long-running commands
- [ ] Tool annotations for cost/risk estimation
- [ ] Multi-step tool workflows
- [ ] Custom tool definitions via plugins
- [ ] Resource subscriptions for real-time updates

