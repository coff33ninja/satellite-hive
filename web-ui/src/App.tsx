import { Routes, Route, Navigate } from 'react-router-dom';
import { useHiveStore } from './store';
import { useWebSocket } from './hooks/useWebSocket';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Terminal from './pages/Terminal';

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
        <Route path="/terminal/:satelliteId" element={<Terminal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
