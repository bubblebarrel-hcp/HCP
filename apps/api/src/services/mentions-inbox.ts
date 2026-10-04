import { SubjectType } from '@prisma/client';
import prisma from '../config/prisma';
import { listHiddenIds } from './block.service';
import type { Actor } from './permission.service';
import { publicName, userPublicSelect } from './run.service';
import { resolveVisible, segmentFor } from './subject.service';

// The mentions inbox (D60): everything that has mentioned this hasher, newest
// first, as far as they can still open it. Withdrawn comments, posts that went
// private and anybody they have since blocked or muted are simply not there.
export async function listMentionsOfMe(actor: Actor, opts: { page: number; limit: number }) {
  const where = { mentionedUserId: actor.id };
  const [rows, total] = await prisma.$transaction([
    prisma.contentMention.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: { id: true, subjectType: true, subjectId: true, authorId: true, createdAt: true },
    }),
    prisma.contentMention.count({ where }),
  ]);

  const ofType = (type: SubjectType) => rows.filter((r) => r.subjectType === type).map((r) => r.subjectId);
  const [posts, reels, comments, authors, hidden] = await Promise.all([
    prisma.post.findMany({ where: { id: { in: ofType(SubjectType.POST) } }, select: { id: true, body: true } }),
    prisma.reel.findMany({ where: { id: { in: ofType(SubjectType.REEL) } }, select: { id: true, caption: true } }),
    prisma.contentComment.findMany({
      where: { id: { in: ofType(SubjectType.COMMENT) }, status: 'VISIBLE' },
      select: { id: true, body: true, subjectType: true, subjectId: true },
    }),
    prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.authorId))] } },
      select: { ...userPublicSelect, avatarUrl: true },
    }),
    listHiddenIds(actor.id),
  ]);

  const text = new Map<string, string>();
  for (const p of posts) text.set(`POST:${p.id}`, p.body);
  for (const r of reels) text.set(`REEL:${r.id}`, r.caption ?? '');
  for (const c of comments) text.set(`COMMENT:${c.id}`, c.body);
  const home = new Map(comments.map((c) => [c.id, { type: c.subjectType, id: c.subjectId }]));
  const byAuthor = new Map(authors.map((a) => [a.id, a]));

  // Where each one opens: a comment opens the thing it is on.
  const target = (row: (typeof rows)[number]) =>
    row.subjectType === SubjectType.COMMENT ? home.get(row.subjectId) : { type: row.subjectType, id: row.subjectId };
  const visible = await resolveVisible(
    actor,
    rows.flatMap((r) => {
      const t = target(r);
      return t ? [{ type: t.type, id: t.id }] : [];
    }),
  );

  const items = rows.flatMap((row) => {
    const t = target(row);
    const author = byAuthor.get(row.authorId);
    const body = text.get(`${row.subjectType}:${row.subjectId}`);
    if (!t || !author || body === undefined || hidden.has(row.authorId)) return [];
    if (!visible.has(`${t.type}:${t.id}`)) return [];
    const flat = body.replace(/\s+/g, ' ').trim();
    return [
      {
        id: row.id,
        createdAt: row.createdAt,
        // What it was said in: a post, a reel or a comment.
        in: row.subjectType,
        // What to open.
        segment: segmentFor(t.type),
        targetId: t.id,
        excerpt: flat.length > 160 ? `${flat.slice(0, 159)}…` : flat,
        by: { id: author.id, name: publicName(author), avatarUrl: author.avatarUrl },
      },
    ];
  });
  return { items, total, page: opts.page, limit: opts.limit };
}
