import { api } from '@/lib/api';
import type {
  Audience,
  CommentThreadItem,
  ContentComment,
  Engagement,
  EngagementDetail,
  FollowerPage,
  FollowingPage,
  FollowRelation,
  FollowRequest,
  FollowState,
  HasherPhotoPage,
  HasherProfile,
  Page,
  ReactionKind,
  SubjectSegment,
} from '@/lib/types';

// Follows, likes, comments, reshares, bookmarks and views (D50). Mirrors
// apps/web/lib/social.ts's calls, one to one, against the same API.

const subjectPath = (segment: SubjectSegment, id: string) => `/engagement/${segment}/${id}`;

export async function getEngagement(segment: SubjectSegment, id: string) {
  return api<EngagementDetail>(subjectPath(segment, id));
}

export async function setLiked(segment: SubjectSegment, id: string, liked: boolean, reaction?: ReactionKind) {
  const data = await api<{ engagement: Engagement }>(`${subjectPath(segment, id)}/like`, {
    method: liked ? 'POST' : 'DELETE',
    body: liked && reaction ? { reaction } : undefined,
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

// Following a hasher is not always immediate: a locked profile turns it into a
// request (D57). The answer says which, so the button shows the truth.
export async function followHasher(id: string, follow: boolean) {
  return api<{ relation: FollowRelation; counts: { followers: number; following: number } }>(
    `/hashers/${id}/follow`,
    { method: follow ? 'POST' : 'DELETE' },
  );
}

// The photo grid on a hasher's page, gated by their profile (D57).
export async function hasherPhotos(id: string, page = 1, limit = 24) {
  return api<HasherPhotoPage>(`/hashers/${id}/photos?page=${page}&limit=${limit}`);
}

// Who sees what I make, stepping away, and leaving (D57).
export async function getPrivacy() {
  return api<{ profileVisibility: Audience; pendingRequests: number; shareMilestones: boolean }>('/me/privacy');
}

// Whether a milestone may appear in the feed as a card (D60).
export async function setMilestoneSharing(shareMilestones: boolean) {
  return api<{ shareMilestones: boolean }>('/me/privacy', { method: 'PATCH', body: { shareMilestones } });
}

export async function setPrivacy(profileVisibility: Audience) {
  return api<{ profileVisibility: Audience; pendingRequests: number }>('/me/privacy', {
    method: 'PATCH',
    body: { profileVisibility },
  });
}

export async function deactivateAccount(password: string) {
  return api('/me/deactivate', { method: 'POST', body: { password } });
}

export async function deleteAccount(password: string) {
  return api('/me/delete', { method: 'POST', body: { password, confirm: 'DELETE' } });
}

// Who follows a hasher and who they follow (D50). A locked profile's lists are for
// its approved followers; anyone else gets an empty page that says so (D57).
export async function listHasherFollowers(id: string, page = 1) {
  return api<FollowerPage>(`/hashers/${id}/followers?page=${page}&limit=30`);
}

export async function listHasherFollowing(id: string, page = 1) {
  return api<FollowingPage>(`/hashers/${id}/following?page=${page}&limit=30`);
}

// Take somebody off your followers. They are not told, and can ask again (D57).
export async function removeFollower(followerId: string) {
  return api(`/me/followers/${followerId}`, { method: 'DELETE' });
}

export async function listFollowRequests(page = 1) {
  return api<Page<FollowRequest>>(`/me/follow-requests?page=${page}&limit=30`);
}

export async function approveFollowRequest(followerId: string) {
  return api(`/me/follow-requests/${followerId}/approve`, { method: 'POST' });
}

export async function declineFollowRequest(followerId: string) {
  return api(`/me/follow-requests/${followerId}/decline`, { method: 'POST' });
}

export async function followKennel(slug: string, follow: boolean) {
  const data = await api<{ counts: { followers: number } }>(`/kennels/${slug}/follow`, { method: follow ? 'POST' : 'DELETE' });
  return data.counts.followers;
}

export async function hasherProfile(id: string) {
  return api<{ hasher: HasherProfile }>(`/hashers/${id}`);
}

export async function editComment(commentId: string, body: string) {
  const data = await api<{ comment: ContentComment }>(`/comments/${commentId}`, { method: 'PATCH', body: { body } });
  return data.comment;
}

export async function removeComment(commentId: string, reason: string) {
  return api(`/comments/${commentId}/remove`, { method: 'POST', body: { reason } });
}
