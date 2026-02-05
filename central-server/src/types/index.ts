export type Role = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemInfo {
  hostname: string;
  os: string;
  osVersion: string;
  arch: string;
  kernel?: string;
  uptimeSeconds: number;
  cpuCores: number;
  memoryTotalMb: number;
  memoryAvailableMb: number;
  diskTotalGb: number;
  diskAvailableGb: number;
  ipAddresses: Array<{ interface: string; ipv4?: string; ipv6?: string }>;
  macAddresses: Array<{ interface: string; mac: string }>;
}

export interface Satellite {
  id: string;
  name: string;
  tokenHash: string;
  status: 'online' | 'offline';
  systemInfo?: SystemInfo;
  hostname?: string;
  os?: string;
  osVersion?: string;
  arch?: string;
  lastIp?: string;
  lastSeen?: Date;
  firstSeen: Date;
  agentVersion?: string;
  capabilities: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Metrics {
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  load1m?: number;
  load5m?: number;
  load15m?: number;
  networkRxBytes?: number;
  networkTxBytes?: number;
  activeSessions?: number;
}

export interface Session {
  id: string;
  satelliteId: string;
  userId: string;
  status: 'active' | 'ended' | 'error';
  cols: number;
  rows: number;
  shell?: string;
  createdAt: Date;
  endedAt?: Date;
  endReason?: string;
  exitCode?: number;
}

export interface ProvisionToken {
  token: string;
  name: string;
  tags: string[];
  platform: 'linux' | 'windows' | 'darwin';
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  usedBySatelliteId?: string;
  isRevoked: boolean;
}

export interface Config {
  server: {
    host: string;
    port: number;
    external_url: string;
  };
  tls: {
    enabled: boolean;
    cert_file: string;
    key_file: string;
  };
  database: {
    driver: 'sqlite' | 'postgres';
    connection: string;
  };
  auth: {
    jwt_secret: string;
    jwt_expiration: string;
    admin_api_key: string;
  };
  agents: {
    heartbeat_timeout: string;
    max_sessions_per_agent: number;
  };
  logging: {
    level: string;
    format: string;
  };
  audit: {
    enabled: boolean;
    retention_days: number;
  };
}
