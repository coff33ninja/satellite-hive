import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHiveStore } from '../store';

export default function SatelliteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const satellites = useHiveStore((state) => state.satellites);
  const [satellite, setSatellite] = useState<any>(null);

  useEffect(() => {
    if (id) {
      const sat = Array.from(satellites.values()).find(s => s.id === id);
      if (sat) {
        setSatellite(sat);
      }
    }
  }, [id, satellites]);

  if (!satellite) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="mb-4 text-blue-400 hover:text-blue-300"
          >
            ← Back to Dashboard
          </button>
          <div className="text-center py-12">
            <p className="text-gray-400">Satellite not found</p>
          </div>
        </div>
      </div>
    );
  }

  const isOnline = satellite.status === 'online';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="mb-4 text-blue-400 hover:text-blue-300"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold">{satellite.name}</h1>
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  isOnline
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {isOnline ? '● Online' : '○ Offline'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/terminal/${satellite.id}`)}
                disabled={!isOnline}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded"
              >
                Open Terminal
              </button>
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">System Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Hostname</p>
              <p className="font-mono">{satellite.hostname || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Operating System</p>
              <p className="font-mono">
                {satellite.os} {satellite.osVersion}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Architecture</p>
              <p className="font-mono">{satellite.arch || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Agent Version</p>
              <p className="font-mono">{satellite.agentVersion || 'N/A'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">First Seen</p>
              <p className="font-mono">
                {new Date(satellite.firstSeen).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Last Seen</p>
              <p className="font-mono">
                {satellite.lastSeen
                  ? new Date(satellite.lastSeen).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>

        {/* System Info Details */}
        {satellite.systemInfo && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Hardware</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-sm">CPU Cores</p>
                <p className="font-mono">{satellite.systemInfo.cpuCores}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Memory</p>
                <p className="font-mono">
                  {(satellite.systemInfo.memoryTotalMb / 1024).toFixed(1)} GB
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Disk</p>
                <p className="font-mono">
                  {satellite.systemInfo.diskTotalGb} GB
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Uptime</p>
                <p className="font-mono">
                  {Math.floor(satellite.systemInfo.uptimeSeconds / 86400)} days
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {satellite.tags && satellite.tags.length > 0 ? (
              satellite.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))
            ) : (
              <p className="text-gray-400">No tags</p>
            )}
          </div>
        </div>

        {/* Capabilities */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Capabilities</h2>
          <div className="flex flex-wrap gap-2">
            {satellite.capabilities && satellite.capabilities.length > 0 ? (
              satellite.capabilities.map((cap: string) => (
                <span
                  key={cap}
                  className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-mono"
                >
                  {cap}
                </span>
              ))
            ) : (
              <p className="text-gray-400">No capabilities reported</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
