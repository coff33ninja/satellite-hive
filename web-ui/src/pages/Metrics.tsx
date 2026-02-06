import { useState, useEffect } from 'react';
import { useHiveStore } from '../store';

interface SatelliteMetrics {
  satellite_id: string;
  satellite_name: string;
  cpu_usage?: number;
  memory_percent?: number;
  disk_percent?: number;
  timestamp: string;
}

interface FleetSummary {
  total_satellites: number;
  online_satellites: number;
  metrics: SatelliteMetrics[];
}

export default function Metrics() {
  const token = useHiveStore((state: any) => state.token);
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/v1/metrics/fleet/summary', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setSummary(data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getUsageColor = (value: number | undefined) => {
    if (!value) return 'bg-gray-600';
    if (value < 50) return 'bg-green-500';
    if (value < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getUsageTextColor = (value: number | undefined) => {
    if (!value) return 'text-gray-400';
    if (value < 50) return 'text-green-400';
    if (value < 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatPercent = (value: number | undefined) => {
    return value !== undefined ? `${value.toFixed(1)}%` : 'N/A';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Fleet Metrics</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Auto-refresh (30s)</span>
            </label>
            <button
              onClick={fetchMetrics}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
            >
              Refresh Now
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-4 text-gray-400">Loading metrics...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 text-red-200">
            {error}
          </div>
        ) : !summary ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-400">
            No metrics available
          </div>
        ) : (
          <>
            {/* Fleet Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">Total Satellites</div>
                <div className="text-3xl font-bold">{summary.total_satellites}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">Online</div>
                <div className="text-3xl font-bold text-green-400">{summary.online_satellites}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="text-gray-400 text-sm mb-2">Offline</div>
                <div className="text-3xl font-bold text-red-400">
                  {summary.total_satellites - summary.online_satellites}
                </div>
              </div>
            </div>

            {/* Satellite Metrics */}
            {summary.metrics.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-400">
                No metrics data available yet
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {summary.metrics.map((metric) => (
                  <div key={metric.satellite_id} className="bg-gray-800 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{metric.satellite_name}</h3>
                        <p className="text-xs text-gray-400">
                          Last updated: {new Date(metric.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* CPU Usage */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">CPU Usage</span>
                          <span className={getUsageTextColor(metric.cpu_usage)}>
                            {formatPercent(metric.cpu_usage)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${getUsageColor(metric.cpu_usage)}`}
                            style={{ width: `${metric.cpu_usage || 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Memory Usage */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Memory Usage</span>
                          <span className={getUsageTextColor(metric.memory_percent)}>
                            {formatPercent(metric.memory_percent)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${getUsageColor(metric.memory_percent)}`}
                            style={{ width: `${metric.memory_percent || 0}%` }}
                          />
                        </div>
                      </div>

                      {/* Disk Usage */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">Disk Usage</span>
                          <span className={getUsageTextColor(metric.disk_percent)}>
                            {formatPercent(metric.disk_percent)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${getUsageColor(metric.disk_percent)}`}
                            style={{ width: `${metric.disk_percent || 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
