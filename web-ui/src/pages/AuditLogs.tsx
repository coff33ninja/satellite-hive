import { useState, useEffect } from 'react';
import { useHiveStore, type HiveState } from '../store';

interface AuditLog {
  id: string;
  timestamp: string;
  actor_type: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_name: string;
  result: string;
  error_message?: string;
}

export default function AuditLogs() {
  const token = useHiveStore((state: HiveState) => state.token);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    action: '',
    actor: '',
    result: '',
    limit: 50,
  });

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.actor) params.append('actor', filters.actor);
      if (filters.result) params.append('result', filters.result);
      params.append('limit', filters.limit.toString());

      const response = await fetch(`/api/v1/audit/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setLogs(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getResultBadge = (result: string) => {
    if (result === 'success') {
      return <span className="px-2 py-1 bg-green-900/50 text-green-400 rounded text-xs">Success</span>;
    }
    return <span className="px-2 py-1 bg-red-900/50 text-red-400 rounded text-xs">Failure</span>;
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('revoke')) return 'text-red-400';
    if (action.includes('create') || action.includes('add')) return 'text-green-400';
    if (action.includes('update') || action.includes('modify')) return 'text-yellow-400';
    return 'text-blue-400';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Audit Logs</h1>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Action</label>
              <input
                type="text"
                value={filters.action}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                placeholder="login, execute, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Actor</label>
              <input
                type="text"
                value={filters.actor}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilters({ ...filters, actor: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                placeholder="user email or name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Result</label>
              <select
                value={filters.result}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, result: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Limit</label>
              <select
                value={filters.limit}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          <button
            onClick={fetchLogs}
            className="mt-4 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium transition-colors"
          >
            Apply Filters
          </button>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-4 text-gray-400">Loading audit logs...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 text-red-200">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-400">
            No audit logs found
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Target
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {logs.map((log: AuditLog) => (
                    <tr key={log.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="text-white">{log.actor_name || 'Unknown'}</div>
                        <div className="text-gray-400 text-xs">{log.actor_type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="text-white">{log.target_name || '-'}</div>
                        <div className="text-gray-400 text-xs">{log.target_type || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getResultBadge(log.result)}
                        {log.error_message && (
                          <div className="text-red-400 text-xs mt-1">{log.error_message}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
