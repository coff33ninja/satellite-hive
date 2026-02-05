# Satellite Hive 🛰️

> **⚠️ IMPORTANT NOTICE:** This is currently a generated skeleton/proof-of-concept. Full testing and production implementation will be completed shortly. Use at your own risk in development environments only.

A distributed fleet management system with AI integration via Model Context Protocol (MCP).

**Repository:** https://github.com/coff33ninja/satellite-hive

## Features

- 🛰️ **Remote Terminal Access** - Interactive PTY sessions to distributed machines
- 🤖 **AI-Powered Operations** - Full MCP integration for AI-driven fleet management
- 🔒 **Enterprise Security** - TLS encryption, JWT auth, rate limiting, audit logging
- 📊 **Real-time Monitoring** - Live metrics and status updates via WebSocket
- 🚀 **Zero-touch Onboarding** - Agents auto-register on first connection
- 🌐 **Cross-platform** - Windows, Linux, macOS support
- 💻 **Modern Web UI** - React dashboard with xterm.js terminal emulator

## Installation Status

### ✅ Central Server - WORKING
The central server has been successfully installed and tested:
- Database migrated with admin user created (sql.js - no native compilation)
- Server running on http://localhost:3000
- Login API tested and working
- Health endpoint responding
- Static file serving configured for web UI

### ✅ Web UI - WORKING
The web UI has been built and is being served:
- Dependencies installed
- Production build completed (dist folder)
- Accessible at http://localhost:3000
- Login page ready for testing

### ⚠️ Satellite Agent - Requires Go Installation
The satellite agent requires Go 1.21+ to be installed. 

**To install Go on Windows:**
1. Download from https://go.dev/dl/
2. Run the installer
3. Restart your terminal
4. Verify with `go version`

**Then install and run the agent:**
```bash
cd satellite-agent
go mod download
go run . --server ws://localhost:3000/ws/agent --name "my-agent"
```

### 🔧 Database Migration
The database has been successfully migrated using sql.js (pure JavaScript SQLite implementation) instead of better-sqlite3 to avoid Windows SDK compilation requirements.

**Changes made:**
- Replaced `better-sqlite3` with `sql.js` (no native compilation needed)
- Fixed ESM imports for `bcryptjs` and `jsonwebtoken`
- Database automatically creates on first run
- Admin user created: admin@example.com / admin123

## Quick Testing (After Go Installation)

**IMPORTANT:** After installing Go, you must restart your terminal/PowerShell for the `go` command to be recognized.

### Option 1: Automated Test (Recommended)
```powershell
# Run the automated test script
.\test-system.ps1
```

This will verify:
- ✓ Go installation
- ✓ Server health
- ✓ Login API
- ✓ Web UI
- ✓ Go dependencies

### Option 2: Manual Testing

**Terminal 1 - Server (already running):**
```bash
cd central-server
npm run dev
```

**Terminal 2 - Agent (after restarting terminal):**
```bash
cd satellite-agent
go run . --server ws://localhost:3000/ws/agent --name "test-agent"
```

**Browser:**
Open http://localhost:3000 and login with:
- Email: `admin@example.com`
- Password: `admin123`

## Quick Start

### 1. Start Central Server

```bash
cd central-server
npm install
npm run db:migrate
npm run dev
```

Server runs on http://localhost:3000

Default credentials:
- Email: `admin@example.com`
- Password: `admin123` ⚠️ Change immediately!

### 2. Start Satellite Agent

```bash
cd satellite-agent
go mod download
go run . --server ws://localhost:3000/ws/agent --name "my-agent"
```

### 3. Open Web UI

Navigate to http://localhost:3000 and login with the default credentials.

### 4. Test MCP Integration

```bash
cd central-server
npm run mcp
```

Configure in your AI client (e.g., Claude Desktop):
```json
{
  "mcpServers": {
    "satellite-hive": {
      "command": "node",
      "args": ["path/to/central-server/dist/mcp/index.js"]
    }
  }
}
```

## Architecture

```
┌─────────────┐         WebSocket          ┌──────────────┐
│   Agent     │◄──────────────────────────►│   Central    │
│  (Go/Rust)  │    Handshake, Commands     │   Server     │
└─────────────┘    Heartbeat, Metrics      │  (Node.js)   │
                                            └──────┬───────┘
                                                   │
┌─────────────┐         WebSocket          ┌──────┴───────┐
│   Web UI    │◄──────────────────────────►│   SQLite DB  │
│   (React)   │    Real-time Updates       └──────────────┘
└─────────────┘                                    │
                                            ┌──────┴───────┐
┌─────────────┐         stdio              │  MCP Server  │
│ AI Client   │◄──────────────────────────►│   (Tools)    │
└─────────────┘    Tool Calls, Results     └──────────────┘
```

## Features Status

### ✅ Completed

**Core Infrastructure:**
- ✅ Central server with REST API
- ✅ WebSocket agent connections
- ✅ Agent handshake & registration
- ✅ Heartbeat mechanism
- ✅ System metrics collection
- ✅ SQLite database with full schema
- ✅ JWT authentication
- ✅ Audit logging

**Command Execution:**
- ✅ Shell command execution on agents
- ✅ Command timeout handling
- ✅ stdout/stderr capture
- ✅ Exit code reporting

