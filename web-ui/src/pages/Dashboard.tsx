import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useHiveStore } from '../store';
import { Monitor, Terminal as TerminalIcon, Settings, FileText, BarChart3, Plus } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const satellites = useHiveStore((state) => state.satellites);
  const setToken = useHiveStore((state) => state.setToken);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Suppress unused variable warning - Settings will be used for future settings page
  void Settings;

  const filteredSatellites = Array.from(satellites.values()).filter((sat) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      sat.name.toLowerCase().includes(search) ||
      sat.hostname?.toLowerCase().includes(search) ||
      sat.tags.some((tag) => tag.toLowerCase().includes(search))
    );
  });

  const onlineSatellites = filteredSatellites.filter(s => s.isOnline);
  const offlineSatellites = filteredSatellites.filter(s => !s.isOnline);

  const handleLogout = () => {
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">🛰️ Satellite Hive</h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
            >
              Logout
            </button>
          </div>
          
          {/* Navigation */}
          <nav className="flex gap-2">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2 transition"
            >
              <Monitor size={16} />
              Dashboard
            </button>
            <button
              onClick={() => navigate('/provision')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 transition"
            >
              <Plus size={16} />
              Provision
            </button>
            <button
              onClick={() => navigate('/metrics')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 transition"
            >
              <BarChart3 size={16} />
              Metrics
            </button>
            <button
              onClick={() => navigate('/audit')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 transition"
            >
              <FileText size={16} />
              Audit Logs
            </button>
          </nav>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">Total Satellites</div>
            <div className="text-3xl font-bold">{filteredSatellites.length}</div>
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

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search satellites by name, hostname, or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Satellite List */}
        <div className="space-y-3">
          {filteredSatellites.map((satellite) => (
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
                  onClick={() => navigate(`/satellites/${satellite.id}`)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
                >
                  Details
                </button>
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

          {filteredSatellites.length === 0 && searchTerm && (
            <div className="text-center py-12 text-gray-400">
              <p>No satellites match "{searchTerm}"</p>
            </div>
          )}

          {filteredSatellites.length === 0 && !searchTerm && (
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
