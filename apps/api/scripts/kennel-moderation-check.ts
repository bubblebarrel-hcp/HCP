/* A kennel's moderators (D61): they see reports about content made in their kennel,
   never about a person or about themselves, never who reported, and may dismiss,
   remove or hand up, but not suspend or reset an identity.
   Needs the heavy seed (Lagos H3 and its members).
   Run: npx ts-node --transpile-only scripts/kennel-moderation-check.ts */
import prisma from '../src/config/prisma';

const B = process.env.API ?? 'http://localhost:5010/api/v1';
const SLUG = 'lagos-h3-lagos';
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
async function login(email: string) {
  const r = await call('POST', '/auth/login', undefined, { email, password: 'OnOn2026!' });
  return { token: r.data?.accessToken as string, id: r.data?.user?.id as string };
}

async function main() {
  const kennel = await prisma.kennel.findUniqueOrThrow({ where: { slug: SLUG }, select: { id: true } });
  const mod = await login('officer6@hcp.test');
  const author = await login('member08@hcp.test');
  const r1 = await login('member13@hcp.test');
  const r2 = await login('member48@hcp.test');
  const admin = await login('admin@hcp.test');
  const made: string[] = [];

  try {
    const post = async (who: typeof author, body: string) => {
      const d = await call('POST', '/posts', who.token, { body, kennelId: kennel.id });
      await call('POST', `/posts/${d.data.post.id}/publish`, who.token);
      made.push(d.data.post.id);
      return d.data.post.id as string;
    };

    const p1 = await post(author, 'kennel spam one ' + Date.now());
    const p2 = await post(author, 'kennel spam two ' + Date.now());
    const own = await post(mod, 'the moderator\'s own post ' + Date.now());
    const f1 = await call('POST', '/reports', r1.token, { targetType: 'POST', targetId: p1, reason: 'SPAM' });
    const f2 = await call('POST', '/reports', r2.token, { targetType: 'POST', targetId: p2, reason: 'SPAM' });
    const f3 = await call('POST', '/reports', r1.token, { targetType: 'POST', targetId: own, reason: 'HARASSMENT', details: 'x' });
    const fu = await call('POST', '/reports', r1.token, { targetType: 'USER', targetId: author.id, reason: 'IMPERSONATION', impersonating: 'ME' });
    check('reports filed', [f1, f2, f3, fu].every((f) => f.status === 201), [f1, f2, f3, fu]);

    const q = await call('GET', `/kennels/${SLUG}/reports?filter=open`, mod.token);
    const ids = q.data.items.map((i: any) => i.id);
    check('the kennel queue has content made in the kennel', ids.includes(f1.data.id) && ids.includes(f2.data.id), ids);
    check('never a report about a person', !ids.includes(fu.data.id), ids);
    check('never a report about the moderator themself', !ids.includes(f3.data.id), ids);

    const d = await call('GET', `/kennels/${SLUG}/reports/${f1.data.id}`, mod.token);
    check('the moderator does not learn who reported', d.data.report.reporter === null, d.data.report.reporter);
    check('and may only do what a kennel may', !d.data.report.may.includes('SUSPEND_USER') && d.data.report.may.includes('REMOVE_CONTENT'), d.data.report.may);

    const person = await call('GET', `/kennels/${SLUG}/reports/${fu.data.id}`, mod.token);
    check('a report about a person is not the kennel\'s to open', person.status === 404, person);
    const self = await call('GET', `/kennels/${SLUG}/reports/${f3.data.id}`, mod.token);
    check('nor one about themself', self.status === 404, self);
    const suspend = await call('POST', `/kennels/${SLUG}/reports/${f1.data.id}/actions`, mod.token, { kind: 'SUSPEND_USER', note: 'no way' });
    check('a kennel cannot suspend anybody', suspend.code === 'PLATFORM_ONLY', suspend);

    const removed = await call('POST', `/kennels/${SLUG}/reports/${f1.data.id}/actions`, mod.token, { kind: 'REMOVE_CONTENT', note: 'Spam in our kennel.' });
    check('a kennel moderator removes its own content', removed.data?.report.status === 'ACTIONED', removed);
    const gone = await call('GET', `/posts/${p1}`, r1.token);
    check('and it is gone', gone.status === 404, gone);

    const esc = await call('POST', `/kennels/${SLUG}/reports/${f2.data.id}/actions`, mod.token, { kind: 'ESCALATE', note: 'Not sure.' });
    check('a kennel hands one up and it stays open', esc.data?.report.status === 'IN_REVIEW' && esc.data.report.escalated, esc);
    const afterQ = await call('GET', `/kennels/${SLUG}/reports?filter=open`, mod.token);
    check('it leaves the kennel queue', !afterQ.data.items.some((i: any) => i.id === f2.data.id), afterQ.data.items.length);
    const locked = await call('POST', `/kennels/${SLUG}/reports/${f2.data.id}/actions`, mod.token, { kind: 'DISMISS' });
    check('and the kennel can no longer decide it', locked.code === 'ESCALATED' || locked.status === 404, locked);
    const platform = await call('POST', `/admin/reports/${f2.data.id}/actions`, admin.token, { kind: 'DISMISS' });
    check('platform staff close it', platform.data?.report.status === 'DISMISSED', platform);
  } finally {
    await prisma.contentReport.deleteMany({ where: { OR: [{ targetId: { in: made } }, { reporterId: { in: [r1.id, r2.id] }, targetId: author.id }] } });
    await prisma.post.deleteMany({ where: { id: { in: made } } });
  }
  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
}
main();
