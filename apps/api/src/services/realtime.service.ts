import crypto from 'crypto';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';

// Realtime delivery over socket.io (D72).
//
// The socket only ever carries what REST already decided to show. It is
// receive-only: a client sends nothing over it (every inbound event is
// ignored), so validation, rate limits, block checks and the request rules in
// direct-message.service all still apply to every write. After a change commits,
// the service tells the affected hashers' rooms; the room is the hasher, never
// a conversation, so there is no join request to authorise and a block cannot
// be bypassed by staying subscribed to something.
//
// Authentication. Browsers never hold a token (they go through the same-origin
// proxy), so they cannot hand the API an access token. Instead a signed-in
// client asks `POST /me/realtime-ticket` (through the proxy, or with its bearer
// token on mobile) for a ticket: a JWT with its own audience and secret, good
// for 60 seconds and for one connection. It cannot be used as an access token.
//
// A connection lives at most MAX_AGE_MS, then the server closes it and the
// client reconnects with a fresh ticket, which needs a live session. That is
// what makes a logout, a suspension or a deleted account bite within minutes.
//
// One process only: rooms are in memory, like the outbox. With more than one API
// instance add @socket.io/adapter-redis (or similar) here and nothing else changes.

const TICKET_TTL_SECONDS = 60;
const MAX_AGE_MS = Number(process.env.REALTIME_MAX_AGE_MS ?? 10 * 60 * 1000);
const MAX_SOCKETS_PER_USER = 8;
const AUDIENCE = 'hcp-realtime';

const secret = () => `${env.jwtAccessSecret}:realtime`;

// Tickets already used. Held until they would have expired anyway.
const used = new Map<string, number>();
function markUsed(jti: string, expiresAtMs: number) {
  const now = Date.now();
  for (const [key, until] of used) if (until < now) used.delete(key);
  if (used.has(jti)) return false;
  used.set(jti, expiresAtMs);
  return true;
}

export function issueTicket(userId: string) {
  const ticket = jwt.sign({ sub: userId, jti: crypto.randomUUID() }, secret(), {
    audience: AUDIENCE,
    expiresIn: TICKET_TTL_SECONDS,
  });
  return { ticket, expiresIn: TICKET_TTL_SECONDS };
}

function redeemTicket(ticket: unknown): string | null {
  if (typeof ticket !== 'string' || ticket.length > 2000) return null;
  try {
    const payload = jwt.verify(ticket, secret(), { audience: AUDIENCE }) as { sub: string; jti: string; exp: number };
    return markUsed(payload.jti, payload.exp * 1000) ? payload.sub : null;
  } catch {
    return null;
  }
}

const room = (userId: string) => `user:${userId}`;

let io: Server | null = null;

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    // Nothing a client could legitimately send is large.
    maxHttpBufferSize: 10_000,
    cors: { origin: env.corsOrigins },
    // A browser's Origin is checked on the websocket upgrade too, which CORS
    // alone does not do. No Origin (the mobile app, a script) is allowed: the
    // ticket is the credential.
    allowRequest(req, callback) {
      const origin = req.headers.origin;
      callback(null, !origin || env.corsOrigins.includes(origin));
    },
  });

  io.use(async (socket, next) => {
    const userId = redeemTicket(socket.handshake.auth?.ticket);
    if (!userId) return next(new Error('UNAUTHORIZED'));
    const user = await prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    if (!user) return next(new Error('UNAUTHORIZED'));
    if ((await io!.in(room(userId)).fetchSockets()).length >= MAX_SOCKETS_PER_USER) {
      return next(new Error('TOO_MANY_CONNECTIONS'));
    }
    socket.data.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    void socket.join(room(socket.data.userId as string));
    socket.emit('ready', { maxAgeMs: MAX_AGE_MS });
    // Bounded life: the client reconnects with a fresh ticket.
    const timer = setTimeout(() => socket.disconnect(true), MAX_AGE_MS);
    socket.on('disconnect', () => clearTimeout(timer));
    // Receive-only. Anything a client emits is dropped.
    socket.onAny(() => undefined);
  });

  logger.info('Realtime (socket.io) attached');
}

export function closeRealtime() {
  void io?.close();
  io = null;
}

// Which conversation a hasher has open right now. The socket is receive-only, so
// the open page says so over REST, as a heartbeat; it lapses on its own if the
// tab dies without saying goodbye. A notice for a conversation someone is
// looking at would only count what they are already reading. In memory, like
// the rooms: with more than one API instance this moves next to the adapter.
const ACTIVE_TTL_MS = 40_000;
const active = new Map<string, Map<string, number>>();

export function setConversationActive(userId: string, conversationId: string, on: boolean) {
  const now = Date.now();
  const mine = active.get(userId) ?? new Map<string, number>();
  for (const [id, until] of mine) if (until < now) mine.delete(id);
  if (on) mine.set(conversationId, now + ACTIVE_TTL_MS);
  else mine.delete(conversationId);
  if (mine.size) active.set(userId, mine);
  else active.delete(userId);
}

export function isConversationActive(userId: string, conversationId: string) {
  return (active.get(userId)?.get(conversationId) ?? 0) > Date.now();
}

// Tell one hasher, on every device they are connected from. Never throws: a
// failed push must not undo or fail the change it describes (the client's
// fallback poll catches up). Returns how many devices were connected to hear it,
// which is what a delivery receipt is built on (D73).
export function emitToUser(userId: string, event: string, payload: unknown) {
  try {
    io?.to(room(userId)).emit(event, payload);
    return io?.sockets.adapter.rooms.get(room(userId))?.size ?? 0;
  } catch (error) {
    logger.warn(`realtime emit ${event} failed: ${(error as Error).message}`);
    return 0;
  }
}
