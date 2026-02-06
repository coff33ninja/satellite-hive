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

export interface HiveState {
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
  
  setToken: (token: string | null) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },
  
  setUser: (user: any) => set({ user }),
  
  setSatellites: (satellites: Satellite[]) => set({ satellites }),
  
  updateSatellite: (id: string, updates: Partial<Satellite>) => set((state: HiveState) => ({
    satellites: state.satellites.map((s: Satellite) => 
      s.id === id ? { ...s, ...updates } : s
    ),
  })),
  
  addSession: (session: Session) => set((state: HiveState) => {
    const sessions = new Map(state.sessions);
    sessions.set(session.id, session);
    return { sessions };
  }),
  
  removeSession: (id: string) => set((state: HiveState) => {
    const sessions = new Map(state.sessions);
    sessions.delete(id);
    return { sessions };
  }),
}));
