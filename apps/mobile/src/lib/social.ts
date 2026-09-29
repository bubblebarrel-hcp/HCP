import { api } from '@/lib/api';
import type {
  CommentThreadItem,
  ContentComment,
  Engagement,
  EngagementDetail,
  FollowState,
  HasherProfile,
  Page,
  SubjectSegment,
} from '@/lib/types';

// Follows, likes, comments, reshares, bookmarks and views (D50). Mirrors
// apps/web/lib/social.ts's calls, one to one, against the same API.

const subjectPath = (segment: SubjectSegment, id: string) => `/engagement/${segment}/${id}`;

export async function getEngagement(segment: SubjectSegment, id: string) {
  return api<EngagementDetail>(subjectPath(segment, id));
}

export async function setLiked(segment: SubjectSegment, id: string, liked: boolean) {
  const data = await api<{ engagement: Engagement }>(`${subjectPath(segment, id)}/like`, {
    method: liked ? 'POST' : 'DELETE',
  });
  return data.engagement;
}

export async function setBookmarked(segment: SubjectSegment, id: string, saved: boolean, note?: string) {
  const data = await api<{ engagement: Engagement }>(`${subjectPath(segment, id)}/bookmark`, {
    method: saved ? 'POST' : 'DELETE',
    body: saved ? { note: note ?? null } : undefined,
  });
  return data.engagement;
}

export async function reshare(segment: SubjectSegment, id: string, commentary?: string | null) {
  const data = await api<{ engagement: Engagement }>(`${subjectPath(segment, id)}/reshare`, {
    method: 'POST',
    body: { commentary: commentary ?? null },
  });
  return data.engagement;
}

export async function unreshare(segment: SubjectSegment, id: string) {
  const data = await api<{ engagement: Engagement }>(`${subjectPath(segment, id)}/reshare`, { method: 'DELETE' });
  return data.engagement;
}

export async function listComments(segment: SubjectSegment, id: string, page = 1) {
  return api<Page<CommentThreadItem>>(`${subjectPath(segment, id)}/comments?page=${page}&limit=20`);
}

export async function listReplies(commentId: string, page = 1) {
  return api<Page<ContentComment>>(`/comments/${commentId}/replies?page=${page}&limit=50`);
}

export async function addComment(segment: SubjectSegment, id: string, body: string, parentId?: string | null) {
  const data = await api<{ comment: ContentComment }>(`${subjectPath(segment, id)}/comments`, {
    method: 'POST',
    body: { body, parentId: parentId ?? null },
  });
  return data.comment;
}

export async function deleteComment(commentId: string) {
  return api(`/comments/${commentId}`, { method: 'DELETE' });
}

export async function countView(segment: SubjectSegment, id: string) {
  return api(`${subjectPath(segment, id)}/views`, { method: 'POST' }).catch(() => undefined);
}

export async function followState(kind: 'hashers' | 'kennels', slugOrId: string) {
  return api<FollowState>(`/${kind}/${slugOrId}/follow`);
}

export async function followHasher(id: string, follow: boolean) {
  return api(`/hashers/${id}/follow`, { method: follow ? 'POST' : 'DELETE' });
}

export async function followKennel(slug: string, follow: boolean) {
  return api(`/kennels/${slug}/follow`, { method: follow ? 'POST' : 'DELETE' });
}

export async function hasherProfile(id: string) {
  return api<{ hasher: HasherProfile }>(`/hashers/${id}`);
}
