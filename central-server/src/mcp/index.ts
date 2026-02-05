import { loadConfig } from '../config.js';
import { DB } from '../db/index.js';
import { DeviceRegistry } from '../services/deviceRegistry.js';
import { SessionManager } from '../services/sessionManager.js';
import { AuditLogger } from '../services/auditLogger.js';
import { AgentHub } from '../ws/agentHub.js';
import { startMCPServer } from './server.js';

async function main() {
  const config = loadConfig();
  const db = new DB(config.database.connection);
  
  const deviceRegistry = new DeviceRegistry(db);
  const sessionManager = new SessionManager(db);
  const auditLogger = new AuditLogger(db);
  const agentHub = new AgentHub(deviceRegistry, sessionManager, auditLogger, config);

  await startMCPServer(deviceRegistry, agentHub);
}

main().catch(console.error);
