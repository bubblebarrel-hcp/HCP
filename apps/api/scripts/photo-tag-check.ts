/* Photo-tag consent flow against a running API. Needs at least one public run
   photo (the heavy seed has plenty). Run: npx ts-node --transpile-only scripts/photo-tag-check.ts */
import prisma from '../src/config/prisma';

const B = process.env.API ?? 'http://localhost:5010/api/v1';
let failures = 0;
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
  return { token: r.data.accessToken as string, id: r.data.user.id as string };
}
function check(name: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(extra)}`}`);
  if (!ok) failures += 1;
}

async function main() {
  const a = await login('hasher@hcp.test');
  const b = await login('officer1@hcp.test');

  // A photo on a public run that both can open.
  const candidates = await prisma.mediaAsset.findMany({
    where: { kind: 'PHOTO', uploadState: 'AVAILABLE', moderationState: 'APPROVED', links: { some: { targetType: 'RUN' } } },
    take: 40,
    select: { id: true },
  });
  let photoId: string | null = null;
  for (const c of candidates) {
    const x = await call('GET', `/photos/${c.id}/tags`, a.token);
    const y = await call('GET', `/photos/${c.id}/tags`, b.token);
    if (x.status === 200 && y.status === 200) {
      photoId = c.id;
      break;
    }
  }
  if (!photoId) {
    console.log('SKIP  no photo both hashers can open');
    process.exit(0);
  }
  await prisma.photoTag.deleteMany({ where: { mediaId: photoId } });

  const t = await call('POST', `/photos/${photoId}/tags`, a.token, { userId: b.id });
  check('tag requested', t.status === 201 && t.data.tags.some((x: any) => x.user.id === b.id && x.status === 'PENDING'), t);
  const anon = await call('GET', `/photos/${photoId}/tags`);
  check('pending tag is hidden from everybody else', anon.data.items.length === 0, anon.data);
  const pending = await call('GET', '/me/photo-tags/pending', b.token);
  check('tagged hasher sees the request', pending.data.items.some((i: any) => i.photo.id === photoId), pending.data);
  const tagId = t.data.id as string;

  const notAllowed = await call('POST', `/photo-tags/${tagId}/approve`, a.token);
  check('only the tagged hasher can approve', notAllowed.status === 404, notAllowed);
  const yes = await call('POST', `/photo-tags/${tagId}/approve`, b.token);
  check('approved', yes.data.status === 'APPROVED', yes);
  const shown = await call('GET', `/photos/${photoId}/tags`);
  check('approved tag is public', shown.data.items.length === 1, shown.data);
  const profile = await call('GET', `/hashers/${b.id}/tagged-photos`, a.token);
  check('shows on the tagged hasher profile', profile.data.items.some((p: any) => p.id === photoId), profile.data);

  const off = await call('POST', `/photo-tags/${tagId}/remove`, b.token);
  check('tagged hasher can take it off', off.data.status === 'REMOVED', off);
  const retry = await call('POST', `/photos/${photoId}/tags`, a.token, { userId: b.id });
  check('cannot tag again after removal', retry.status === 409, retry);

  await prisma.photoTag.deleteMany({ where: { mediaId: photoId } });
  const t2 = await call('POST', `/photos/${photoId}/tags`, a.token, { userId: b.id });
  const no = await call('POST', `/photo-tags/${t2.data.id}/decline`, b.token);
  check('declined', no.data.status === 'DECLINED', no);
  const retry2 = await call('POST', `/photos/${photoId}/tags`, a.token, { userId: b.id });
  check('a no is final', retry2.status === 409, retry2);
  await prisma.photoTag.deleteMany({ where: { mediaId: photoId } });

  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
}
main();
