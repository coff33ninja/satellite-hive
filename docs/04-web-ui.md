# Web UI Specification

> Browser-based management interface for Satellite Hive

---

## 1. Overview

The Web UI provides a modern, responsive interface for managing the satellite fleet. It features real-time updates, an integrated terminal emulator, and comprehensive device management capabilities.

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement |
|----|-------------|
| UI-F01 | Dashboard MUST display all satellites with status |
| UI-F02 | Dashboard MUST update in real-time via WebSocket |
| UI-F03 | UI MUST provide interactive terminal (xterm.js) |
| UI-F04 | UI MUST support multiple concurrent terminal sessions |
| UI-F05 | UI MUST allow satellite management (rename, tag, delete) |
| UI-F06 | UI MUST provide agent provisioning/download |
| UI-F07 | UI MUST display audit logs |
| UI-F08 | UI MUST support user authentication |
| UI-F09 | UI SHOULD be responsive (mobile-friendly) |
| UI-F10 | UI SHOULD support dark/light themes |

### 2.2 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| UI-N01 | Initial load time SHOULD be < 3 seconds |
| UI-N02 | Terminal latency SHOULD be < 100ms |
| UI-N03 | UI SHOULD work on Chrome, Firefox, Safari, Edge |
| UI-N04 | UI SHOULD be accessible (WCAG 2.1 AA) |

---

## 3. Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | React 18+ with TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Terminal | xterm.js + xterm-addon-fit + xterm-addon-webgl |
| Icons | Lucide React |
| Charts | Recharts |
| Router | React Router v6 |
| HTTP | Fetch API / ky |
| WebSocket | Native WebSocket |

---

## 4. Page Structure

```
/                     → Dashboard (satellite list)
/satellites/:id       → Satellite details
/terminal/:id         → Full-screen terminal
/provision            → Provision new agent
/audit                → Audit logs
/settings             → User settings
/admin                → Admin panel (users, API keys)
/login                → Login page
```

---

## 5. Components

### 5.1 Dashboard

The main view showing all satellites.

```
┌────────────────────────────────────────────────────────────────────┐
│  🛰️ Satellite Hive                    [Search...]  [+ Provision]   │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Filters: [All ▼] [Tags: production ×] [Tags: web ×]  [Clear]      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ● web-server-01        Linux    45% CPU  62% Mem  [Connect] │   │
│  │   192.168.1.100        Ubuntu   production, web, us-east     │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ● web-server-02        Linux    38% CPU  54% Mem  [Connect] │   │
│  │   192.168.1.101        Ubuntu   production, web, us-east     │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ○ db-server-01         Linux    --       --       [Offline] │   │
│  │   192.168.1.200        Ubuntu   production, database         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Showing 3 of 3 satellites  │  2 online  │  1 offline             │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Real-time status updates (green/red indicator)
- Quick metrics (CPU, Memory)
- Tag-based filtering
- Search by name/hostname
- Sort by name, status, CPU, memory
- Quick connect button
- Bulk selection for batch operations

### 5.2 Satellite Card

```tsx
interface SatelliteCardProps {
  satellite: Satellite;
  onConnect: () => void;
  onSelect: () => void;
  selected: boolean;
}

// Visual states
// ● Online  (green dot, full metrics)
// ○ Offline (gray dot, "Last seen: X ago")
// ◐ Connecting (yellow dot, spinner)
```

### 5.3 Satellite Detail View

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Back    web-server-01                    [Edit] [Delete] [···]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Status: ● Online          First seen: Jan 15, 2026               │
│  Last heartbeat: 5 seconds ago                                     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  System Information                                          │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │  Hostname:    web-server-01.example.com                      │   │
│  │  OS:          Ubuntu 22.04.3 LTS (x86_64)                    │   │
│  │  Kernel:      5.15.0-91-generic                              │   │
│  │  Uptime:      10 days, 4 hours                               │   │
│  │  IP:          192.168.1.100 (eth0)                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Metrics                                    [Last 1 hour ▼]  │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │  CPU ████████░░░░░░░░░░░░ 45%    Memory ████████████░░░░ 62% │   │
│  │  Disk ██████████░░░░░░░░░ 53%    Load: 2.1, 1.8, 1.5        │   │
│  │                                                              │   │
│  │  [Chart: CPU/Memory over time]                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Tags                                                [Edit]  │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │  [production] [web] [us-east-1]                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Quick Actions                                               │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │  [🖥️ Open Terminal]  [⚡ Run Command]  [🔄 Reboot]  [⏻ Shutdown] │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Active Sessions (1)                                         │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │  sess_xyz789  │  Started 5 min ago  │  user@example.com     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 5.4 Terminal Component

Full-featured terminal emulator using xterm.js.

```
┌────────────────────────────────────────────────────────────────────┐
│  Terminal: web-server-01        [Split] [Fullscreen] [Disconnect]  │
├────────────────────────────────────────────────────────────────────┤
│ user@web-server-01:~$ ls -la                                       │
│ total 32                                                           │
│ drwxr-xr-x  5 user user 4096 Feb  5 05:42 .                       │
│ drwxr-xr-x  3 root root 4096 Jan 15 10:30 ..                      │
│ -rw-r--r--  1 user user  220 Jan 15 10:30 .bash_logout            │
│ -rw-r--r--  1 user user 3771 Jan 15 10:30 .bashrc                 │
│ drwxr-xr-x  2 user user 4096 Jan 15 10:35 app                     │
│ drwxr-xr-x  2 user user 4096 Jan 15 10:35 config                  │
│ drwxr-xr-x  2 user user 4096 Feb  5 05:40 logs                    │
│ user@web-server-01:~$ █                                            │
│                                                                     │
│                                                                     │
│                                                                     │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Full xterm.js integration
- WebGL rendering for performance
- Auto-resize on window change
- Copy/paste support
- Scrollback buffer (10,000 lines)
- Search in terminal
- Split panes (horizontal/vertical)
- Multiple tabs
- Keyboard shortcuts
- Custom color schemes

