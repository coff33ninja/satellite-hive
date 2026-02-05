# Testing Satellite Hive - Complete Guide

> **⚠️ NOTICE:** This is a generated skeleton. Comprehensive testing in progress. Results may vary.

**Repository:** https://github.com/coff33ninja/satellite-hive

## Quick Start (3 Steps)

### 1. Start the Central Server

```bash
cd central-server
npm install
npm run db:migrate
npm run dev
```

✅ Server running on http://localhost:3000

### 2. Start a Satellite Agent

In a new terminal:

```bash
cd satellite-agent
go mod download
go run . --server ws://localhost:3000/ws/agent --name "test-agent-1"
```

✅ Agent connected and sending heartbeats

### 3. Open Web UI

Open http://localhost:3000 in your browser

Login with:
- Email: `admin@example.com`
- Password: `admin123`

✅ You should see your agent in the dashboard!

## Feature Testing

### ✅ Test Command Execution

#### Via API:
```bash
# 1. Login and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.token')

# 2. List satellites
curl -s http://localhost:3000/api/v1/satellites \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. Get satellite ID
SATELLITE_ID=$(curl -s http://localhost:3000/api/v1/satellites \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[0].id')

# 4. Execute command
curl -X POST http://localhost:3000/api/v1/satellites/$SATELLITE_ID/exec \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"echo Hello from satellite && uptime"}' | jq
```

Expected: Command executes and returns stdout/stderr

### ✅ Test Interactive Terminal

1. Open Web UI at http://localhost:3000
2. Click "Terminal" button on any online satellite
3. Type commands interactively
4. Try: `ls`, `pwd`, `echo test`, `top` (Ctrl+C to exit)

Expected: Full interactive terminal experience

### ✅ Test MCP Integration

#### Setup:
```bash
cd central-server
npm run mcp
```

#### Configure Claude Desktop:

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent:

```json
{
  "mcpServers": {
    "satellite-hive": {
      "command": "node",
      "args": ["path/to/satellite-hive/central-server/dist/mcp/index.js"]
    }
  }
}
```

#### Test in Claude:

Ask Claude:
- "List all satellites in the hive"
- "Execute 'df -h' on all satellites"
- "Get detailed info about satellite sat_xxx"

Expected: Claude can manage your fleet via MCP tools

### ✅ Test Real-time Updates

1. Open Web UI in browser
2. Start a new agent in terminal
3. Watch it appear in the dashboard in real-time
4. Stop the agent (Ctrl+C)
5. Watch it go offline in the dashboard

Expected: Instant status updates via WebSocket

### ✅ Test Security Features

#### Rate Limiting:
```bash
# Try to login 10 times rapidly
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"wrong"}' &
done
```

Expected: After 5 attempts, you get rate limited (429 error)

#### JWT Expiration:
```bash
# Use an invalid token
curl http://localhost:3000/api/v1/satellites \
  -H "Authorization: Bearer invalid_token"
```

Expected: 401 Unauthorized error

## What's Working

### ✅ Core Infrastructure
- HTTP/HTTPS server with Hono
- WebSocket connections (agents + UI)
- SQLite database with migrations
- JWT authentication
- Rate limiting
- Secure headers
- CORS configuration

### ✅ Agent Features
- Handshake and registration
- Heartbeat with metrics
- System information collection
- Command execution (shell)
- PTY terminal sessions
- Auto-reconnect on disconnect

### ✅ Server Features
- Device registry
- Session management
- Audit logging
- Command routing
- Real-time WebSocket broadcasts

### ✅ Web UI
- Login/authentication
- Dashboard with satellite list
- Real-time status updates
- Interactive terminal with xterm.js
- Responsive design

### ✅ MCP Integration
- stdio transport
- list_satellites tool
- get_satellite tool
- execute_command tool

### ✅ Security
- TLS/HTTPS support
- Password hashing (bcrypt)
- JWT tokens
- Rate limiting
- Secure headers
- Token-based agent auth

## Common Issues & Solutions

### Agent won't connect

**Problem:** `Connection failed: dial tcp: connection refused`

**Solution:**
1. Make sure server is running
2. Check server URL is correct
3. Verify firewall allows port 3000

### Web UI shows no satellites

**Problem:** Dashboard is empty

