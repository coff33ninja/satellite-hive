import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from 'xterm-addon-webgl';
import { useHiveStore } from '../store';
import { ArrowLeft, X } from 'lucide-react';
import 'xterm/css/xterm.css';

export default function Terminal() {
  const { satelliteId } = useParams<{ satelliteId: string }>();
  const navigate = useNavigate();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const token = useHiveStore((state) => state.token);
  const satellite = useHiveStore((state) => 
    state.satellites.find(s => s.id === satelliteId)
  );

  useEffect(() => {
    if (!terminalRef.current || !token || !satelliteId) return;

    // Create terminal
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        cursor: '#c0caf5',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn('WebGL addon failed to load:', e);
    }

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/ui?token=${token}`);

    ws.onopen = () => {
      console.log('[Terminal] WebSocket connected');
      setConnected(true);

      // Create session
      const requestId = `req_${Date.now()}`;
      ws.send(JSON.stringify({
        action: 'session:create',
        request_id: requestId,
        data: {
          satellite_id: satelliteId,
          cols: term.cols,
          rows: term.rows,
        },
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.event === 'action:result' && message.data?.session_id) {
        setSessionId(message.data.session_id);
        term.writeln('✓ Connected to satellite');
      } else if (message.event === 'session:output' && message.data?.output) {
        const data = atob(message.data.output);
        term.write(data);
      } else if (message.event === 'session:ended') {
        term.writeln('\r\n\r\n✗ Session ended');
        setConnected(false);
      }
    };

    ws.onerror = (error) => {
      console.error('[Terminal] WebSocket error:', error);
      term.writeln('\r\n✗ Connection error');
    };

    ws.onclose = () => {
      console.log('[Terminal] WebSocket closed');
      setConnected(false);
    };

    wsRef.current = ws;

    // Handle terminal input
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN && sessionId) {
        ws.send(JSON.stringify({
          action: 'session:input',
          data: {
            session_id: sessionId,
            input: btoa(data),
          },
        }));
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN && sessionId) {
        ws.send(JSON.stringify({
          action: 'session:resize',
          data: {
            session_id: sessionId,
            cols: term.cols,
            rows: term.rows,
          },
        }));
      }
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      if (sessionId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          action: 'session:close',
          data: { session_id: sessionId },
        }));
      }
      ws.close();
      term.dispose();
    };
  }, [satelliteId, token]);

  const handleClose = () => {
    navigate('/');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="font-medium">Terminal: {satellite?.name}</div>
            <div className="text-sm text-gray-400">
              {connected ? (
                <span className="text-green-400">● Connected</span>
              ) : (
                <span className="text-gray-500">○ Disconnected</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-gray-700 rounded transition"
        >
          <X size={20} />
        </button>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 p-4" />
    </div>
  );
}