**Implementation:**
```tsx
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from 'xterm-addon-webgl';
import { SearchAddon } from 'xterm-addon-search';

function TerminalComponent({ sessionId }: { sessionId: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  
  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, monospace',
      theme: {
        background: '#1a1b26',
        foreground: '#a9b1d6',
        // ... tokyo night theme
      }
    });
    
    const fitAddon = new FitAddon();
    const webglAddon = new WebglAddon();
    const searchAddon = new SearchAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webglAddon);
    term.loadAddon(searchAddon);
    
    term.open(terminalRef.current!);
    fitAddon.fit();
    
    // Connect to WebSocket for this session
    const ws = new WebSocket(`wss://api/ws/ui?token=${token}`);
    
    // Handle terminal output
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.event === 'session:output' && msg.data.session_id === sessionId) {
        term.write(atob(msg.data.output));
      }
    };
    
    // Send terminal input
    term.onData((data) => {
      ws.send(JSON.stringify({
        action: 'session:input',
        data: { session_id: sessionId, input: btoa(data) }
      }));
    });
    
    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      ws.send(JSON.stringify({
        action: 'session:resize',
        data: { session_id: sessionId, cols: term.cols, rows: term.rows }
      }));
    });
    resizeObserver.observe(terminalRef.current!);
    
    return () => {
      term.dispose();
      ws.close();
    };
  }, [sessionId]);
  
  return <div ref={terminalRef} className="h-full w-full" />;
}
```

### 5.5 Provision Page

```
┌────────────────────────────────────────────────────────────────────┐
│  Provision New Satellite                                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Name:     [________________________]                              │
│                                                                     │
│  Tags:     [production] [web] [+ Add tag]                          │
│                                                                     │
│  Platform: ○ Linux (amd64)                                         │
│            ○ Linux (arm64)                                         │
│            ○ Windows (amd64)                                       │
│            ○ macOS (amd64)                                         │
│            ○ macOS (arm64)                                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Advanced Options                                    [Show]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                                    [Cancel]  [Generate Agent]      │
│                                                                     │
├────────────────────────────────────────────────────────────────────┤
│  After generation:                                                  │
│                                                                     │
│  Download: [📥 Download satellite-agent-linux-amd64]               │
│                                                                     │
│  Or install via command:                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ curl -fsSL https://hive.example.com/install/tok_xxx | bash  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                            [Copy]  │
│                                                                     │
│  ⚠️ This link expires in 24 hours                                  │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 5.6 Audit Log View

```
┌────────────────────────────────────────────────────────────────────┐
│  Audit Logs                                                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Filters: [All Actions ▼] [All Users ▼] [All Satellites ▼]        │
│  Date Range: [Last 7 days ▼]                          [Export CSV] │
│                                                                     │
│  ┌────────┬──────────┬────────────┬───────────────┬────────────┐  │
│  │ Time   │ Actor    │ Action     │ Target        │ Result     │  │
│  ├────────┼──────────┼────────────┼───────────────┼────────────┤  │
│  │ 5m ago │ admin    │ exec       │ web-server-01 │ ✓ Success  │  │
│  │ 10m ago│ mcp      │ list       │ -             │ ✓ Success  │  │
│  │ 15m ago│ admin    │ session    │ web-server-02 │ ✓ Success  │  │
│  │ 1h ago │ operator │ power      │ db-server-01  │ ✗ Failed   │  │
│  │ 2h ago │ mcp      │ exec       │ tag:web       │ ✓ Success  │  │
│  └────────┴──────────┴────────────┴───────────────┴────────────┘  │
│                                                                     │
│  [← Previous]  Page 1 of 10  [Next →]                              │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. State Management

### 6.1 Zustand Store

```typescript
interface HiveState {
  // Satellites
  satellites: Map<string, Satellite>;
  selectedSatelliteId: string | null;
  filters: SatelliteFilters;
  
