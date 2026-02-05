import { useEffect, useRef } from 'react';
import { useHiveStore } from '../store';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const token = useHiveStore((state) => state.token);
  const setSatellites = useHiveStore((state) => state.setSatellites);
  const updateSatellite = useHiveStore((state) => state.updateSatellite);

  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/ui?token=${token}`);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (token) {
          // Trigger re-render to reconnect
        }
      }, 5000);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [token]);

  const handleMessage = (message: any) => {
    switch (message.event) {
      case 'initial_state':
        setSatellites(message.data.satellites);
        break;

      case 'satellite:online':
        updateSatellite(message.data.id, { status: 'online', isOnline: true });
        break;

      case 'satellite:offline':
        updateSatellite(message.data.id, { status: 'offline', isOnline: false });
        break;

      case 'satellite:metrics':
        // Update metrics
        break;

      default:
        console.log('[WebSocket] Unknown event:', message.event);
    }
  };

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { sendMessage };
}
