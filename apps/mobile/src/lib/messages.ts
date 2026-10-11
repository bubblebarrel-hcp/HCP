import { api } from '@/lib/api';

// Direct messages (D71), mirroring apps/web/lib/messages.ts against the same
// API. The words of a message come back only to the two people in the
// conversation; a notification about one never carries them.

export const MAX_MESSAGE = 2000;

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
type Sent = { message: DirectMessage; conversationId: string; status: ConversationStatus };

export const listConversations = (box: Box, page = 1, limit = 30) =>
  api<{ items: ConversationSummary[]; total: number; page: number; limit: number }>(
    `/me/conversations?box=${box}&page=${page}&limit=${limit}`,
  );
export const unreadCounts = () => api<{ unread: number; requests: number }>('/me/conversations/unread');
export const canMessage = (userId: string) => api<CanMessage>(`/hashers/${userId}/can-message`);
export const getConversation = (id: string) => api<ConversationDetail>(`/conversations/${id}`);
export const getMessages = (id: string, opts: { before?: string; limit?: number } = {}) =>
  api<{ items: DirectMessage[]; hasMore: boolean }>(
    `/conversations/${id}/messages?limit=${opts.limit ?? 40}${opts.before ? `&before=${opts.before}` : ''}`,
  );
export const startConversation = (userId: string, body: string, clientKey: string) =>
  api<Sent>('/conversations', { method: 'POST', body: { userId, body, clientKey } });
export const sendMessage = (id: string, body: string, clientKey: string) =>
  api<Sent>(`/conversations/${id}/messages`, { method: 'POST', body: { body, clientKey } });
export const markConversationRead = (id: string) => api(`/conversations/${id}/read`, { method: 'POST' });
export const acceptRequest = (id: string) => api(`/conversations/${id}/accept`, { method: 'POST' });
export const declineRequest = (id: string) => api(`/conversations/${id}/decline`, { method: 'POST' });
export const setConversationMuted = (id: string, muted: boolean) =>
  api(`/conversations/${id}/mute`, { method: 'PUT', body: { muted } });
export const archiveConversation = (id: string) => api(`/conversations/${id}/archive`, { method: 'POST' });
export const unsendMessage = (id: string) => api(`/messages/${id}`, { method: 'DELETE' });

export const clientKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function shortTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * 86_400_000) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