**Terminal Sessions:**
- ✅ PTY session creation
- ✅ Interactive terminal I/O
- ✅ Terminal resize support
- ✅ Session lifecycle management

**Web UI:**
- ✅ React dashboard with Tailwind CSS
- ✅ Login/authentication
- ✅ Satellite list with status
- ✅ Real-time WebSocket updates
- ✅ xterm.js terminal emulator
- ✅ Full-screen terminal view

**MCP Integration:**
- ✅ MCP server implementation
- ✅ list_satellites tool
- ✅ get_satellite tool
- ✅ execute_command tool
- ✅ stdio transport

**Security:**
- ✅ TLS/HTTPS support
- ✅ JWT token authentication
- ✅ Rate limiting
- ✅ Secure headers
- ✅ CORS configuration
- ✅ Password hashing (bcrypt)
- ✅ Token-based agent auth

### 🚧 Future Enhancements

- [ ] File transfer (upload/download)
- [ ] Agent self-update mechanism
- [ ] Multi-user management
- [ ] Role-based access control (RBAC)
- [ ] Command allowlist/blocklist
- [ ] Metrics visualization (charts)
- [ ] Alert rules and notifications
- [ ] Agent groups and bulk operations
- [ ] Session recording/playback
- [ ] Dark/light theme toggle

## Project Structure

```
satellite-hive/
├── central-server/          # Node.js/TypeScript server
│   ├── src/
│   │   ├── api/             # REST API routes
│   │   ├── ws/              # WebSocket handlers
│   │   ├── services/        # Business logic
│   │   ├── db/              # Database layer
│   │   ├── mcp/             # MCP server
│   │   └── middleware/      # Auth, rate limiting
│   ├── data/                # SQLite database
│   └── server.yaml          # Configuration
├── satellite-agent/         # Go agent
│   ├── main.go              # Entry point
│   ├── executor.go          # Command execution
│   └── pty.go               # PTY sessions
├── web-ui/                  # React frontend
│   ├── src/
│   │   ├── pages/           # Dashboard, Terminal, Login
│   │   ├── hooks/           # WebSocket hook
│   │   └── store/           # Zustand state
│   └── index.html
└── docs/                    # Detailed specifications
```

## API Examples

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

### List Satellites
```bash
curl http://localhost:3000/api/v1/satellites \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Execute Command
```bash
curl -X POST http://localhost:3000/api/v1/satellites/sat_xxx/exec \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"uptime"}'
```

## Configuration

### Enable TLS

Edit `central-server/server.yaml`:
```yaml
tls:
  enabled: true
  cert_file: "/path/to/cert.pem"
  key_file: "/path/to/key.pem"
```

### Change JWT Secret

```bash
export JWT_SECRET=$(openssl rand -base64 32)
```

Or edit `server.yaml`:
```yaml
auth:
  jwt_secret: "your-secure-random-string"
```

## Development

### Server
```bash
cd central-server
npm run dev          # Start with hot reload
npm run build        # Build for production
npm run db:migrate   # Run database migrations
```

### Agent
```bash
cd satellite-agent
go run .             # Run in development
go build             # Build binary
```

### Web UI
```bash
cd web-ui
npm run dev          # Start dev server (port 5173)
npm run build        # Build for production
```

## Documentation

Detailed specifications in the [docs](./docs) directory:
- [00-overview.md](./docs/00-overview.md) - System overview
- [01-satellite-agent.md](./docs/01-satellite-agent.md) - Agent specification
- [02-central-server.md](./docs/02-central-server.md) - Server specification
- [03-mcp-server.md](./docs/03-mcp-server.md) - MCP integration
- [04-web-ui.md](./docs/04-web-ui.md) - Web UI specification
- [05-protocol.md](./docs/05-protocol.md) - Communication protocol
- [06-security.md](./docs/06-security.md) - Security model
- [07-database-schema.md](./docs/07-database-schema.md) - Database schema
- [08-deployment.md](./docs/08-deployment.md) - Deployment guide

## Testing

See [test-setup.md](./test-setup.md) for detailed testing instructions.

## Production Deployment

1. **Enable TLS** - Configure certificates in server.yaml
2. **Change Secrets** - Update JWT secret and admin password
3. **Use PostgreSQL** - For production workloads
4. **Set up Reverse Proxy** - Nginx or Caddy recommended
5. **Configure Firewall** - Restrict access to necessary ports
6. **Enable Monitoring** - Prometheus metrics available
7. **Set up Backups** - Regular database backups

See [docs/08-deployment.md](./docs/08-deployment.md) for complete guide.

## License

MIT

## Contributing

Contributions welcome! Please read the documentation first to understand the architecture.

## Project Status

🚧 **Current Status:** Generated skeleton - testing and production implementation in progress

This codebase was generated as a proof-of-concept implementation. While the architecture is sound and the code is functional, it requires:
- Comprehensive testing
- Production hardening
- Security audit
- Performance optimization
- Bug fixes and refinements

**Use in development/testing environments only until production-ready release.**

## Support

- GitHub Issues: https://github.com/coff33ninja/satellite-hive/issues
- Repository: https://github.com/coff33ninja/satellite-hive
- Documentation: See docs/ directory
