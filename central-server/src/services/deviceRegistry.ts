import { nanoid } from 'nanoid';
import { DB } from '../db/index.js';
import type { Satellite, SystemInfo } from '../types/index.js';
import { createHash } from 'crypto';
import type { WebSocket } from 'ws';

export class DeviceRegistry {
  private db: DB;
  private onlineSatellites = new Map<string, WebSocket>();

  constructor(db: DB) {
    this.db = db;
  }

  async register(data: {
    agentId?: string;
    token: string;
    name: string;
    version: string;
    systemInfo: any; // Use any to handle snake_case from agent
    capabilities: string[];
    tags?: string[];
  }): Promise<{ satellite: Satellite; isNew: boolean }> {
    const tokenHash = createHash('sha256').update(data.token).digest('hex');
    
    // Normalize agentId - treat empty string as undefined
    const agentId = data.agentId && data.agentId.trim() !== '' ? data.agentId : undefined;
    
    // Check if satellite exists
    let satellite = agentId ? this.db.getSatelliteById(agentId) : undefined;
    let isNew = false;

    if (!satellite) {
      // Create new satellite
      const id = agentId || `sat_${nanoid(12)}`;
      
      // Map snake_case from agent to camelCase
      const systemInfo = data.systemInfo;
      const normalizedSystemInfo: SystemInfo = {
        hostname: systemInfo.hostname || 'unknown',
        os: systemInfo.os || 'unknown',
        osVersion: systemInfo.os_version || systemInfo.osVersion || 'unknown',
        arch: systemInfo.arch || 'unknown',
        kernel: systemInfo.kernel,
        uptimeSeconds: systemInfo.uptime_seconds || 0,
        cpuCores: systemInfo.cpu_cores || 0,
        memoryTotalMb: systemInfo.memory_total_mb || 0,
        memoryAvailableMb: systemInfo.memory_available_mb || 0,
        diskTotalGb: systemInfo.disk_total_gb || 0,
        diskAvailableGb: systemInfo.disk_available_gb || 0,
        ipAddresses: systemInfo.ip_addresses || [],
        macAddresses: systemInfo.mac_addresses || [],
      };
      
      satellite = {
        id,
        name: data.name || 'unknown',
        tokenHash,
        status: 'online',
        systemInfo: normalizedSystemInfo,
        hostname: normalizedSystemInfo.hostname,
        os: normalizedSystemInfo.os,
        osVersion: normalizedSystemInfo.osVersion,
        arch: normalizedSystemInfo.arch,
        lastIp: null as any, // Explicitly null for sql.js
        lastSeen: new Date(),
        firstSeen: new Date(),
        agentVersion: data.version || '1.0.0',
        capabilities: data.capabilities || [],
        tags: data.tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.db.createSatellite(satellite);
      
      // Add tags
      if (data.tags && data.tags.length > 0) {
        for (const tag of data.tags) {
          this.db.addSatelliteTag(id, tag);
        }
      }

      isNew = true;
    } else {
      // Update existing satellite
      this.db.updateSatelliteStatus(satellite.id, 'online', new Date());
      satellite = this.db.getSatelliteById(satellite.id)!;
    }

    return { satellite, isNew };
  }

  setConnection(satelliteId: string, ws: WebSocket) {
    this.onlineSatellites.set(satelliteId, ws);
  }

  removeConnection(satelliteId: string) {
    this.onlineSatellites.delete(satelliteId);
    this.db.updateSatelliteStatus(satelliteId, 'offline', new Date());
  }

  getConnection(satelliteId: string): WebSocket | undefined {
    return this.onlineSatellites.get(satelliteId);
  }

  isOnline(satelliteId: string): boolean {
    return this.onlineSatellites.has(satelliteId);
  }

  getSatellite(id: string): Satellite | undefined {
    return this.db.getSatelliteById(id);
  }

  getAllSatellites(): Satellite[] {
    return this.db.getAllSatellites();
  }

  getOnlineSatellites(): Satellite[] {
    return this.getAllSatellites().filter(s => s.status === 'online');
  }
}
