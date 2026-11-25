import { Server } from 'socket.io';
import { User } from '../models/User.js';
import { hasPermission } from '../types/permissions.js';
import { verifyRealtimeToken } from '../utils/jwt.js';
import { randomId } from '../utils/crypto.js';

export type IncidentRealtimeEventType = 'created' | 'status_changed' | 'assigned' | 'escalated' | 'resolved';
type RealtimeIdentity = { userId: string; role: string };
let io: Server | null = null;

export async function authenticateRealtimeTicket(ticket: string): Promise<RealtimeIdentity & { expiresAt: number }> {
  const payload = verifyRealtimeToken(ticket);
  const user = await User.findById(payload.sub).select('_id role isActive');
  if (!user?.isActive || !hasPermission(user.role, 'viewIncidents')) throw new Error('Real-time incident access is not permitted');
  return { userId: user._id.toString(), role: user.role, expiresAt: payload.exp ? payload.exp * 1000 : Date.now() };
}

export function attachRealtimeServer(server: Server): void {
  io = server;
  io.use(async (socket, next) => {
    try {
      const ticket = socket.handshake.auth?.ticket;
      if (typeof ticket !== 'string' || !ticket) return next(new Error('A real-time ticket is required'));
      const identity = await authenticateRealtimeTicket(ticket);
      socket.data.identity = { userId: identity.userId, role: identity.role } satisfies RealtimeIdentity;
      socket.data.ticketExpiresAt = identity.expiresAt;
      next();
    } catch {
      next(new Error('Real-time authentication failed'));
    }
  });
  io.on('connection', (socket) => {
    socket.join('incident-operators');
    const remaining = Number(socket.data.ticketExpiresAt) - Date.now();
    const expireTimer = setTimeout(() => socket.disconnect(true), Math.max(0, remaining));
    expireTimer.unref();
    socket.on('disconnect', () => clearTimeout(expireTimer));
    socket.emit('realtime:ready', { connected: true });
  });
}

/** Emit IDs and coarse event types only. Clients retrieve authorized details through the API. */
export function broadcastIncidentEvent(type: IncidentRealtimeEventType, incidentId: string): void {
  if (!io) return;
  io.to('incident-operators').emit('incident:event', {
    eventId: randomId(12), type, incidentId, occurredAt: new Date().toISOString(),
  });
}
