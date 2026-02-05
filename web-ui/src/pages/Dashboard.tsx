import { useNavigate } from 'react-router-dom';
import { useHiveStore } from '../store';
import { Monitor, Terminal as TerminalIcon } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const satellites = useHiveStore((state) => state.satellites);
  const setToken = useHiveStore((state) => state.setToken);

  const onlineSatellites = satellites.filter(s => s.isOnline);
  const offlineSatellites = satellites.filter(s => !s.isOnline);

  const handleLogout = () => {
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">🛰️ Satellite Hive</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">Total Satellites</div>
            <div className="text-3xl font-bold">{satellites.length}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">Online</div>
            <div className="text-3xl font-bold text-green-400">{onlineSatellites.length}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">Offline</div>
            <div className="text-3xl font-bold text-red-400">{offlineSatellites.length}</div>
          </div>
        </div>

        {/* Satellite List */}
        <div className="space-y-3">
          {satellites.map((satellite) => (
            <div
              key={satellite.id}
              className="bg-gray-800 p-4 rounded-lg flex items-center justify-between hover:bg-gray-750 transition"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-3 h-3 rounded-full ${satellite.isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
                <div>
                  <div className="font-medium">{satellite.name}</div>
                  <div className="text-sm text-gray-400">
                    {satellite.hostname} • {satellite.os}
                  </div>
                  <div className="flex gap-2 mt-1">
                    {satellite.tags.map(tag => (
                      <span key={tag} className="text-xs bg-gray-700 px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/terminal/${satellite.id}`)}
                  disabled={!satellite.isOnline}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded flex items-center gap-2 transition"
                >
                  <TerminalIcon size={16} />
                  Terminal
                </button>
              </div>
            </div>
          ))}

          {satellites.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Monitor size={48} className="mx-auto mb-4 opacity-50" />
              <p>No satellites connected</p>
              <p className="text-sm mt-2">Start a satellite agent to see it here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
