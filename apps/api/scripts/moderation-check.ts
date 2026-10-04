/* Reports and moderation (D61) against a running API. Uses a throwaway impostor
   account it creates and removes, so no seeded hasher is touched.
   Run: npx ts-node --transpile-only scripts/moderation-check.ts */
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma';

const B = process.env.API ?? 'http://localhost:5010/api/v1';
let failures = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(extra)}`}`);
  if (!ok) failures += 1;
}
async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${B}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { data?: any; error?: { code?: string } };
  return { status: res.status, data: json.data, code: json.error?.code };
}
async function login(email: string, password = 'OnOn2026!') {
  const r = await call('POST', '/auth/login', undefined, { email, password });
  return { token: r.data?.accessToken as string, id: r.data?.user?.id as string, status: r.status };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const a = await login('hasher@hcp.test'); // reporter, and the "real" hasher
  const c = await login('officer2@hcp.test'); // second reporter
  const admin = await login('admin@hcp.test');
  const e = await login('officer3@hcp.test'); // a third reporter
  const real = await prisma.user.findUniqueOrThrow({ where: { id: a.id }, select: { hashHandle: true, username: true } });

  // A throwaway impostor with the real hasher's handle.
  await prisma.user.deleteMany({ where: { email: 'impostor@hcp.test' } });
  const impostor = await prisma.user.create({
    data: {
      email: 'impostor@hcp.test',
      passwordHash: await bcrypt.hash('OnOn2026!', 4),
      hashHandle: 'Fake Chidi',
      username: 'fake_chidi_x',
      bio: 'DM me for free runs',
      avatarUrl: 'https://example.com/a.png',
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
    },
  });
  const imp = await login('impostor@hcp.test');

  try {
    // ── Filing ──
    const bad1 = await call('POST', '/reports', a.token, { targetType: 'POST', targetId: impostor.id, reason: 'IMPERSONATION' });
    check('impersonation is only against a hasher', bad1.status === 400 || bad1.status === 404, bad1);
    const bad2 = await call('POST', '/reports', a.token, { targetType: 'USER', targetId: impostor.id, reason: 'IMPERSONATION' });
    check('impersonation says who is being copied', bad2.status === 400 && bad2.code === 'IMPERSONATING_REQUIRED', bad2);
    const bad3 = await call('POST', '/reports', a.token, {
      targetType: 'USER', targetId: impostor.id, reason: 'IMPERSONATION', impersonating: 'OTHER',
    });
    check('impersonating somebody else needs them named', bad3.code === 'IMPERSONATED_REQUIRED', bad3);
    const self = await call('POST', '/reports', a.token, { targetType: 'USER', targetId: a.id, reason: 'SPAM' });
    check('you cannot report yourself', self.status === 400, self);
    const other = await call('POST', '/reports', a.token, { targetType: 'USER', targetId: impostor.id, reason: 'OTHER' });
    check('"something else" needs words', other.code === 'DETAILS_REQUIRED', other);

    const filed = await call('POST', '/reports', a.token, {
      targetType: 'USER', targetId: impostor.id, reason: 'IMPERSONATION', impersonating: 'ME', details: 'Using my name and picture.',
    });
    check('impersonation filed', filed.status === 201, filed);
    const again = await call('POST', '/reports', a.token, { targetType: 'USER', targetId: impostor.id, reason: 'SPAM' });
    check('the same thing cannot be reported twice in a week', again.status === 409, again);
    const second = await call('POST', '/reports', c.token, {
      targetType: 'USER', targetId: impostor.id, reason: 'IMPERSONATION', impersonating: 'OTHER', impersonatedUserId: a.id,
    });
    check('a second hasher reports the same impostor', second.status === 201, second);
    const reportId = filed.data.id as string;
    const secondId = second.data.id as string;

    const mine = await call('GET', '/me/reports', a.token);
    check('reporter sees their own, with no moderator detail', mine.data.items.some((r: any) => r.id === reportId && r.status === 'OPEN' && !('details' in r)), mine.data);

    // ── Who may see the queue ──
    const asHasher = await call('GET', '/admin/reports', a.token);
    check('a hasher cannot open the platform queue', asHasher.status === 403, asHasher);
    const queue = await call('GET', '/admin/reports?filter=open', admin.token);
    const row = queue.data.items.find((i: any) => i.id === reportId);
    check('platform queue lists it, high priority, with both reports counted', Boolean(row) && row.priority === 1 && row.openReportsOnTarget === 2, row);

    const detail = await call('GET', `/admin/reports/${reportId}`, admin.token);
    const d = detail.data.report;
    check('detail shows the impostor and the real hasher side by side', d.target?.hashHandle === 'Fake Chidi' && d.impersonated?.id === a.id, d);
    check('platform staff see who reported', d.reporter?.id === a.id, d.reporter);
    check('the other report is listed', d.siblings.some((s: any) => s.id === secondId), d.siblings);

    // ── Acting ──
    const noReason = await call('POST', `/admin/reports/${reportId}/actions`, admin.token, { kind: 'RESET_IDENTITY' });
    check('an action that tells somebody needs words', noReason.code === 'REASON_REQUIRED', noReason);
    const wrongKind = await call('POST', `/admin/reports/${reportId}/actions`, admin.token, { kind: 'REMOVE_CONTENT', note: 'x y z' });
    check('a hasher is not content', wrongKind.code === 'NOT_CONTENT', wrongKind);

    const reset = await call('POST', `/admin/reports/${reportId}/actions`, admin.token, {
      kind: 'RESET_IDENTITY', note: 'You may not use another hasher\'s name or picture.',
    });
    check('identity reset closes the report', reset.data?.report.status === 'ACTIONED', reset);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: impostor.id } });
    check('handle, picture and bio are cleared', after.hashHandle === null && after.avatarUrl === null && after.bio === null, after);
    check('a neutral username replaces theirs', after.username !== 'fake_chidi_x' && Boolean(after.username), after.username);
    const real2 = await prisma.user.findUniqueOrThrow({ where: { id: a.id }, select: { hashHandle: true, username: true } });
    check('the real hasher is untouched', real2.hashHandle === real.hashHandle && real2.username === real.username, real2);
    const sib = await call('GET', `/admin/reports/${secondId}`, admin.token);
    check('the pile-on closes with it', sib.data.report.status === 'ACTIONED', sib.data.report);
    const closed = await call('POST', `/admin/reports/${reportId}/actions`, admin.token, { kind: 'DISMISS' });
    check('a closed report stays closed', closed.code === 'REPORT_CLOSED', closed);

    await wait(3500);
    const notes = await call('GET', '/me/notifications?limit=10', a.token);
    check('reporter is told the outcome', notes.data.items.some((n: any) => /action on your report/i.test(n.title)), notes.data.items.map((n: any) => n.title));
    const impNotes = await call('GET', '/me/notifications?limit=10', imp.token);
    check('the impostor is told why, in the moderator\'s words', impNotes.data?.items.some((n: any) => /neither|reset/i.test(n.title) || /another hasher/i.test(n.body)), impNotes.data?.items);
    check('and is never told who reported', !JSON.stringify(impNotes.data?.items ?? []).includes(a.id));

    // ── Content: remove and suspend ──
    const draft = await call('POST', '/posts', imp.token, { body: 'buy followers at example.com ' + Date.now() });
    await call('POST', `/posts/${draft.data.post.id}/publish`, imp.token);
    const postId = draft.data.post.id as string;
    const r1 = await call('POST', '/reports', a.token, { targetType: 'POST', targetId: postId, reason: 'SPAM' });
    const r2 = await call('POST', '/reports', c.token, { targetType: 'POST', targetId: postId, reason: 'SCAM', details: 'link' });
    check('a post is reported', r1.status === 201 && r2.status === 201, [r1, r2]);
    const pDetail = await call('GET', `/admin/reports/${r1.data.id}`, admin.token);
    check('the post is kept as it was reported', /buy followers/.test(pDetail.data.report.snapshot.body), pDetail.data.report.snapshot);
    const rm = await call('POST', `/admin/reports/${r1.data.id}/actions`, admin.token, { kind: 'REMOVE_CONTENT', note: 'Spam.' });
    check('removing content closes the report', rm.data?.report.status === 'ACTIONED', rm);
    const post = await call('GET', `/posts/${postId}`, a.token);
    check('the post is gone for everybody', post.status === 404, post);
    const edited = await prisma.post.findUniqueOrThrow({ where: { id: postId }, select: { status: true, body: true } });
    check('and the row stays', edited.status === 'REMOVED' && edited.body.length > 0, edited);
    const r2now = await call('GET', `/admin/reports/${r2.data.id}`, admin.token);
    check('the second report on it closed too', r2now.data.report.status === 'ACTIONED', r2now.data.report.status);
    check('history shows what moderation did before', r2now.data.report.priorActions.length >= 1, r2now.data.report);

    const dismissTarget = await call('POST', '/reports', a.token, { targetType: 'USER', targetId: c.id, reason: 'HARASSMENT', details: 'x' });
    const dis = await call('POST', `/admin/reports/${dismissTarget.data.id}/actions`, admin.token, { kind: 'DISMISS' });
    check('a report can be dismissed', dis.data?.report.status === 'DISMISSED', dis);
    await prisma.contentReport.deleteMany({ where: { id: dismissTarget.data.id } });

    const sus = await call('POST', '/reports', e.token, { targetType: 'USER', targetId: impostor.id, reason: 'HARASSMENT', details: 'again' });
    const suspended = await call('POST', `/admin/reports/${sus.data.id}/actions`, admin.token, { kind: 'SUSPEND_USER', note: 'Repeat offender.' });
    check('suspension closes the report', suspended.data?.report.status === 'ACTIONED', suspended);
    const relog = await login('impostor@hcp.test');
    check('a suspended hasher cannot log in', relog.status === 403, relog);
    const adminTarget = await call('POST', '/reports', e.token, { targetType: 'USER', targetId: admin.id, reason: 'SPAM' });
    if (adminTarget.status === 201) {
      const refuse = await call('POST', `/admin/reports/${adminTarget.data.id}/actions`, admin.token, { kind: 'SUSPEND_USER', note: 'no' + ' no' });
      check('platform staff are not suspended from a report', refuse.code === 'PLATFORM_ADMIN' || refuse.status === 400, refuse);
    }

    // ── Kennel moderators ──
    const kennel = await prisma.kennel.findFirstOrThrow({ select: { slug: true } });
    const kq = await call('GET', `/kennels/${kennel.slug}/reports`, a.token);
    check('an ordinary hasher cannot open a kennel queue', kq.status === 403, kq);
  } finally {
    const ids = (await prisma.contentReport.findMany({ where: { OR: [{ targetId: impostor.id }, { reporterId: impostor.id }, { targetUserId: impostor.id }] }, select: { id: true } })).map((r) => r.id);
    await prisma.contentReport.deleteMany({ where: { id: { in: ids } } });
    await prisma.contentReport.deleteMany({ where: { reporterId: { in: [a.id, c.id, e.id] }, targetType: 'USER', targetId: admin.id } });
    await prisma.notification.deleteMany({ where: { recipientUserId: impostor.id } });
    await prisma.post.deleteMany({ where: { authorId: impostor.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: impostor.id } });
    await prisma.user.deleteMany({ where: { id: impostor.id } });
  }
  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
}
main();
