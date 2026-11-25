'use client';
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/config/api';

type IncidentEvent = { eventId: string; type: string; incidentId: string; occurredAt: string };
export function IncidentRealtime({ onIncidentEvent }: { onIncidentEvent: (event: IncidentEvent) => void }) {
  const [state, setState] = useState<'connecting'|'connected'|'reconnecting'|'unavailable'>('connecting');
  const handler = useRef(onIncidentEvent);
  const seen = useRef(new Set<string>());
  useEffect(() => { handler.current = onIncidentEvent; }, [onIncidentEvent]);
  useEffect(() => {
    let cancelled = false; let socket: Socket | null = null; let ticketTimer: ReturnType<typeof setInterval> | undefined;
    const serverUrl = API_BASE_URL.replace(/\/api\/?$/, '');
    const renewTicket = async () => {
      const response = await fetch('/api/session/realtime-ticket', { method: 'POST', cache: 'no-store' });
      if (!response.ok) throw new Error('Ticket renewal failed');
      const data = await response.json() as { ticket: string };
      if (socket && !cancelled) socket.auth = { ticket: data.ticket };
      return data.ticket;
    };
    const connect = async () => {
      try {
        const ticket = await renewTicket();
        if (cancelled) return;
        socket = io(serverUrl, { auth: { ticket }, transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000 });
        socket.on('connect', () => {
          setState('connected');
          handler.current({ eventId: `reconnected-${socket?.id ?? Date.now()}`, type: 'reconnected', incidentId: '', occurredAt: new Date().toISOString() });
        });
        socket.on('disconnect', (reason) => {
          setState('reconnecting');
          if (reason === 'io server disconnect') void renewTicket().then(() => socket?.connect()).catch(() => setState('unavailable'));
        });
        socket.on('connect_error', () => setState('unavailable'));
        socket.on('incident:event', (event: IncidentEvent) => {
          if (!event?.eventId || seen.current.has(event.eventId)) return;
          seen.current.add(event.eventId);
          if (seen.current.size > 200) seen.current.delete(seen.current.values().next().value!);
          handler.current(event);
        });
        ticketTimer = setInterval(() => { void renewTicket().then(() => { if (socket?.connected) socket.disconnect().connect(); }).catch(() => setState('unavailable')); }, 4 * 60 * 1000);
      } catch { setState('unavailable'); }
    };
    void connect();
    return () => { cancelled = true; if (ticketTimer) clearInterval(ticketTimer); socket?.disconnect(); };
  }, []);
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${state === 'connected' ? 'bg-emerald-100 text-emerald-800' : state === 'unavailable' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`} role="status" aria-live="polite">{state === 'connected' ? 'Live updates on' : state === 'unavailable' ? 'Live updates unavailable · API refresh active' : 'Connecting to live updates…'}</span>;
}
