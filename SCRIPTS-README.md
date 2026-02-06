# Satellite Hive - Scripts Guide

This document describes all the utility scripts available for managing Satellite Hive.

---

## Installation Scripts

These scripts install all dependencies for the project (Node.js packages and Go modules).

### Windows (PowerShell)
```powershell
.\install-dependencies.ps1
```

**Features:**
- ✅ Colored output with status indicators
- ✅ Checks for Node.js, npm, and Go
- ✅ Installs central-server dependencies
- ✅ Installs web-ui dependencies
- ✅ Downloads and tidies Go modules for satellite-agent
- ✅ Detailed error messages
- ✅ Installation summary

### Windows (Command Prompt)
```cmd
install-dependencies.bat
```

**Features:**
- ✅ Compatible with older Windows systems
- ✅ Same functionality as PowerShell version
- ✅ No execution policy issues

### Linux/macOS
```bash
chmod +x install-dependencies.sh
./install-dependencies.sh
```

**Features:**
- ✅ Unix-style colored output
- ✅ Same checks and installation process
- ✅ Bash-compatible

---

## Demo Startup Scripts

These scripts start all components of Satellite Hive for testing and development.

### Windows (PowerShell) - **RECOMMENDED**
```powershell
.\start-demo.ps1
```

**What it does:**
1. Checks for Node.js and Go installation
2. Checks if dependencies are installed (offers to install if missing)
3. Initializes database if needed
4. Starts central server in a new window
5. Starts satellite agent in a new window
6. Displays connection information
7. Waits for keypress to stop all services

**Features:**
- ✅ Automatic dependency checking
- ✅ Interactive installation prompt
- ✅ Colored output
- ✅ Process management
- ✅ Clean shutdown

### Windows (Batch)
```cmd
start-demo.bat
```

**What it does:**
- Same as PowerShell version
- Uses `choice` command for interactive prompts
- Compatible with older Windows systems

### Linux/macOS
```bash
chmod +x start-demo.sh
./start-demo.sh
```

**What it does:**
- Same as Windows versions
- Uses Unix signals for clean shutdown (Ctrl+C)
- Colored terminal output

---

## Script Comparison

| Feature | install-dependencies | start-demo |
|---------|---------------------|------------|
| **Purpose** | Install all dependencies | Start all services |
| **Checks prerequisites** | ✅ Yes | ✅ Yes |
| **Installs dependencies** | ✅ Yes | ⚠️ Offers to install if missing |
| **Starts services** | ❌ No | ✅ Yes |
| **Interactive** | ❌ No | ✅ Yes (stop prompt) |
| **Database setup** | ❌ No | ✅ Yes (if needed) |

---

## Prerequisites

Before running any scripts, ensure you have:

### Required
- **Node.js 20+** - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)

