'use client';
import api from '@/services/api';

// Direct messages from the browser (D71, widened by D73). Same-origin proxy, so
// no client here holds a token. The words and files of a message come back only
// to the two people in the conversation; a notice about one never carries them.

interface Envelope<T> {
  data: T;
}
const unwrap = <T,>(res: { data: Envelope<T> }): T => res.data.data;

export const MAX_MESSAGE = 2000;
export const MAX_CAPTION = 1000;
export const MAX_ATTACHMENTS = 10;
// The API holds the same numbers (services/direct-media.service.ts).
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 300;
export const ACCEPTED_ATTACHMENTS = 'image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm';

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
  // Passed on from another conversation.
  forwarded: boolean;
  // The earlier message this one answers, read from that message as it is now.
  replyTo: ReplyQuote | null;
  // Set while the message is pinned; pins are shared by both people.
  pinnedAt: string | null;
}

export interface ReplyQuote {
  id: string;
  mine: boolean;
  kind: MessageKind;
  status: MessageStatus;
  preview: string;
}

export interface PinnedMessage {
  id: string;
  mine: boolean;
  kind: MessageKind;
  preview: string;
  pinnedAt: string;
}

export const MAX_PINS = 3;

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
  // I am the one being asked.
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
  pins: PinnedMessage[];
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

export type SendInput = (
  | { kind: 'TEXT'; body: string }
  | { kind: 'MEDIA'; attachmentIds: string[]; body?: string }
  | { kind: 'VOICE'; attachmentIds: string[] }
  | { kind: 'STICKER'; stickerId: string }
) & { replyToId?: string };

export async function sendMessage(id: string, input: SendInput, clientKey: string) {
  return unwrap(
    await api.post<Envelope<{ message: DirectMessage; conversationId: string; status: ConversationStatus }>>(
      `/conversations/${id}/messages`,
      { ...input, clientKey },
    ),
  );
}

// Two minutes after sending, no longer (D73). There is no unsend.
export async function editMessage(id: string, body: string) {
  return unwrap(await api.patch<Envelope<{ message: DirectMessage }>>(`/messages/${id}`, { body }));
}

export interface ForwardResult {
  conversationId: string;
  sent: number;
  error: { code: string; message: string } | null;
}

// Messages are passed on in the order they were sent, into conversations I am already in.
export async function forwardMessages(fromId: string, messageIds: string[], toConversationIds: string[]) {
  return unwrap(
    await api.post<Envelope<{ results: ForwardResult[] }>>(`/conversations/${fromId}/forward`, { messageIds, toConversationIds }),
  ).results;
}

export async function pinMessage(id: string, pinned: boolean) {
  return unwrap(await api.put<Envelope<{ message: DirectMessage }>>(`/messages/${id}/pin`, { pinned })).message;
}

// "I am looking at this conversation": while it holds, its new messages stay out of the bell.
export const setConversationActive = (id: string, active: boolean) =>
  active ? api.put(`/conversations/${id}/active`) : api.delete(`/conversations/${id}/active`);

/** The words of a message that can be copied; nothing for a sticker or a voice note. */
export const copyableText = (m: DirectMessage) =>
  m.status === 'SENT' && (m.kind === 'TEXT' || m.kind === 'MEDIA') ? (m.body ?? '').trim() : '';

export const markConversationRead = (id: string) => api.post(`/conversations/${id}/read`);
export const acceptRequest = (id: string) => api.post(`/conversations/${id}/accept`);
export const declineRequest = (id: string) => api.post(`/conversations/${id}/decline`);
export const setConversationMuted = (id: string, muted: boolean) => api.put(`/conversations/${id}/mute`, { muted });
export const archiveConversation = (id: string) => api.post(`/conversations/${id}/archive`);

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

// XMLHttpRequest rather than fetch, so a clip on a slow connection can say how far
// it has got.
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

// "audio/webm;codecs=opus" is a recorder's way of saying audio/webm.
const bare = (mime: string) => mime.split(';')[0].trim().toLowerCase();

/** Photo, clip or recording: ask for a target, PUT the bytes, confirm. */
export async function uploadAttachment(
  conversationId: string,
  file: Blob,
  info: { kind: 'PHOTO' | 'VIDEO' | 'AUDIO'; width?: number | null; height?: number | null; durationSec?: number | null },
  onProgress?: (fraction: number) => void,
) {
  const mimeType = bare(file.type);
  const asked = unwrap(
    await api.post<Envelope<{ attachment: { id: string }; upload: UploadTarget }>>(`/conversations/${conversationId}/uploads`, {
      kind: info.kind,
      mimeType,
      sizeBytes: file.size,
      ...(info.width ? { width: info.width } : {}),
      ...(info.height ? { height: info.height } : {}),
      ...(info.durationSec ? { durationSec: Math.round(info.durationSec * 10) / 10 } : {}),
    }),
  );
  await put(asked.upload.url, { 'Content-Type': mimeType }, file, onProgress);
  const confirmed = unwrap(
    await api.post<Envelope<{ attachment: UploadedAttachment }>>(`/dm-uploads/${asked.attachment.id}/confirm`, {
      ...(info.width ? { width: info.width } : {}),
      ...(info.height ? { height: info.height } : {}),
      ...(info.durationSec ? { durationSec: Math.round(info.durationSec * 10) / 10 } : {}),
    }),
  );
  return confirmed.attachment;
}

/** Width and height of a picture, measured in the browser; a failure is not worth failing an upload over. */
export async function pictureSize(file: Blob): Promise<{ width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

/** Length and size of a clip, read by the browser from the file itself. */
export function mediaLength(file: Blob, kind: 'video' | 'audio'): Promise<{ durationSec: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    const url = URL.createObjectURL(file);
    const done = (value: { durationSec: number | null; width: number | null; height: number | null }) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () =>
      done({
        durationSec: Number.isFinite(el.duration) ? el.duration : null,
        width: kind === 'video' ? (el as HTMLVideoElement).videoWidth || null : null,
        height: kind === 'video' ? (el as HTMLVideoElement).videoHeight || null : null,
      });
    el.onerror = () => done({ durationSec: null, width: null, height: null });
    el.src = url;
  });
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

export async function getStickers() {
  return unwrap(await api.get<Envelope<StickerTray>>('/me/stickers'));
}

/** A finished sticker (a square PNG or WebP, up to 512KB) becomes one in my tray. */
export async function createSticker(image: Blob, size: { width: number; height: number }) {
  const mimeType = bare(image.type);
  const asked = unwrap(
    await api.post<Envelope<{ sticker: { id: string }; upload: UploadTarget }>>('/me/stickers', {
      mimeType,
      sizeBytes: image.size,
      width: size.width,
      height: size.height,
    }),
  );
  await put(asked.upload.url, { 'Content-Type': mimeType }, image);
  return unwrap(await api.post<Envelope<{ sticker: Sticker }>>(`/me/stickers/${asked.sticker.id}/confirm`)).sticker;
}

export const deleteSticker = (id: string) => api.delete(`/me/stickers/${id}`);
export const setStickerFavorite = (id: string, favorite: boolean) =>
  favorite ? api.put(`/me/stickers/${id}/favorite`) : api.delete(`/me/stickers/${id}/favorite`);

// ─── Small helpers ───

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

/** 0:07, 1:32. */
export function clockTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
