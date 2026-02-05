import { create } from 'zustand';

interface Satellite {
  id: string;
  name: string;
  status: 'online' | 'offline';
  hostname?: string;
  os?: string;
  isOnline: boolean;
  lastSeen?: string;
  tags: string[];
}

interface Session {
  id: string;
  satelliteId: string;
  status: 'active' | 'ended';
}

interface HiveState {
  // Auth
  token: string | null;
  user: any | null;
  
  // Satellites
  satellites: Satellite[];
  
  // Sessions
  sessions: Map<string, Session>;
  
  // Actions
  setToken: (token: string | null) => void;
  setUser: (user: any) => void;
  setSatellites: (satellites: Satellite[]) => void;
  updateSatellite: (id: string, updates: Partial<Satellite>) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
}

export const useHiveStore = create<HiveState>((set) => ({
  token: localStorage.getItem('token'),
  user: null,
  satellites: [],
  sessions: new Map(),
  
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },
  
  setUser: (user) => set({ user }),
  
  setSatellites: (satellites) => set({ satellites }),
  
  updateSatellite: (id, updates) => set((state) => ({
    satellites: state.satellites.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ),
  })),
  
  addSession: (session) => set((state) => {
    const sessions = new Map(state.sessions);
    sessions.set(session.id, session);
    return { sessions };
  }),
  
  removeSession: (id) => set((state) => {
    const sessions = new Map(state.sessions);
    sessions.delete(id);
    return { sessions };
  }),
}));
