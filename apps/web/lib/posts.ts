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

interface Envelope<T> {
  data: T;
}

const unwrap = <T,>(res: { data: Envelope<T> }): T => res.data.data;

export async function createDraft(input: {
  body: string;
  visibility?: Audience;
  kennelId?: string | null;
  runId?: string | null;
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

export async function listPosts(params: { page?: number; limit?: number; authorId?: string } = {}) {
  return unwrap(await api.get<Envelope<Page<HasherPost>>>('/posts', { params }));
}

// The whole act, so the composer does not have to know the shape of it.
// `onProgress` reports which photo is going up, because a slow upload with no
// sign of life reads as a hang.
export async function post(
  input: { body: string; photos: File[]; visibility?: Audience; kennelId?: string | null },
  onProgress?: (uploaded: number, total: number) => void,
): Promise<HasherPost> {
  const draft = await createDraft({
    body: input.body,
    visibility: input.visibility,
    kennelId: input.kennelId ?? null,
  });

  for (const [index, file] of input.photos.entries()) {
    onProgress?.(index, input.photos.length);
    // Sequential on purpose: a phone on a kennel's wifi uploading four photos
    // at once is four slow uploads, and a failure halfway leaves a draft that
    // was never published rather than a post with holes in it.
    await uploadPhoto(file, { type: 'POST', id: draft.id });
  }
  onProgress?.(input.photos.length, input.photos.length);

  return publishPost(draft.id);
}
