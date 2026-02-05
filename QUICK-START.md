# Satellite Hive - Quick Start Guide

> **⚠️ NOTICE:** This is a generated skeleton. Testing and production implementation in progress. Use in development environments only.

**Repository:** https://github.com/coff33ninja/satellite-hive

## ✅ Installation Status

### Central Server - OPERATIONAL ✅
- ✅ Dependencies installed
- ✅ Database migrated (sql.js - no native compilation needed)
- ✅ Server running on http://localhost:3000
- ✅ Login API tested and working
- ✅ Health endpoint responding
- ✅ Static file serving configured
- ✅ Web UI built and deployed

### Web UI - OPERATIONAL ✅
- ✅ Dependencies installed
- ✅ Production build completed
- ✅ Served at http://localhost:3000
- ✅ Ready for testing

### Satellite Agent - REQUIRES GO ⚠️
- ⚠️ Go 1.21+ not installed
- Install from: https://go.dev/dl/
- Once installed: `cd satellite-agent && go run . --server ws://localhost:3000/ws/agent --name "test-agent"`

---

## 🚀 Get Running in 3 Minutes

### Prerequisites
- Node.js 20+
- Go 1.21+

### Step 1: Start Everything (Automated)

**Windows:**
```bash
start-demo.bat
```

**Linux/macOS:**
```bash
chmod +x start-demo.sh
./start-demo.sh
```

### Step 2: Open Browser

Go to: http://localhost:3000

Login:
- Email: `admin@example.com`
- Password: `admin123`

### Step 3: Use It!

✅ See your agent in the dashboard
✅ Click "Terminal" to open interactive shell
✅ Execute commands via API or UI

---

## 📚 Manual Setup

### Terminal 1 - Server
```bash
cd central-server
npm install
npm run db:migrate
npm run dev
```

### Terminal 2 - Agent
```bash
cd satellite-agent
go mod download
go run . --server ws://localhost:3000/ws/agent --name "my-agent"
```

### Terminal 3 - Web UI (Optional)
```bash
cd web-ui
npm install
npm run dev
# Opens on http://localhost:5173
```

---

## 🎯 Quick Commands

### API Examples

**Login:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

**List Satellites:**
```bash
curl http://localhost:3000/api/v1/satellites \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Execute Command:**
```bash
curl -X POST http://localhost:3000/api/v1/satellites/sat_xxx/exec \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"uptime"}'
```

---

## 🤖 MCP Integration

### Configure Claude Desktop

Edit config file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "satellite-hive": {
      "command": "node",
      "args": ["C:/path/to/satellite-hive/central-server/dist/mcp/index.js"]
    }
  }
}
```

### Build MCP Server First
```bash
cd central-server
npm run build
```

### Test in Claude

Ask:
- "List all satellites in the hive"
- "Execute 'df -h' on all satellites"
- "Get info about satellite sat_xxx"

---

## 🔧 Configuration

### Enable TLS

Edit `central-server/server.yaml`:
```yaml
tls:
  enabled: true
  cert_file: "/path/to/cert.pem"
  key_file: "/path/to/key.pem"
```

### Change Password

```bash
cd central-server
npm run db:migrate
# Then change password in database or via API
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

---

## 📊 What You Get

### Features
- ✅ Real-time fleet management
- ✅ Interactive terminal sessions
- ✅ Command execution
- ✅ AI integration (MCP)
- ✅ Web dashboard
- ✅ JWT authentication
- ✅ Rate limiting
- ✅ Audit logging

### Endpoints
- **Web UI:** http://localhost:3000
- **API:** http://localhost:3000/api/v1
- **Health:** http://localhost:3000/health
- **Agent WS:** ws://localhost:3000/ws/agent
- **UI WS:** ws://localhost:3000/ws/ui

---

## 🐛 Troubleshooting

### Server won't start
```bash
# Check if port 3000 is in use
netstat -an | grep 3000

# Kill process using port
# Windows: taskkill /F /PID <pid>
# Linux/macOS: kill -9 <pid>
```

### Agent won't connect
```bash
# Check server is running
curl http://localhost:3000/health

# Check WebSocket
# Install wscat: npm install -g wscat
wscat -c ws://localhost:3000/ws/agent
```

### Database issues
```bash
# Reset database
rm central-server/data/hive.db
cd central-server
npm run db:migrate
```

---

## 📖 Documentation

- [README.md](./README.md) - Full documentation
- [test-setup.md](./test-setup.md) - Testing guide
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Implementation details
- [docs/](./docs/) - Detailed specifications

---

## 🎉 Success Checklist

- [ ] Server starts without errors
- [ ] Agent connects and shows in dashboard
- [ ] Can login to web UI
- [ ] Can see agent in dashboard
- [ ] Can open terminal to agent
- [ ] Can execute commands
- [ ] Real-time updates work
- [ ] MCP tools respond (if configured)

---

## 💡 Tips

1. **Multiple Agents:** Just run the agent command multiple times with different names
2. **Production:** Enable TLS, change secrets, use PostgreSQL
3. **Development:** Use `npm run dev` for hot reload
4. **Debugging:** Check server logs and agent output
5. **Database:** Use SQLite browser to inspect data

---

## 🚀 Next Steps

1. ✅ Get it running (you're here!)
2. 📖 Read [test-setup.md](./test-setup.md) for detailed testing
3. 🔒 Configure security (TLS, secrets)
4. 🤖 Set up MCP for AI integration
5. 🌐 Deploy to production
6. 🎨 Customize for your needs

---

**Need Help?**
- Check [test-setup.md](./test-setup.md) for detailed troubleshooting
- Read [IMPLEMENTATION.md](./IMPLEMENTATION.md) for architecture details
- Review [docs/](./docs/) for specifications

**Enjoy managing your satellite fleet!** 🛰️
