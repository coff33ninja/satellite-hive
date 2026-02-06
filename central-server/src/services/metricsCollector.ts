import type { DB } from '../db/index.js';
import { nanoid } from 'nanoid';

export interface MetricsData {
  cpu_usage?: number;
  memory_total?: number;
  memory_used?: number;
  memory_percent?: number;
  disk_total?: number;
  disk_used?: number;
  disk_percent?: number;
  network_bytes_sent?: number;
  network_bytes_recv?: number;
  load_avg_1?: number;
  load_avg_5?: number;
  load_avg_15?: number;
  process_count?: number;
  uptime_seconds?: number;
}

export class MetricsCollector {
  constructor(private db: DB) {}

  storeMetrics(satelliteId: string, metrics: MetricsData): void {
    const id = `met_${nanoid(12)}`;
    
    (this.db as any).db.run(
      `INSERT INTO metrics (
        id, satellite_id, metric_type, cpu_usage, memory_total, memory_used, 
        memory_percent, disk_total, disk_used, disk_percent, network_bytes_sent, 
        network_bytes_recv, load_avg_1, load_avg_5, load_avg_15, process_count, 
        uptime_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        satelliteId,
        'system',
        metrics.cpu_usage ?? null,
        metrics.memory_total ?? null,
        metrics.memory_used ?? null,
        metrics.memory_percent ?? null,
        metrics.disk_total ?? null,
        metrics.disk_used ?? null,
        metrics.disk_percent ?? null,
        metrics.network_bytes_sent ?? null,
        metrics.network_bytes_recv ?? null,
        metrics.load_avg_1 ?? null,
        metrics.load_avg_5 ?? null,
        metrics.load_avg_15 ?? null,
        metrics.process_count ?? null,
        metrics.uptime_seconds ?? null,
      ]
    );
    (this.db as any).save();
  }

  getLatestMetrics(satelliteId: string): any {
    const result = (this.db as any).db.exec(
      `SELECT * FROM metrics 
       WHERE satellite_id = ? 
       ORDER BY timestamp DESC 
       LIMIT 1`,
      [satelliteId]
    );
    
    if (!result.length || !result[0].values.length) return null;
    
    const obj: any = {};
    result[0].columns.forEach((col: string, i: number) => {
      obj[col] = result[0].values[0][i];
    });
    return obj;
  }

  getMetricsHistory(
    satelliteId: string,
    hours: number = 24,
    limit: number = 100
  ): any[] {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const result = (this.db as any).db.exec(
      `SELECT * FROM metrics 
       WHERE satellite_id = ? AND timestamp >= ?
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [satelliteId, startTime.toISOString(), limit]
    );
    
    if (!result.length || !result[0].values.length) return [];
    
    return result[0].values.map((values: any[]) => {
      const obj: any = {};
      result[0].columns.forEach((col: string, i: number) => {
        obj[col] = values[i];
      });
      return obj;
    });
  }

  getAggregatedMetrics(satelliteId: string, hours: number = 24): any {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const result = (this.db as any).db.exec(
      `SELECT 
        AVG(cpu_usage) as avg_cpu,
        MAX(cpu_usage) as max_cpu,
        AVG(memory_percent) as avg_memory,
        MAX(memory_percent) as max_memory,
        AVG(disk_percent) as avg_disk,
        MAX(disk_percent) as max_disk,
        COUNT(*) as sample_count
       FROM metrics 
       WHERE satellite_id = ? AND timestamp >= ?`,
      [satelliteId, startTime.toISOString()]
    );

    if (!result.length || !result[0].values.length) return null;
    
    const obj: any = {};
    result[0].columns.forEach((col: string, i: number) => {
      obj[col] = result[0].values[0][i];
    });
    return obj;
  }

  cleanupOldMetrics(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    (this.db as any).db.run(
      `DELETE FROM metrics WHERE timestamp < ?`,
      [cutoffDate.toISOString()]
    );
    (this.db as any).save();

    // sql.js doesn't return changes count easily, return 0
    return 0;
  }
}