**Solution:**
1. Check agent is running and connected
2. Look at server logs for connection messages
3. Refresh the page
4. Check browser console for WebSocket errors

### Terminal not working

**Problem:** Terminal shows "Disconnected"

**Solution:**
1. Verify satellite is online (green dot)
2. Check browser console for errors
3. Ensure WebSocket connection is established
4. Try refreshing the page

### Command execution timeout

**Problem:** Commands take too long

**Solution:**
1. Increase timeout in request: `{"timeout_seconds": 60}`
2. Check agent logs for errors
3. Verify command is valid on target OS

## Performance Testing

### Load Test - Multiple Agents

```bash
# Start 10 agents
for i in {1..10}; do
  go run . --server ws://localhost:3000/ws/agent --name "agent-$i" &
done
```

Expected: All agents connect and send heartbeats

### Stress Test - Rapid Commands

```bash
# Execute 100 commands
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/v1/satellites/$SATELLITE_ID/exec \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"command":"echo test"}' &
done
```

Expected: All commands execute successfully

## Database Inspection

```bash
# Install sqlite3
# macOS: brew install sqlite3
# Ubuntu: apt install sqlite3

# Open database
sqlite3 central-server/data/hive.db

# Useful queries
.tables
SELECT * FROM satellites;
SELECT * FROM sessions;
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10;
.quit
```

## Logs

### Server Logs
Watch server terminal for:
- `[AgentHub] Satellite sat_xxx connected`
- `[AgentHub] Exec result from sat_xxx`
- `[UIHub] UI disconnected`

### Agent Logs
Watch agent terminal for:
- `Connected!`
- `✅ Handshake successful!`
- `Received heartbeat ping`
- `Executing command: ...`

## Next Steps

Now that everything is working, you can:

1. **Deploy to Production** - See docs/08-deployment.md
2. **Enable TLS** - Configure certificates in server.yaml
3. **Add More Agents** - Deploy to your fleet
4. **Integrate with AI** - Use MCP tools in Claude
5. **Customize** - Modify code to fit your needs

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Dashboard  │  │  Terminal  │  │   Login    │            │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘            │
└────────┼───────────────┼───────────────┼────────────────────┘
         │ WebSocket     │ WebSocket     │ HTTP
         │               │               │
┌────────┼───────────────┼───────────────┼────────────────────┐
│        ▼               ▼               ▼                     │
│  ┌─────────────────────────────────────────────┐            │
│  │          Central Server (Node.js)           │            │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │            │
│  │  │ UI Hub   │  │Agent Hub │  │ REST API │  │            │
│  │  └──────────┘  └──────────┘  └──────────┘  │            │
│  │  ┌──────────────────────────────────────┐  │            │
│  │  │  Device Registry | Session Manager  │  │            │
│  │  └──────────────────────────────────────┘  │            │
│  │  ┌──────────────────────────────────────┐  │            │
│  │  │         SQLite Database              │  │            │
│  │  └──────────────────────────────────────┘  │            │
│  └─────────────────────────────────────────────┘            │
└────────┬───────────────────────────────────────────────────┘
         │ WebSocket
         │
┌────────┼───────────────────────────────────────────────────┐
│        ▼                                                    │
│  ┌─────────────────────────────────────────────┐           │
│  │      Satellite Agents (Go)                  │           │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │           │
│  │  │ Executor │  │   PTY    │  │ Metrics  │  │           │
│  │  └──────────┘  └──────────┘  └──────────┘  │           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
│  Running on: Linux, Windows, macOS                         │
└─────────────────────────────────────────────────────────────┘
```

## Success Criteria

✅ Server starts without errors
✅ Agent connects and registers
✅ Web UI loads and shows agent
✅ Commands execute successfully
✅ Terminal sessions work interactively
✅ Real-time updates via WebSocket
✅ MCP tools respond correctly
✅ Security features active (rate limiting, auth)

## Troubleshooting Commands

```bash
# Check if server is running
curl http://localhost:3000/health

# Check WebSocket connection
wscat -c ws://localhost:3000/ws/agent

# View database
sqlite3 central-server/data/hive.db "SELECT * FROM satellites;"

# Check server logs
tail -f central-server/logs/server.log

# Test authentication
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | jq
```

Enjoy managing your satellite fleet! 🛰️
