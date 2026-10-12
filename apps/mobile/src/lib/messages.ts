import { api } from '@/lib/api';

// Direct messages (D71, widened by D73), mirroring apps/web/lib/messages.ts
// against the same API. The words and files of a message come back only to the two
// people in the conversation; a notification about one never carries them.

export const MAX_MESSAGE = 2000;
export const MAX_CAPTION = 1000;
export const MAX_ATTACHMENTS = 10;
// The API holds the same numbers (services/direct-media.service.ts).
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 300;

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
export type MessageKind = 'TEXT' | 'MEDIA' | 'STICKER' | 'VOICE';
// SENT is one tick, DELIVERED two, SEEN two in the brand colour (D73).
export type Receipt = 'SENT' | 'DELIVERED' | 'SEEN';

export interface MessageAttachment {
  id: string;
  kind: 'PHOTO' | 'VIDEO' | 'AUDIO';
  mimeType: string;
  // A short-lived signed address: never stored, re-read with the message.
  url: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  sizeBytes: number;
}

export interface MessageSticker {
  id: string;
  url: string | null;
  width: number | null;
  height: number | null;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  mine: boolean;
  kind: MessageKind;
  // Null once removed by staff: the message keeps its place and loses its words.
  body: string | null;
  status: MessageStatus;
  createdAt: string;
  editedAt: string | null;
  // While this is in the future the sender may still edit the words.
  editableUntil: string | null;
  attachments: MessageAttachment[];
  sticker: MessageSticker | null;
  // Only on my own messages.
  receipt: Receipt | null;
}

export interface LastMessage {
  id: string;
  mine: boolean;
  kind: MessageKind;
  status: MessageStatus;
  // The words for a text message, a label ("Photo", "Sticker") for the rest.
  preview: string;
  body: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  status: ConversationStatus;
  isRequest: boolean;
  other: MessagePerson | null;
  lastMessage: LastMessage | null;
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
  // Pictures, stickers and voice wait for the conversation to be accepted.
  canShareFiles: boolean;
  editWindowMs: number;
  createdAt: string;
}

export interface CanMessage {
  allowed: boolean;
  conversationId: string | null;
  reason: 'SELF' | 'NOT_FOUND' | 'CLOSED' | 'UNAVAILABLE' | null;
}

export type Box = 'inbox' | 'requests';
type Sent = { message: DirectMessage; conversationId: string; status: ConversationStatus };

export type SendInput =
  | { kind: 'TEXT'; body: string }
  | { kind: 'MEDIA'; attachmentIds: string[]; body?: string }
  | { kind: 'VOICE'; attachmentIds: string[] }
  | { kind: 'STICKER'; stickerId: string };

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
export const sendMessage = (id: string, input: SendInput, clientKey: string) =>
  api<Sent>(`/conversations/${id}/messages`, { method: 'POST', body: { ...input, clientKey } });
// Two minutes after sending, no longer (D73). There is no unsend.
export const editMessage = (id: string, body: string) => api<{ message: DirectMessage }>(`/messages/${id}`, { method: 'PATCH', body: { body } });
export const markConversationRead = (id: string) => api(`/conversations/${id}/read`, { method: 'POST' });
export const acceptRequest = (id: string) => api(`/conversations/${id}/accept`, { method: 'POST' });
export const declineRequest = (id: string) => api(`/conversations/${id}/decline`, { method: 'POST' });
export const setConversationMuted = (id: string, muted: boolean) =>
  api(`/conversations/${id}/mute`, { method: 'PUT', body: { muted } });
export const archiveConversation = (id: string) => api(`/conversations/${id}/archive`, { method: 'POST' });

// ─── Files ───

interface UploadTarget {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export interface UploadedAttachment {
  id: string;
  kind: 'PHOTO' | 'VIDEO' | 'AUDIO';
  mimeType: string;
  url: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  sizeBytes: number;
}

function put(url: string, headers: Record<string, string>, body: Blob, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? (onProgress?.(1), resolve()) : reject(new Error(`Storage rejected the upload (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('The upload could not reach storage. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('The upload timed out. Try again on a better connection.'));
    xhr.send(body);
  });
}

const bare = (mime: string) => mime.split(';')[0].trim().toLowerCase();

/** Photo, clip or recording: ask for a target, PUT the bytes, confirm. */
export async function uploadAttachment(
  conversationId: string,
  uri: string,
  info: { kind: 'PHOTO' | 'VIDEO' | 'AUDIO'; mimeType: string; width?: number | null; height?: number | null; durationSec?: number | null },
  onProgress?: (fraction: number) => void,
) {
  // The size the picker reports can be missing; the bytes are the truth.
  const bytes = await (await fetch(uri)).blob();
  const mimeType = bare(info.mimeType);
  const duration = info.durationSec ? Math.round(info.durationSec * 10) / 10 : undefined;
  const asked = await api<{ attachment: { id: string }; upload: UploadTarget }>(`/conversations/${conversationId}/uploads`, {
    method: 'POST',
    body: {
      kind: info.kind,
      mimeType,
      sizeBytes: bytes.size,
      ...(info.width ? { width: info.width } : {}),
      ...(info.height ? { height: info.height } : {}),
      ...(duration ? { durationSec: duration } : {}),
    },
  });
  await put(asked.upload.url, { 'Content-Type': mimeType }, bytes, onProgress);
  const confirmed = await api<{ attachment: UploadedAttachment }>(`/dm-uploads/${asked.attachment.id}/confirm`, {
    method: 'POST',
    body: {
      ...(info.width ? { width: info.width } : {}),
      ...(info.height ? { height: info.height } : {}),
      ...(duration ? { durationSec: duration } : {}),
    },
  });
  return confirmed.attachment;
}

// ─── Stickers ───

export interface Sticker {
  id: string;
  url: string | null;
  width: number | null;
  height: number | null;
  mine: boolean;
  favorite: boolean;
}

export interface StickerTray {
  mine: Sticker[];
  favorites: Sticker[];
  recent: Sticker[];
}

export const getStickers = () => api<StickerTray>('/me/stickers');

/** A finished sticker (a square PNG or WebP, up to 512KB) becomes one in my tray. */
export async function createSticker(uri: string, mimeType: string, size: { width: number; height: number }) {
  const bytes = await (await fetch(uri)).blob();
  const type = bare(mimeType);
  const asked = await api<{ sticker: { id: string }; upload: UploadTarget }>('/me/stickers', {
    method: 'POST',
    body: { mimeType: type, sizeBytes: bytes.size, width: size.width, height: size.height },
  });
  await put(asked.upload.url, { 'Content-Type': type }, bytes);
  return (await api<{ sticker: Sticker }>(`/me/stickers/${asked.sticker.id}/confirm`, { method: 'POST' })).sticker;
}

export const deleteSticker = (id: string) => api(`/me/stickers/${id}`, { method: 'DELETE' });
export const setStickerFavorite = (id: string, favorite: boolean) =>
  api(`/me/stickers/${id}/favorite`, { method: favorite ? 'PUT' : 'DELETE' });

// ─── Small helpers ───

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

/** 0:07, 1:32. */
export function clockTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
