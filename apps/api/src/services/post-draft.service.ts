import prisma from '../config/prisma';

// D70. The post a hasher is writing, kept so it follows them from device to
// device. One per hasher, replaced as they type. It is a scratchpad and not a Post:
// nothing in a feed, nothing to moderate, no event, because nothing has happened
// yet. Publishing goes through the ordinary create / upload / publish steps.

export interface PostDraftPayload {
  body: string;
  thread: string[];
  audience: 'PUBLIC' | 'FOLLOWERS' | 'ONLY_ME';
  pollOn: boolean;
  pollOptions: string[];
  pollHours: number;
  runId: string | null;
}

export async function getDraft(userId: string) {
  const row = await prisma.postDraft.findUnique({ where: { userId } });
  if (!row) return { draft: null };
  return { draft: { ...(row.payload as unknown as PostDraftPayload), savedAt: row.updatedAt.toISOString() } };
}

export async function saveDraft(userId: string, payload: PostDraftPayload) {
  // Nothing worth keeping is the same as no draft.
  const worth =
    payload.body.trim() !== '' ||
    payload.thread.some((part) => part.trim() !== '') ||
    (payload.pollOn && payload.pollOptions.some((option) => option.trim() !== ''));
  if (!worth) {
    await prisma.postDraft.deleteMany({ where: { userId } });
    return { draft: null };
  }
  const row = await prisma.postDraft.upsert({
    where: { userId },
    create: { userId, payload: payload as never },
    update: { payload: payload as never },
  });
  return { draft: { ...payload, savedAt: row.updatedAt.toISOString() } };
}

export async function discardDraft(userId: string) {
  await prisma.postDraft.deleteMany({ where: { userId } });
  return { discarded: true };
}
