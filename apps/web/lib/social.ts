'use client';
import api from '@/services/api';
import type {
  Bookmark,
  CommentThreadItem,
  ContentComment,
  Engagement,
  EngagementDetail,
  FollowState,
  FollowingEntry,
  FollowerSummary,
  HasherProfile,
  Liker,
  Page,
  SubjectSegment,
} from '@/lib/types';

// Follows, likes, comments, reshares, bookmarks and views from the browser
// (D50). Everything goes through the same-origin proxy, which holds the tokens
// — no client here ever sees one.
//
// The proxy passes the API's envelope through untouched, so every response is
// `{ success, data }` and axios wraps that again in `res.data`. `unwrap` does
// both hops in one place rather than `res.data.data` at thirty call sites.

const subjectPath = (segment: SubjectSegment, id: string) => `/engagement/${segment}/${id}`;

interface Envelope<T> {
  data: T;
}

const unwrap = <T,>(res: { data: Envelope<T> }): T => res.data.data;

export async function getEngagement(segment: SubjectSegment, id: string) {
  return unwrap(await api.get<Envelope<EngagementDetail>>(subjectPath(segment, id)));
}

// Like and unlike return the whole engagement block, so a button can replace
// its numbers with the server's rather than guessing.
export async function setLiked(segment: SubjectSegment, id: string, liked: boolean) {
  const path = `${subjectPath(segment, id)}/like`;
  const res = liked
    ? await api.post<Envelope<{ engagement: Engagement }>>(path)
    : await api.delete<Envelope<{ engagement: Engagement }>>(path);
  return unwrap(res).engagement;
}

export async function setBookmarked(segment: SubjectSegment, id: string, saved: boolean, note?: string) {
  const path = `${subjectPath(segment, id)}/bookmark`;
  const res = saved
    ? await api.post<Envelope<{ engagement: Engagement }>>(path, { note: note ?? null })
    : await api.delete<Envelope<{ engagement: Engagement }>>(path);
  return unwrap(res).engagement;
}

export async function reshare(segment: SubjectSegment, id: string, commentary?: string | null) {
  const res = await api.post<Envelope<{ engagement: Engagement }>>(`${subjectPath(segment, id)}/reshare`, {
    commentary: commentary ?? null,
  });
  return unwrap(res).engagement;
}

export async function unreshare(segment: SubjectSegment, id: string) {
  return unwrap(await api.delete<Envelope<{ engagement: Engagement }>>(`${subjectPath(segment, id)}/reshare`))
    .engagement;
}

export async function listLikes(segment: SubjectSegment, id: string, page = 1) {
  return unwrap(
    await api.get<Envelope<Page<Liker>>>(`${subjectPath(segment, id)}/likes`, { params: { page, limit: 50 } }),
  );
}

export async function listComments(segment: SubjectSegment, id: string, page = 1) {
  return unwrap(
    await api.get<Envelope<Page<CommentThreadItem>>>(`${subjectPath(segment, id)}/comments`, {
      params: { page, limit: 20 },
    }),
  );
}

export async function listReplies(commentId: string, page = 1) {
  return unwrap(
    await api.get<Envelope<Page<ContentComment>>>(`/comments/${commentId}/replies`, { params: { page, limit: 50 } }),
  );
}

export async function addComment(segment: SubjectSegment, id: string, body: string, parentId?: string | null) {
  const res = await api.post<Envelope<{ comment: ContentComment }>>(`${subjectPath(segment, id)}/comments`, {
    body,
    parentId: parentId ?? null,
  });
  return unwrap(res).comment;
}

export async function editComment(commentId: string, body: string) {
  return unwrap(await api.patch<Envelope<{ comment: ContentComment }>>(`/comments/${commentId}`, { body })).comment;
}

export async function deleteComment(commentId: string) {
  await api.delete(`/comments/${commentId}`);
}

export async function removeComment(commentId: string, reason: string) {
  await api.post(`/comments/${commentId}/remove`, { reason });
}

// A view is a tally, so this is fire-and-forget: a failure never interrupts
// what the reader came to do.
export function countView(segment: SubjectSegment, id: string) {
  void api.post(`${subjectPath(segment, id)}/views`).catch(() => undefined);
}

export async function listBookmarks(page = 1, segment?: SubjectSegment) {
  return unwrap(
    await api.get<Envelope<Page<Bookmark>>>('/me/bookmarks', {
      params: { page, limit: 30, ...(segment ? { subject: segment } : {}) },
    }),
  );
}

// ─── Follows ───

export async function hasherFollowState(id: string) {
  return unwrap(await api.get<Envelope<FollowState>>(`/hashers/${id}/follow`));
}

export async function kennelFollowState(slug: string) {
  return unwrap(await api.get<Envelope<FollowState>>(`/kennels/${slug}/follow`));
}

export async function setFollowingHasher(id: string, following: boolean) {
  const path = `/hashers/${id}/follow`;
  const res = following
    ? await api.post<Envelope<{ counts: { followers: number } }>>(path)
    : await api.delete<Envelope<{ counts: { followers: number } }>>(path);
  return unwrap(res).counts.followers;
}

export async function setFollowingKennel(slug: string, following: boolean) {
  const path = `/kennels/${slug}/follow`;
  const res = following
    ? await api.post<Envelope<{ counts: { followers: number } }>>(path)
    : await api.delete<Envelope<{ counts: { followers: number } }>>(path);
  return unwrap(res).counts.followers;
}

export async function listFollowers(hasherId: string, page = 1) {
  return unwrap(
    await api.get<Envelope<Page<FollowerSummary>>>(`/hashers/${hasherId}/followers`, {
      params: { page, limit: 30 },
    }),
  );
}

export async function listFollowing(hasherId: string, page = 1) {
  return unwrap(
    await api.get<Envelope<Page<FollowingEntry>>>(`/hashers/${hasherId}/following`, {
      params: { page, limit: 30 },
    }),
  );
}

// The live counts for a hasher. The profile page is served from the ISR cache
// (D42), so the numbers it prints can be a minute old — and on your own page
// there is no Follow button to correct them, because nobody follows themself.
export async function hasherCounts(id: string) {
  const { hasher } = unwrap(await api.get<Envelope<{ hasher: HasherProfile }>>(`/hashers/${id}`));
  return { followers: hasher.followers, following: hasher.following };
}
