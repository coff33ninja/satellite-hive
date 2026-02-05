import { nanoid } from 'nanoid';
import { DB } from '../db/index.js';
import type { Satellite, SystemInfo } from '../types/index.js';
import { createHash } from 'crypto';

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
    systemInfo: SystemInfo;
    capabilities: string[];
    tags?: string[];
  }): Promise<{ satellite: Satellite; isNew: boolean }> {
    const tokenHash = createHash('sha256').update(data.token).digest('hex');
    
    // Check if satellite exists
    let satellite = data.agentId ? this.db.getSatelliteById(data.agentId) : undefined;
    let isNew = false;

    if (!satellite) {
      // Create new satellite
      const id = data.agentId || `sat_${nanoid(12)}`;
      satellite = {
        id,
        name: data.name,
        tokenHash,
        status: 'online',
        systemInfo: data.systemInfo,
        hostname: data.systemInfo.hostname,
        os: data.systemInfo.os,
        osVersion: data.systemInfo.osVersion,
        arch: data.systemInfo.arch,
        lastSeen: new Date(),
        firstSeen: new Date(),
        agentVersion: data.version,
        capabilities: data.capabilities,
        tags: data.tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.db.createSatellite(satellite);
      
      // Add tags
      if (data.tags) {
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
