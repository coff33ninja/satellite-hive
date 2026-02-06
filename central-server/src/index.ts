import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from '@hono/node-server/serve-static';
import { WebSocketServer } from 'ws';
import { readFileSync } from 'fs';
import { createServer as createHttpsServer } from 'https';
import { loadConfig } from './config.js';
import { DB } from './db/index.js';
import { DeviceRegistry } from './services/deviceRegistry.js';
import { SessionManager } from './services/sessionManager.js';
import { AuditLogger } from './services/auditLogger.js';
import { MetricsCollector } from './services/metricsCollector.js';
import { AgentHub } from './ws/agentHub.js';
import { UIHub } from './ws/uiHub.js';
import { createAuthRouter } from './api/routes/auth.js';
import { createSatellitesRouter } from './api/routes/satellites.js';
import { createSessionsRouter } from './api/routes/sessions.js';
import { createProvisionRouter } from './api/routes/provision.js';
import { createHealthRouter } from './api/routes/health.js';
import { createTagsRouter } from './api/routes/tags.js';
import { createAuditRouter } from './api/routes/audit.js';
import { createMetricsRouter } from './api/routes/metrics.js';
import { createApiKeysRouter } from './api/routes/apiKeys.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createApiKeyMiddleware } from './middleware/apiKeyAuth.js';
import { requirePermission } from './middleware/rbac.js';
import { rateLimit } from './middleware/rateLimit.js';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

function generateAgentScript(token: any, serverUrl: string): string {
  const { platform, name, tags } = token;
  const wsUrl = serverUrl.replace('http://', 'ws://').replace('https://', 'wss://');
  const agentToken = `agent_${nanoid(32)}`;
  const agentTokenHash = createHash('sha256').update(agentToken).digest('hex');

  if (platform === 'windows') {
    const tagsArg = tags.length > 0 ? `, "-tags", "${tags.join(',')}"` : '';
    const tagsLine = tags.length > 0 ? `\n\`$agentTags = "${tags.join(',')}"` : '';
    const tagsArgInScript = tags.length > 0 ? `, "-tags", \`$agentTags` : '';
    
    return `# Satellite Hive Agent Installer
# Generated for: ${name}
# Platform: Windows

$ErrorActionPreference = "Stop"

Write-Host "Installing Satellite Hive Agent..."
Write-Host "Name: ${name}"
Write-Host "Tags: ${tags.join(', ')}"

# Download agent binary
$agentUrl = "${serverUrl}/static/satellite-agent-windows.exe"
$installDir = "$env:ProgramFiles\\SatelliteHive"
$agentPath = "$installDir\\satellite-agent.exe"

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Invoke-WebRequest -Uri $agentUrl -OutFile $agentPath

# Save agent token
$tokenPath = "$installDir\\.agent-token"
Set-Content -Path $tokenPath -Value "${agentToken}"

# Create startup script
$startupScript = "$installDir\\start-agent.ps1"
$startupContent = @"
# Satellite Hive Agent Startup Script
\`$agentPath = "$agentPath"
\`$serverUrl = "${wsUrl}/ws/agent"
\`$agentToken = "${agentToken}"
\`$agentName = "${name}"${tagsLine}

# Start agent in background
Start-Process -FilePath \`$agentPath -ArgumentList "-server", \`$serverUrl, "-token", \`$agentToken, "-name", \`$agentName${tagsArgInScript} -WindowStyle Hidden -PassThru
"@

Set-Content -Path $startupScript -Value $startupContent

# Create scheduled task to run at startup
$taskName = "SatelliteHiveAgent"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File \`"$startupScript\`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Remove existing task if present
Unregister-ScheduledTask -TaskName $taskName -Confirm:\$false -ErrorAction SilentlyContinue

# Register new task
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Satellite Hive remote management agent" | Out-Null

# Start agent now
Write-Host "Starting agent..."
Start-Process -FilePath $agentPath -ArgumentList "-server", "${wsUrl}/ws/agent", "-token", "${agentToken}", "-name", "${name}"${tagsArg} -WindowStyle Hidden -PassThru

Write-Host ""
Write-Host "✓ Agent installed successfully"
Write-Host "✓ Agent will start automatically on system boot"
Write-Host "✓ Agent Token: ${agentToken}"
Write-Host ""
Write-Host "To manually start: & '$startupScript'"
Write-Host "To stop: Stop-Process -Name satellite-agent"
`;
  } else {
    // Linux/macOS
    return `#!/bin/bash
# Satellite Hive Agent Installer
# Generated for: ${name}
# Platform: ${platform}

set -e

echo "Installing Satellite Hive Agent..."
echo "Name: ${name}"
echo "Tags: ${tags.join(', ')}"

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
  x86_64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Download agent binary
AGENT_URL="${serverUrl}/static/satellite-agent-${platform}-$ARCH"
INSTALL_DIR="/opt/satellite-hive"
AGENT_PATH="$INSTALL_DIR/satellite-agent"

sudo mkdir -p "$INSTALL_DIR"
sudo curl -fsSL "$AGENT_URL" -o "$AGENT_PATH"
sudo chmod +x "$AGENT_PATH"

# Save agent token
TOKEN_PATH="$INSTALL_DIR/.agent-token"
echo "${agentToken}" | sudo tee "$TOKEN_PATH" > /dev/null
sudo chmod 600 "$TOKEN_PATH"

# Create systemd service
SERVICE_FILE="/etc/systemd/system/satellite-hive-agent.service"
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Satellite Hive Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$AGENT_PATH -server ${wsUrl}/ws/agent -token ${agentToken} -name "${name}"${tags.length > 0 ? ` -tags "${tags.join(',')}"` : ''}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable satellite-hive-agent
sudo systemctl start satellite-hive-agent

echo "✓ Agent installed and started as systemd service"
echo "✓ Agent Token: ${agentToken}"
echo ""
echo "Register this agent with the server using:"
echo "  Token Hash: ${agentTokenHash}"
`;
  }
}

