'use client';
import api from '@/services/api';

// Direct messages from the browser (D71). Same-origin proxy, so no client here
// holds a token. The words of a message come back only to the two people in the
// conversation; a notice about one never carries them.

interface Envelope<T> {
  data: T;
}
const unwrap = <T,>(res: { data: Envelope<T> }): T => res.data.data;

export const MAX_MESSAGE = 2000;

// Fired when something changes the unread count, so the header badge follows
// without waiting for its poll.
export const MESSAGES_CHANGED = 'hcp:messages-changed';
export const announceMessagesChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MESSAGES_CHANGED));
};

export interface MessagePerson {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  avatarPosition: string | null;
  deleted: boolean;
}

export type ConversationStatus = 'REQUESTED' | 'ACTIVE' | 'DECLINED';
export type MessageStatus = 'SENT' | 'DELETED' | 'REMOVED';

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  mine: boolean;
  // Null once unsent or removed: the message keeps its place and loses its words.
  body: string | null;
  status: MessageStatus;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  status: ConversationStatus;
  // I am the one being asked.
  isRequest: boolean;
  other: MessagePerson | null;
  lastMessage: DirectMessage | null;
  unreadCount: number;
  muted: boolean;
  lastMessageAt: string;
}

export interface ConversationDetail {
  id: string;
  status: ConversationStatus;
  isRequest: boolean;
  other: MessagePerson | null;
  muted: boolean;
  canReply: boolean;
  createdAt: string;
}

export interface CanMessage {
  allowed: boolean;
  conversationId: string | null;
  reason: 'SELF' | 'NOT_FOUND' | 'CLOSED' | 'UNAVAILABLE' | null;
}

export type Box = 'inbox' | 'requests';

export async function listConversations(box: Box, page = 1, limit = 30) {
  return unwrap(
    await api.get<Envelope<{ items: ConversationSummary[]; total: number; page: number; limit: number }>>(
      `/me/conversations?box=${box}&page=${page}&limit=${limit}`,
    ),
  );
}

export async function unreadCounts() {
  return unwrap(await api.get<Envelope<{ unread: number; requests: number }>>('/me/conversations/unread'));
}

export async function canMessage(userId: string) {
  return unwrap(await api.get<Envelope<CanMessage>>(`/hashers/${userId}/can-message`));
}

export async function getConversation(id: string) {
  return unwrap(await api.get<Envelope<ConversationDetail>>(`/conversations/${id}`));
}

// Newest first; `before` is the id of the oldest message already on screen.
export async function getMessages(id: string, opts: { before?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (opts.before) q.set('before', opts.before);
  q.set('limit', String(opts.limit ?? 40));
  return unwrap(await api.get<Envelope<{ items: DirectMessage[]; hasMore: boolean }>>(`/conversations/${id}/messages?${q}`));
}

export async function startConversation(userId: string, body: string, clientKey: string) {
  return unwrap(
    await api.post<Envelope<{ message: DirectMessage; conversationId: string; status: ConversationStatus }>>('/conversations', {
      userId,
      body,
      clientKey,
    }),
  );
}

export async function sendMessage(id: string, body: string, clientKey: string) {
  return unwrap(
    await api.post<Envelope<{ message: DirectMessage; conversationId: string; status: ConversationStatus }>>(
      `/conversations/${id}/messages`,
      { body, clientKey },
    ),
  );
}

export const markConversationRead = (id: string) => api.post(`/conversations/${id}/read`);
export const acceptRequest = (id: string) => api.post(`/conversations/${id}/accept`);
export const declineRequest = (id: string) => api.post(`/conversations/${id}/decline`);
export const setConversationMuted = (id: string, muted: boolean) => api.put(`/conversations/${id}/mute`, { muted });
export const archiveConversation = (id: string) => api.post(`/conversations/${id}/archive`);
export const unsendMessage = (id: string) => api.delete(`/messages/${id}`);

export function clientKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function shortTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * 86_400_000) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
