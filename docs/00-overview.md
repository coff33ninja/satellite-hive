# Satellite Hive - System Overview

> A distributed fleet management system with AI integration via MCP

## Project Codename: **Satellite Hive**

---

## 1. Executive Summary

Satellite Hive is a centralized device fleet management platform that enables:
- Remote terminal access to distributed machines via SSH-compliant protocols
- System administration commands (shutdown, reboot, script execution)
- AI-powered operations through Model Context Protocol (MCP) integration
- Real-time device discovery and status monitoring
- Dynamic client provisioning with pre-configured agents

---

## 2. Goals & Objectives

| Goal | Description |
|------|-------------|
| **Zero-touch onboarding** | Devices join the hive automatically upon agent installation |
| **Secure remote access** | SSH-grade security for all terminal sessions |
| **AI-first operations** | Full MCP integration for AI-driven fleet management |
| **Cross-platform** | Support Windows, Linux, macOS satellites |
| **Self-updating** | Agents can be updated remotely from central server |
| **Minimal footprint** | Lightweight agent with low resource consumption |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           WEB BROWSER                                │
│                    (Dashboard + Terminal UI)                         │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTPS + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        CENTRAL SERVER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │   Web API   │  │  WebSocket  │  │ MCP Server  │  │  Database  │  │
│  │  (REST/RPC) │  │     Hub     │  │   (stdio)   │  │  (SQLite)  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Session Manager                               ││
│  │         (Terminal sessions, command routing)                     ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────┬───────────────────────────────────────┘
                              │ WebSocket + TLS
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  SATELLITE #1    │ │  SATELLITE #2    │ │  SATELLITE #N    │
│  ┌────────────┐  │ │  ┌────────────┐  │ │  ┌────────────┐  │
│  │   Agent    │  │ │  │   Agent    │  │ │  │   Agent    │  │
│  │  Daemon    │  │ │  │  Daemon    │  │ │  │  Daemon    │  │
│  └────────────┘  │ │  └────────────┘  │ │  └────────────┘  │
│  - Heartbeat     │ │  - Heartbeat     │ │  - Heartbeat     │
│  - Shell exec    │ │  - Shell exec    │ │  - Shell exec    │
│  - System cmds   │ │  - System cmds   │ │  - System cmds   │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 4. Core Components

### 4.1 Central Server
The brain of the system. Handles:
- Device registration and authentication
- WebSocket connections for real-time communication
- REST API for web UI and external integrations
- MCP server for AI tool access
- Session management for terminal connections
- Client binary generation with embedded config

**See:** [02-central-server.md](./02-central-server.md)

### 4.2 Satellite Agent
Lightweight daemon running on each managed device:
- Connects to central server on startup
- Maintains persistent WebSocket connection
- Executes commands received from server
- Provides PTY (pseudo-terminal) for interactive sessions
- Reports system metrics and status

**See:** [01-satellite-agent.md](./01-satellite-agent.md)

### 4.3 Web UI
Browser-based management interface:
- Real-time device dashboard
- Interactive terminal (xterm.js)
- Device grouping and tagging
- Client download/provisioning
- Command history and audit logs

**See:** [04-web-ui.md](./04-web-ui.md)

### 4.4 MCP Server
AI integration layer exposing:
- Tools: list devices, execute commands, manage sessions
- Resources: device info, logs, metrics
- Prompts: common operation templates

**See:** [03-mcp-server.md](./03-mcp-server.md)

---

## 5. Terminology

| Term | Definition |
|------|------------|
| **Hive** | The entire fleet of connected devices managed by one central server |
| **Satellite** | A single managed device running the agent |
| **Agent** | The daemon process running on each satellite |
| **Central** | The central server coordinating all satellites |
| **Handshake** | Initial registration process when agent connects |
| **Heartbeat** | Periodic ping to confirm satellite is alive |
| **Session** | An active terminal connection to a satellite |
| **Provision** | Generate a pre-configured agent for deployment |

---

## 6. Technology Stack

### Central Server
| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ / Bun |
| Framework | Hono (lightweight, fast) |
| WebSocket | ws / Bun native |
| Database | SQLite (better-sqlite3) / PostgreSQL |
| MCP | @modelcontextprotocol/sdk |
| Auth | JWT + API keys |

### Satellite Agent
| Component | Technology |
|-----------|------------|
| Language | Go (preferred) or Rust |
| Alt: Python | For rapid prototyping |
| PTY | Native OS PTY support |
| Connection | WebSocket with auto-reconnect |
| Config | Embedded at build time |

### Web UI
| Component | Technology |
|-----------|------------|
| Framework | React 18+ or Svelte 5 |
| Terminal | xterm.js + xterm-addon-fit |
| Styling | Tailwind CSS |
| State | Zustand or Svelte stores |
| Build | Vite |

---

## 7. Security Model (Summary)

- **TLS everywhere** - All connections encrypted
- **Mutual authentication** - Server and agents verify each other
- **Token-based auth** - JWT for web users, API keys for agents
- **Capability-based** - Agents have limited, defined permissions
- **Audit logging** - All commands logged with attribution

**See:** [06-security.md](./06-security.md)

---

## 8. Document Index

| Document | Description |
|----------|-------------|
| [00-overview.md](./00-overview.md) | This document - system overview |
| [01-satellite-agent.md](./01-satellite-agent.md) | Satellite agent specification |
| [02-central-server.md](./02-central-server.md) | Central server specification |
| [03-mcp-server.md](./03-mcp-server.md) | MCP integration specification |
| [04-web-ui.md](./04-web-ui.md) | Web UI specification |
| [05-protocol.md](./05-protocol.md) | Communication protocol specification |
| [06-security.md](./06-security.md) | Security specification |
| [07-database-schema.md](./07-database-schema.md) | Database schema specification |
| [08-deployment.md](./08-deployment.md) | Deployment guide |

---

## 9. Version History

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0 | 2026-02-05 | Initial specification |