  // Sessions
  sessions: Map<string, Session>;
  activeSessionId: string | null;
  
  // UI
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  
  // Auth
  user: User | null;
  token: string | null;
  
  // Actions
  setSatellites: (satellites: Satellite[]) => void;
  updateSatellite: (id: string, updates: Partial<Satellite>) => void;
  removeSatellite: (id: string) => void;
  createSession: (satelliteId: string) => Promise<Session>;
  closeSession: (sessionId: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const useHiveStore = create<HiveState>((set, get) => ({
  satellites: new Map(),
  selectedSatelliteId: null,
  filters: { status: 'all', tags: [], search: '' },
  sessions: new Map(),
  activeSessionId: null,
  theme: 'system',
  sidebarCollapsed: false,
  user: null,
  token: localStorage.getItem('token'),
  
  // ... action implementations
}));
```

### 6.2 WebSocket Connection

```typescript
class HiveWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  
  connect(token: string) {
    this.ws = new WebSocket(`wss://${API_HOST}/ws/ui?token=${token}`);
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log('WebSocket connected');
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onclose = () => {
      this.scheduleReconnect();
    };
  }
  
  private handleMessage(message: WSMessage) {
    const store = useHiveStore.getState();
    
    switch (message.event) {
      case 'satellite:online':
        store.updateSatellite(message.data.id, { 
          status: 'online',
          ...message.data 
        });
        break;
        
      case 'satellite:offline':
        store.updateSatellite(message.data.id, { 
          status: 'offline',
          lastSeen: message.data.last_seen 
        });
        break;
        
      case 'satellite:metrics':
        store.updateSatellite(message.data.id, { 
          metrics: message.data.metrics 
        });
        break;
        
      case 'session:output':
        // Handled by terminal component directly
        break;
    }
  }
  
  send(action: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, data }));
    }
  }
}
```

---

## 7. Theming

### 7.1 Color Palette

```css
/* Light Theme */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border: #e2e8f0;
  --accent: #3b82f6;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
}

/* Dark Theme */
:root.dark {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-muted: #64748b;
  --border: #334155;
  --accent: #60a5fa;
  --success: #4ade80;
  --warning: #fbbf24;
  --error: #f87171;
}
```

### 7.2 Terminal Themes

```typescript
const terminalThemes = {
  'tokyo-night': {
    background: '#1a1b26',
    foreground: '#a9b1d6',
    cursor: '#c0caf5',
    selection: '#33467c',
    black: '#15161e',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
  },
  'dracula': { /* ... */ },
  'monokai': { /* ... */ },
  'solarized-dark': { /* ... */ },
  'solarized-light': { /* ... */ },
};
```

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open command palette |
| `Ctrl+/` | Focus search |
| `Ctrl+N` | New terminal tab |
| `Ctrl+W` | Close current tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+Shift+D` | Split terminal |
| `Ctrl+Shift+F` | Search in terminal |
| `F11` | Toggle fullscreen |
| `Escape` | Close modal/dropdown |

---

## 9. Directory Structure

```
web-ui/
├── public/
│   ├── favicon.ico
│   └── manifest.json
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts
│   │   ├── satellites.ts
│   │   ├── sessions.ts
│   │   └── auth.ts
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── ...
│   │   ├── dashboard/
│   │   │   ├── SatelliteCard.tsx
│   │   │   ├── SatelliteList.tsx
│   │   │   └── FilterBar.tsx
│   │   ├── terminal/
│   │   │   ├── Terminal.tsx
│   │   │   ├── TerminalTabs.tsx
│   │   │   └── TerminalToolbar.tsx
│   │   ├── satellite/
│   │   │   ├── SatelliteDetail.tsx
│   │   │   ├── MetricsChart.tsx
│   │   │   └── TagEditor.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Layout.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useTerminal.ts
│   │   └── useAuth.ts
│   ├── store/
│   │   └── index.ts
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── SatelliteDetail.tsx
│   │   ├── Terminal.tsx
│   │   ├── Provision.tsx
│   │   ├── Audit.tsx
│   │   └── Login.tsx
│   ├── styles/
│   │   └── globals.css
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── format.ts
│       └── websocket.ts
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 10. Build & Deployment

### 10.1 Development

```bash
cd web-ui
npm install
npm run dev
```

### 10.2 Production Build

```bash
npm run build
# Output in dist/
```

### 10.3 Embedding in Server

The built UI is served by the central server as static files:

```typescript
// In central server
app.use('/', serveStatic({ root: './web-ui/dist' }));
app.get('*', (c) => c.html(/* index.html */));
```

---

## 11. Future Enhancements

- [ ] Multi-language support (i18n)
- [ ] Custom dashboard widgets
- [ ] Saved terminal layouts
- [ ] Command snippets/macros
- [ ] SSH key management
- [ ] File browser/transfer
- [ ] Collaborative sessions
- [ ] Mobile app (React Native)

