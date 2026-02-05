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
import { AgentHub } from './ws/agentHub.js';
import { UIHub } from './ws/uiHub.js';
import { createAuthRouter } from './api/routes/auth.js';
import { createSatellitesRouter } from './api/routes/satellites.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  // Health check (no auth required)
  app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));

  // API routes
  app.route('/api/v1/auth', createAuthRouter(db, config));
  
  // Protected routes
  const authMiddleware = createAuthMiddleware(config);
  app.use('/api/v1/satellites/*', authMiddleware);
  app.route('/api/v1/satellites', createSatellitesRouter(deviceRegistry, auditLogger, agentHub));

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