### Optional (for satellite agent)
- **Go 1.21+** - [Download](https://go.dev/dl/)
  - **Note:** All scripts now offer automatic Go installation!
  - Supported platforms:
    - Windows (AMD64): go1.23.7.windows-amd64.msi
    - macOS (ARM64/Apple Silicon): go1.23.7.darwin-arm64.pkg
    - macOS (Intel): go1.23.7.darwin-amd64.pkg
    - Linux (AMD64): go1.23.7.linux-amd64.tar.gz

---

## Automatic Go Installation

All installation and startup scripts now detect if Go is missing and offer to download and install it automatically:

### Windows
- Downloads the MSI installer
- Launches the installer with GUI
- Waits for installation to complete
- Prompts to restart terminal

### macOS
- Downloads the PKG installer
- Installs using `sudo installer` command
- Prompts to restart terminal

### Linux
- Downloads the tar.gz archive
- Extracts to `/usr/local/go` (requires sudo)
- Adds Go to PATH in `~/.profile`
- Prompts to run `source ~/.profile`

**Example interaction:**
```
[WARNING] Go is not installed!
Go is required for the satellite agent.

Would you like to download and install Go now?
This will download Go 1.23.7 for Windows (AMD64)

Download Go installer? (y/n) y

Downloading Go installer...
[OK] Go installer downloaded
Launching Go installer...
Please complete the installation, then run this script again.
```

---

## First-Time Setup

### Option 1: Manual (Recommended for understanding)
```bash
# 1. Install dependencies
.\install-dependencies.ps1   # Windows PowerShell
# OR
./install-dependencies.sh    # Linux/macOS

# 2. Configure server (optional)
# Edit central-server/server.yaml

# 3. Start demo
.\start-demo.ps1             # Windows PowerShell
# OR
./start-demo.sh              # Linux/macOS
```

### Option 2: Quick Start
```bash
# Just run start-demo, it will offer to install dependencies
.\start-demo.ps1             # Windows PowerShell
# OR
./start-demo.sh              # Linux/macOS
```

---

## What Gets Installed

### Central Server (`central-server/`)
- Hono (web framework)
- WebSocket libraries
- Database drivers (sql.js)
- JWT authentication
- TypeScript and build tools
- ~145 npm packages

### Web UI (`web-ui/`)
- React 18
- React Router
- xterm.js (terminal emulator)
- Zustand (state management)
- Tailwind CSS
- Vite (build tool)
- ~145 npm packages

### Satellite Agent (`satellite-agent/`)
- gorilla/websocket
- creack/pty
- shirou/gopsutil
- Go standard library modules

---

## Troubleshooting

### "Node.js is not installed"
**Solution:** Install Node.js from https://nodejs.org/
- Recommended version: 20.x LTS
- Verify: `node --version`

### "Go is not installed"
**Solution:** The scripts now offer automatic installation!
- Just answer "y" when prompted
- The script will download and install Go 1.23.7 for your platform
- After installation, restart your terminal and run the script again

**Manual installation:**
- Windows: https://go.dev/dl/go1.23.7.windows-amd64.msi
- macOS (ARM64): https://go.dev/dl/go1.23.7.darwin-arm64.pkg
- macOS (Intel): https://go.dev/dl/go1.23.7.darwin-amd64.pkg
- Linux: https://go.dev/dl/go1.23.7.linux-amd64.tar.gz
- Verify: `go version`
- Note: Go is optional if you only want to run the server/UI

### "npm install failed"
**Possible causes:**
1. Network issues - Check internet connection
2. Permissions - Run as administrator (Windows) or with sudo (Linux/macOS)
3. Corrupted cache - Run `npm cache clean --force`

### "go mod download failed"
**Possible causes:**
1. Network issues - Check internet connection
2. Proxy settings - Configure Go proxy: `go env -w GOPROXY=https://proxy.golang.org,direct`
3. Firewall - Ensure Go can access the internet

### "Cannot start without dependencies"
**Solution:** Run the installation script first:
```bash
.\install-dependencies.ps1   # Windows
./install-dependencies.sh    # Linux/macOS
```

### "Port 3000 already in use"
**Solution:** 
1. Stop any running services on port 3000
2. Or change the port in `central-server/server.yaml`

---

## Manual Commands

If you prefer to run commands manually:

### Install Dependencies
```bash
# Central Server
cd central-server
npm install

# Web UI
cd ../web-ui
npm install

# Satellite Agent
cd ../satellite-agent
go mod download
go mod tidy
```

### Start Services
```bash
# Central Server (Terminal 1)
cd central-server
npm run dev

# Satellite Agent (Terminal 2)
cd satellite-agent
go run . --server ws://localhost:3000/ws/agent --name my-agent

# Web UI - Optional (Terminal 3)
cd web-ui
npm run dev
```

---

## Default Credentials

When the demo starts, you can log in with:

- **Email:** `admin@example.com`
- **Password:** `admin123`

---

## Ports Used

- **3000** - Central Server (HTTP + WebSocket)
- **5173** - Web UI (if started separately with `npm run dev`)

---

## Next Steps

After starting the demo:

1. **Access Web UI:** http://localhost:3000
2. **Log in** with default credentials
3. **View Dashboard** - See connected satellite agent
4. **Open Terminal** - Click on the agent to open an interactive terminal
5. **Execute Commands** - Try running commands on the agent

---

## Production Deployment

For production deployment, see:
- `docs/08-deployment.md` - Deployment guide
- `SECURITY.md` - Security considerations
- `central-server/server.example.yaml` - Configuration reference

---

## Getting Help

- **Documentation:** See `docs/` directory
- **Issues:** https://github.com/coff33ninja/satellite-hive/issues
- **Quick Start:** `QUICK-START.md`

---

**Last Updated:** February 5, 2026
