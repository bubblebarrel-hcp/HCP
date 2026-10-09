'use client';
import api from '@/services/api';
import { uploadPhoto } from '@/lib/media';
import type { Audience, HasherPost, Page } from '@/lib/types';

// A hasher's written post (D51).
//
// Posting is three steps, the same shape reels use (D28, D48): create the draft
// so the photos have somewhere to land, upload them, then publish. A post with
// no photos runs the same road with the middle step empty — one flow rather
// than two, and nothing half-uploaded ever appears in the feed.

export const MAX_POST_BODY = 5000;
export const MAX_POST_PHOTOS = 4;
// The first post and its parts together; the API holds the same line.
export const MAX_THREAD_POSTS = 10;

interface Envelope<T> {
  data: T;
}

const unwrap = <T,>(res: { data: Envelope<T> }): T => res.data.data;

// Two to five answers and how long they stay open (D60).
export interface PollDraft {
  options: string[];
  hours: number;
}

export async function createDraft(input: {
  body: string;
  visibility?: Audience;
  kennelId?: string | null;
  runId?: string | null;
  poll?: PollDraft;
  // Makes this the next part of the thread whose first post this is.
  threadRootId?: string;
}) {
  return unwrap(await api.post<Envelope<{ post: HasherPost }>>('/posts', input)).post;
}

export async function publishPost(id: string) {
  return unwrap(await api.post<Envelope<{ post: HasherPost }>>(`/posts/${id}/publish`)).post;
}

export async function updatePost(id: string, body: string) {
  return unwrap(await api.patch<Envelope<{ post: HasherPost }>>(`/posts/${id}`, { body })).post;
}

export async function archivePost(id: string) {
  return unwrap(await api.post<Envelope<{ post: HasherPost }>>(`/posts/${id}/archive`)).post;
}

export async function listPosts(params: { page?: number; limit?: number; authorId?: string; runId?: string } = {}) {
  return unwrap(await api.get<Envelope<Page<HasherPost>>>('/posts', { params }));
}

// The whole act, so the composer does not have to know the shape of it.
// `onProgress` reports which photo is going up, because a slow upload with no
// sign of life reads as a hang.
export async function post(
  input: {
    body: string;
    photos: File[];
    visibility?: Audience;
    kennelId?: string | null;
    runId?: string | null;
    poll?: PollDraft;
    // The words of each later post in a thread, in order. They take the first
    // post's audience and run, and go up with it or not at all.
    thread?: string[];
  },
  onProgress?: (uploaded: number, total: number) => void,
): Promise<HasherPost> {
  const draft = await createDraft({
    body: input.body,
    visibility: input.visibility,
    kennelId: input.kennelId ?? null,
    runId: input.runId ?? null,
    poll: input.poll,
  });

  for (const [index, file] of input.photos.entries()) {
    onProgress?.(index, input.photos.length);
    // Sequential on purpose: a phone on a kennel's wifi uploading four photos
    // at once is four slow uploads, and a failure halfway leaves a draft that
    // was never published rather than a post with holes in it.
    await uploadPhoto(file, { type: 'POST', id: draft.id });
  }
  onProgress?.(input.photos.length, input.photos.length);

  // Each part is written in order, so its place in the chain is the order typed.
  for (const words of input.thread ?? []) {
    await createDraft({ body: words, threadRootId: draft.id });
  }

  return publishPost(draft.id);
}