async function main() {
  console.log('🛰️  Starting Satellite Hive Central Server...');

  // Load configuration
  const config = loadConfig();
  console.log(`📝 Loaded configuration from server.yaml`);

  // Ensure data directory exists
  const dbPath = config.database.connection;
  await mkdir(dirname(dbPath), { recursive: true });

  // Initialize database
  const db = await DB.create(dbPath);
  console.log(`💾 Database initialized at ${dbPath}`);

  // Initialize services
  const deviceRegistry = new DeviceRegistry(db);
  const sessionManager = new SessionManager(db);
  const auditLogger = new AuditLogger(db);
  const metricsCollector = new MetricsCollector(db);
  const agentHub = new AgentHub(deviceRegistry, sessionManager, auditLogger, config);
  const uiHub = new UIHub(deviceRegistry, sessionManager, agentHub, config);

  // Create HTTP server
  const app = new Hono();

  // Security middleware
  app.use('*', secureHeaders());
  app.use('*', cors({
    origin: config.server.external_url,
    credentials: true,
  }));

  // Rate limiting
  app.use('/api/v1/auth/login', rateLimit({ windowMs: 60000, maxRequests: 5 }));
  app.use('/api/v1/*', rateLimit({ windowMs: 60000, maxRequests: 100 }));

  // Health checks (no auth required)
  app.route('/health', createHealthRouter(db));

  // API routes
  app.route('/api/v1/auth', createAuthRouter(db, config));
  
  // API key middleware (tries API key first, falls back to JWT)
  const apiKeyMiddleware = createApiKeyMiddleware(db);
  app.use('/api/v1/*', apiKeyMiddleware);
  
  // Protected routes
  const authMiddleware = createAuthMiddleware(config);
  app.use('/api/v1/satellites/*', authMiddleware);
  app.use('/api/v1/sessions/*', authMiddleware);
  app.use('/api/v1/tags/*', authMiddleware);
  app.use('/api/v1/audit/*', authMiddleware);
  app.use('/api/v1/metrics/*', authMiddleware);
  app.use('/api/v1/keys/*', authMiddleware);
  
  // Provision routes
  const provisionRouter = createProvisionRouter(db, auditLogger, config.server.external_url);
  
  // Public provision endpoints (no auth)
  app.get('/api/v1/provision/download/:token', async (c) => {
    const { token } = c.req.param();
    const provisionToken = db.getProvisionToken(token);
    
    if (!provisionToken || provisionToken.isRevoked || provisionToken.usedAt || new Date() > provisionToken.expiresAt) {
      return c.text('Invalid or expired provision token', 404);
    }
    
    const script = generateAgentScript(provisionToken, config.server.external_url);
    const filename = `satellite-agent-${provisionToken.platform}.${provisionToken.platform === 'windows' ? 'ps1' : 'sh'}`;
    c.header('Content-Type', 'text/plain');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    return c.text(script);
  });
  
  app.get('/api/v1/provision/platforms', async (c) => {
    return c.json({
      success: true,
      data: [
        { id: 'linux', name: 'Linux', architectures: ['amd64', 'arm64'], installer: 'shell script' },
        { id: 'windows', name: 'Windows', architectures: ['amd64'], installer: 'PowerShell script' },
        { id: 'darwin', name: 'macOS', architectures: ['amd64', 'arm64'], installer: 'shell script' },
      ],
    });
  });
  
  // Protected provision endpoints
  app.use('/api/v1/provision/*', authMiddleware);
  app.route('/api/v1/provision', provisionRouter);
  
  app.route('/api/v1/satellites', createSatellitesRouter(deviceRegistry, auditLogger, agentHub, sessionManager));
  app.route('/api/v1/sessions', createSessionsRouter(sessionManager, deviceRegistry, auditLogger, agentHub));
  app.route('/api/v1/tags', createTagsRouter(deviceRegistry, auditLogger));
  app.route('/api/v1/audit', createAuditRouter(db));
  app.route('/api/v1/metrics', createMetricsRouter(metricsCollector, deviceRegistry));
  app.route('/api/v1/keys', createApiKeysRouter(db));

  // Serve static files from web-ui/dist
  // In development, __dirname is central-server/src, so go up 2 levels then into web-ui/dist
  const webUiPath = join(__dirname, '../..', 'web-ui', 'dist');
  console.log(`📁 Serving static files from: ${webUiPath}`);
  app.use('/*', serveStatic({ root: webUiPath }));
  
  // Fallback to index.html for SPA routing
  app.get('*', serveStatic({ path: join(webUiPath, 'index.html') }));

  // Start server (HTTP or HTTPS)
  let server;
  if (config.tls.enabled) {
    const httpsOptions = {
      cert: readFileSync(config.tls.cert_file),
      key: readFileSync(config.tls.key_file),
    };
    server = createHttpsServer(httpsOptions, app.fetch as any);
    server.listen(config.server.port, config.server.host as any);
    console.log(`🔒 HTTPS server listening on ${config.server.host}:${config.server.port}`);
  } else {
    server = serve({
      fetch: app.fetch,
      port: config.server.port,
      hostname: config.server.host,
    });
    console.log(`🌐 HTTP server listening on ${config.server.host}:${config.server.port}`);
    console.log(`⚠️  TLS is disabled - enable it in production!`);
  }

  // Create WebSocket servers
  const agentWss = new WebSocketServer({ noServer: true });
  const uiWss = new WebSocketServer({ noServer: true });

  agentWss.on('connection', (ws) => {
    agentHub.handleConnection(ws);
  });

  uiWss.on('connection', (ws, request) => {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    if (token) {
      uiHub.handleConnection(ws, token);
    } else {
      ws.close();
    }
  });

  // Handle WebSocket upgrade
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url!, `http://${request.headers.host}`);
    
    if (url.pathname === '/ws/agent') {
      agentWss.handleUpgrade(request, socket, head, (ws) => {
        agentWss.emit('connection', ws, request);
      });
    } else if (url.pathname === '/ws/ui') {
      uiWss.handleUpgrade(request, socket, head, (ws) => {
        uiWss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  const protocol = config.tls.enabled ? 'wss' : 'ws';
  console.log(`🔌 Agent WebSocket: ${protocol}://${config.server.host}:${config.server.port}/ws/agent`);
  console.log(`🔌 UI WebSocket: ${protocol}://${config.server.host}:${config.server.port}/ws/ui`);
  console.log(`✅ Satellite Hive is running!`);
  console.log(`📊 Dashboard: ${config.server.external_url}`);
}

main().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
