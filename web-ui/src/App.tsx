import { Routes, Route, Navigate } from 'react-router-dom';
import { useHiveStore } from './store';
import { useWebSocket } from './hooks/useWebSocket';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Terminal from './pages/Terminal';
import SatelliteDetail from './pages/SatelliteDetail';
import Provision from './pages/Provision';
import AuditLogs from './pages/AuditLogs';
import Metrics from './pages/Metrics';

function App() {
  const token = useHiveStore((state) => state.token);
  useWebSocket();

  if (!token) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/satellites/:id" element={<SatelliteDetail />} />
        <Route path="/terminal/:satelliteId" element={<Terminal />} />
        <Route path="/provision" element={<Provision />} />
        <Route path="/audit" element={<AuditLogs />} />
        <Route path="/metrics" element={<Metrics />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
