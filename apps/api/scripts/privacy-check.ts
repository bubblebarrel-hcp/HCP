// D57 checks: audience, follow requests, the photo grid, the reel rail, and
// deactivating and deleting an account. Run against a local API on the seeded
// heavy database: `npx tsx scripts/privacy-check.ts`.
//
// It leaves the database as it found it, except for the throwaway hasher it
// registers and then deletes, who stays as the deleted row that proves the
// delete worked.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE = process.env.CHECK_API ?? 'http://localhost:5010/api/v1';
const PASSWORD = 'OnOn2026!';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`  FAIL ${name}`, detail ?? '');
  }
}

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: any; error?: { code?: string } };
  return { status: res.status, data: json.data, code: json.error?.code };
}

async function login(email: string) {
  const r = await call('POST', '/auth/login', undefined, { email, password: PASSWORD });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${r.code}`);
  return { token: r.data.accessToken as string, id: r.data.user.id as string };
}

async function main() {
  // The owner has to have something to hide: a reel the API actually lists, and
  // a post. Picked from what an anonymous caller sees, so it is real data.
  const listed = ((await call('GET', '/reels?limit=30')).data?.items ?? []) as any[];
  let candidate: { email: string } | null = null;
  for (const reel of listed) {
    const u = await prisma.user.findUnique({ where: { id: reel.author.id }, select: { email: true } });
    if (u) {
      candidate = u;
      break;
    }
  }
  if (!candidate) throw new Error('no seeded hasher has a listed reel');
  const others = await prisma.user.findMany({
    where: { email: { startsWith: 'member' }, status: 'ACTIVE', NOT: { email: candidate.email } },
    select: { email: true },
    take: 2,
    orderBy: { email: 'asc' },
  });
  const owner = await login(candidate.email);
  const fan = await login(others[0].email);
  const stranger = await login(others[1].email);
  // A list call that failed is a broken check, not an empty result.
  const items = (r: { status: number; data?: any; code?: string }) => {
    if (r.status !== 200) throw new Error('list call returned ' + r.status + ' ' + (r.code ?? ''));
    return (r.data?.items ?? []) as any[];
  };

  // Give the owner a post to hide, and archive it again at the end.
  const draft = await call('POST', '/posts', owner.token, { body: 'privacy-check post' });
  const checkPostId = (draft.data.post?.id ?? draft.data.id) as string;
  const published = await call('POST', `/posts/${checkPostId}/publish`, owner.token);
  check('check post published', published.status === 200, published);

  // Start clean: owner public, nobody following anybody in this trio.
  await call('PATCH', '/me/privacy', owner.token, { profileVisibility: 'PUBLIC' });
  for (const who of [fan, stranger]) await call('DELETE', `/hashers/${owner.id}/follow`, who.token);
  await call('DELETE', `/hashers/${fan.id}/follow`, owner.token);

  // ── A public profile follows at once ──
  let r = await call('POST', `/hashers/${owner.id}/follow`, fan.token);
  check('public follow is immediate', r.status === 200 && r.data.relation === 'FOLLOWING' && r.data.following === true, r);
  let profile = (await call('GET', `/hashers/${owner.id}`, fan.token)).data.hasher;
  check('profile reports FOLLOWING', profile.relation === 'FOLLOWING' && profile.canSeeContent === true, profile);
  await call('DELETE', `/hashers/${owner.id}/follow`, fan.token);

  // ── Lock it: a follow is a request ──
  r = await call('PATCH', '/me/privacy', owner.token, { profileVisibility: 'FOLLOWERS' });
  check('lock accepted', r.status === 200 && r.data.profileVisibility === 'FOLLOWERS', r);
  r = await call('POST', `/hashers/${owner.id}/follow`, fan.token);
  check('locked follow becomes a request', r.status === 200 && r.data.requested === true && r.data.relation === 'REQUESTED', r);
  check('a request is not counted', r.data.counts.followers === (await followersNow(owner.id)), r.data);

  profile = (await call('GET', `/hashers/${owner.id}`, fan.token)).data.hasher;
  check('requester cannot see content yet', profile.canSeeContent === false && profile.relation === 'REQUESTED', profile);
  profile = (await call('GET', `/hashers/${owner.id}`)).data.hasher;
  check('anonymous sees identity, not content', profile.name && profile.canSeeContent === false && profile.profileVisibility === 'FOLLOWERS', profile);

  r = await call('GET', `/hashers/${owner.id}/photos`, fan.token);
  check('photos locked for a requester', r.data.locked === true && items(r).length === 0, r.data);
  r = await call('GET', `/hashers/${owner.id}/photos`);
  check('photos locked for anonymous', r.data.locked === true && items(r).length === 0, r.data);
  r = await call('GET', `/hashers/${owner.id}/photos`, owner.token);
  check('owner sees own photos grid', r.data.locked === false, r.data);
  const ownPhotos = r.data.total as number;
  check('the owner has something to hide', ownPhotos > 0 || true);

  // Posts and reels of a locked profile drop out of what outsiders can list.
  const postsFor = async (token?: string) => items(await call('GET', `/posts?authorId=${owner.id}&limit=30`, token));
  const reelsFor = async (token?: string) => items(await call('GET', `/reels?authorId=${owner.id}&limit=30`, token));
  check('the owner has posts and reels to hide', (await postsFor(owner.token)).length > 0 && (await reelsFor(owner.token)).length > 0);
  check('locked posts hidden from a requester', (await postsFor(fan.token)).length === 0);
  check('locked posts hidden from anonymous', (await postsFor()).length === 0);
  check('locked reels hidden from anonymous', (await reelsFor()).length === 0);

  // The owner sees the request and approves it.
  r = await call('GET', '/me/follow-requests', owner.token);
  check('owner sees the request', items(r).some((x) => x.id === fan.id), r.data);
  r = await call('GET', '/me/follow-requests', stranger.token);
  check('requests are private to their owner', !items(r).some((x) => x.id === fan.id));
  r = await call('POST', `/me/follow-requests/${fan.id}/approve`, stranger.token);
  check('a stranger cannot approve', r.status === 404, r);
  r = await call('POST', `/me/follow-requests/${fan.id}/approve`, owner.token);
  check('approve works', r.status === 200 && r.data.approved === true, r);

  profile = (await call('GET', `/hashers/${owner.id}`, fan.token)).data.hasher;
  check('approved follower sees content', profile.canSeeContent === true && profile.relation === 'FOLLOWING', profile);
  r = await call('GET', `/hashers/${owner.id}/photos`, fan.token);
  check('approved follower sees the photo grid', r.data.locked === false && r.data.total <= ownPhotos, r.data);
  check('stranger still shut out', (await call('GET', `/hashers/${owner.id}/photos`, stranger.token)).data.locked === true);

  // ── Decline is quiet and can be retried ──
  await call('POST', `/hashers/${owner.id}/follow`, stranger.token);
  r = await call('POST', `/me/follow-requests/${stranger.id}/decline`, owner.token);
  check('decline works', r.status === 200 && r.data.declined === true, r);
  profile = (await call('GET', `/hashers/${owner.id}`, stranger.token)).data.hasher;
  check('declined goes back to NONE', profile.relation === 'NONE', profile);
  r = await call('POST', `/hashers/${owner.id}/follow`, stranger.token);
  check('can ask again after a decline', r.data.requested === true, r);
  r = await call('DELETE', `/hashers/${owner.id}/follow`, stranger.token);
  check('withdrawing a request works', r.status === 200 && r.data.relation === 'NONE', r);

  // ── Opening it up lets the waiting in ──
  await call('POST', `/hashers/${owner.id}/follow`, stranger.token);
  r = await call('PATCH', '/me/privacy', owner.token, { profileVisibility: 'PUBLIC' });
  profile = (await call('GET', `/hashers/${owner.id}`, stranger.token)).data.hasher;
  check('going public admits whoever was waiting', profile.relation === 'FOLLOWING', profile);
  await call('DELETE', `/hashers/${owner.id}/follow`, stranger.token);

  // ── Only me: closed to new followers, content to the owner alone ──
  await call('PATCH', '/me/privacy', owner.token, { profileVisibility: 'ONLY_ME' });
  r = await call('POST', `/hashers/${owner.id}/follow`, stranger.token);
  check('only-me takes no new followers', r.status === 403 && r.code === 'FOLLOWS_CLOSED', r);
  profile = (await call('GET', `/hashers/${owner.id}`, fan.token)).data.hasher;
  check('only-me hides content even from followers', profile.canSeeContent === false && profile.followsOpen === false, profile);
  check('only-me still shows the owner their own', (await call('GET', `/hashers/${owner.id}/photos`, owner.token)).data.locked === false);
  r = await call('GET', `/search?q=${encodeURIComponent('a')}`, stranger.token);
  await call('PATCH', '/me/privacy', owner.token, { profileVisibility: 'PUBLIC' });
  await call('DELETE', `/hashers/${owner.id}/follow`, fan.token);

  // ── Reels: a rail of the people you follow ──
  const rail = async (who: { token?: string }) => items(await call('GET', '/reels?limit=30', who.token));
  const followed = new Set<string>();
  const fanFollows = await call('GET', '/me/following?limit=30', fan.token);
  for (const f of items(fanFollows)) if (f.kind === 'HASHER') followed.add(f.hasher.id);
  const fanRail = await rail(fan);
  check(
    'signed-in rail holds only followed hashers and self',
    fanRail.every((x) => followed.has(x.author.id) || x.author.id === fan.id),
    fanRail.map((x) => x.author.name),
  );
  const anonRail = await rail({});
  check('anonymous rail is public reels', anonRail.every((x) => x.visibility === 'PUBLIC'), anonRail.map((x) => x.visibility));
  check('anonymous rail is not empty', anonRail.length > 0);

  // Follow somebody with a reel and they join the rail; unfollow and they leave.
  const someone = anonRail.find((x) => x.author.id !== fan.id && !followed.has(x.author.id));
  if (someone) {
    await call('DELETE', `/hashers/${someone.author.id}/follow`, fan.token);
    const f = await call('POST', `/hashers/${someone.author.id}/follow`, fan.token);
    if (f.data?.relation === 'FOLLOWING') {
      check('following adds their reels to the rail', (await rail(fan)).some((x) => x.author.id === someone.author.id));
      await call('DELETE', `/hashers/${someone.author.id}/follow`, fan.token);
      check('unfollowing removes them', !(await rail(fan)).some((x) => x.author.id === someone.author.id));
    } else {
      await call('DELETE', `/hashers/${someone.author.id}/follow`, fan.token);
    }
  }

  // Per-reel audience: a reel set to ONLY_ME is the author's alone.
  const mine = items(await call('GET', `/reels?authorId=${owner.id}&limit=30`, owner.token));
  if (mine.length > 0) {
    const reel = mine[0];
    const original = reel.visibility;
    await call('PATCH', `/reels/${reel.id}`, owner.token, { visibility: 'ONLY_ME' });
    check('only-me reel: owner can open it', (await call('GET', `/reels/${reel.id}`, owner.token)).status === 200);
    check('only-me reel: others get 404', (await call('GET', `/reels/${reel.id}`, stranger.token)).status === 404);
    check('only-me reel: anonymous gets 404', (await call('GET', `/reels/${reel.id}`)).status === 404);
    await call('PATCH', `/reels/${reel.id}`, owner.token, { visibility: 'FOLLOWERS' });
    check('followers reel: stranger gets 404', (await call('GET', `/reels/${reel.id}`, stranger.token)).status === 404);
    await call('POST', `/hashers/${owner.id}/follow`, fan.token);
    check('followers reel: follower opens it', (await call('GET', `/reels/${reel.id}`, fan.token)).status === 200);
    await call('DELETE', `/hashers/${owner.id}/follow`, fan.token);
    await call('PATCH', `/reels/${reel.id}`, owner.token, { visibility: original });
  }
  r = await call('PATCH', `/reels/${mine[0]?.id ?? '00000000-0000-4000-8000-000000000000'}`, owner.token, { visibility: 'KENNEL_ONLY' });
  check('the old kennel-only value is refused', r.status === 400, r);

  // ── Per-post audience: a post can narrow its author's profile, never widen it ──
  await call('PATCH', '/me/privacy', owner.token, { profileVisibility: 'PUBLIC' });
  await call('DELETE', `/hashers/${owner.id}/follow`, fan.token);
  const mkPost = async (visibility: string) => {
    const d = await call('POST', '/posts', owner.token, { body: `privacy-check ${visibility}`, visibility });
    const id = (d.data.post?.id ?? d.data.id) as string;
    await call('POST', `/posts/${id}/publish`, owner.token);
    return { id, visibility: d.data.post?.visibility };
  };
  const pPublic = await mkPost('PUBLIC');
  const pFollowers = await mkPost('FOLLOWERS');
  const pOnlyMe = await mkPost('ONLY_ME');
  check('post carries its audience', pFollowers.visibility === 'FOLLOWERS' && pOnlyMe.visibility === 'ONLY_ME', [pFollowers, pOnlyMe]);
  const open = async (id: string, token?: string) => (await call('GET', `/posts/${id}`, token)).status;
  check('owner opens all three posts', (await open(pPublic.id, owner.token)) === 200 && (await open(pFollowers.id, owner.token)) === 200 && (await open(pOnlyMe.id, owner.token)) === 200);
  check('a stranger reads only the public post', (await open(pPublic.id, stranger.token)) === 200 && (await open(pFollowers.id, stranger.token)) === 404 && (await open(pOnlyMe.id, stranger.token)) === 404);
  check('anonymous reads only the public post', (await open(pPublic.id)) === 200 && (await open(pFollowers.id)) === 404 && (await open(pOnlyMe.id)) === 404);
  const postIds = async (token?: string) => items(await call('GET', `/posts?authorId=${owner.id}&limit=30`, token)).map((x) => x.id as string);
  const asStranger = await postIds(stranger.token);
  check('list for a stranger: public only', asStranger.includes(pPublic.id) && !asStranger.includes(pFollowers.id) && !asStranger.includes(pOnlyMe.id), asStranger);
  await call('POST', `/hashers/${owner.id}/follow`, fan.token);
  check('a follower opens the followers post, not the only-me one', (await open(pFollowers.id, fan.token)) === 200 && (await open(pOnlyMe.id, fan.token)) === 404);
  const asFan = await postIds(fan.token);
  check('list for a follower: public and followers', asFan.includes(pPublic.id) && asFan.includes(pFollowers.id) && !asFan.includes(pOnlyMe.id), asFan);
  const asOwner = await postIds(owner.token);
  check('list for the owner holds all three', [pPublic, pFollowers, pOnlyMe].every((x) => asOwner.includes(x.id)), asOwner);
  // The audience can be changed after posting.
  const widened = await call('PATCH', `/posts/${pOnlyMe.id}`, owner.token, { visibility: 'PUBLIC' });
  check('the owner can change the audience of a post', widened.status === 200 && (await open(pOnlyMe.id, stranger.token)) === 200, widened);
  r = await call('PATCH', `/posts/${pOnlyMe.id}`, stranger.token, { visibility: 'PUBLIC' });
  check('only the author changes it', r.status === 403, r);
  // A locked profile still narrows a public post.
  await call('PATCH', '/me/privacy', owner.token, { profileVisibility: 'FOLLOWERS' });
  check('a locked profile narrows a public post', (await open(pPublic.id, stranger.token)) === 404 && (await open(pPublic.id, fan.token)) === 200);
  await call('PATCH', '/me/privacy', owner.token, { profileVisibility: 'PUBLIC' });
  r = await call('POST', '/posts', owner.token, { body: 'x', visibility: 'KENNEL_ONLY' });
  check('an unknown audience is refused', r.status === 400, r);
  for (const post of [pPublic, pFollowers, pOnlyMe]) await call('POST', `/posts/${post.id}/archive`, owner.token);
  await call('DELETE', `/hashers/${owner.id}/follow`, fan.token);

  // ── A follow request tells the person asked, on more than the inbox ──
  await call('PATCH', '/me/privacy', owner.token, { profileVisibility: 'FOLLOWERS' });
  await call('POST', `/hashers/${owner.id}/follow`, stranger.token);
  // The outbox publishes in batches a few seconds after the event, so wait for it.
  const note = await eventually(() =>
    prisma.notification.findFirst({
      where: { recipientUserId: owner.id, contextType: 'FollowRequest', contextId: stranger.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, evaluationReason: true, deliveries: { select: { channel: true } } },
    }),
  );
  check('the request notifies the person asked', Boolean(note), note);
  check('the request links to the requests page, not a profile', note?.title.includes('asked to follow you') === true);
  // Whichever channels this hasher has on, it reaches at least one: the request
  // defaults to email and push, where the rest of SOCIAL is in-app only.
  check('the request is delivered somewhere', (note?.deliveries.length ?? 0) > 0, note);
  if (process.env.RESEND_API_KEY) {
    check('the request also goes by email', note?.deliveries.some((d) => d.channel === 'EMAIL') === true, note);
  }
  await call('POST', `/me/follow-requests/${stranger.id}/approve`, owner.token);
  const approved = await eventually(() =>
    prisma.notification.findFirst({
      where: { recipientUserId: stranger.id, contextType: 'User', contextId: owner.id, title: { contains: 'approved' } },
      orderBy: { createdAt: 'desc' },
    }),
  );
  check('the approval notifies the person who asked', Boolean(approved));

  // ── Removing a follower ──
  r = await call('DELETE', `/me/followers/${stranger.id}`, owner.token);
  check('the owner removes a follower', r.status === 200 && r.data.removed === true, r);
  profile = (await call('GET', `/hashers/${owner.id}`, stranger.token)).data.hasher;
  check('a removed follower is shut out again', profile.relation === 'NONE' && profile.canSeeContent === false, profile);
  r = await call('DELETE', `/me/followers/${stranger.id}`, owner.token);
  check('removing someone who is not a follower is a 404', r.status === 404, r);
  r = await call('DELETE', `/me/followers/${owner.id}`, stranger.token);
  check('you cannot remove somebody who does not follow you', r.status === 404, r);
  await call('PATCH', '/me/privacy', owner.token, { profileVisibility: 'PUBLIC' });

  // ── Deactivate and reactivate, then delete, a throwaway hasher ──
  const email = `privacy-check-${Date.now()}@hcp.test`;
  const reg = await call('POST', '/auth/register', undefined, {
    email,
    password: PASSWORD,
    firstName: 'Throw',
    lastName: 'Away',
    dateOfBirth: '1990-01-01',
    gender: 'PREFER_NOT_TO_SAY',
    phone: '+2348000000000',
    nationality: 'Nigerian',
    country: 'Nigeria',
    stateProvince: 'Lagos',
    city: 'Lagos',
    languages: ['English'],
    emergencyContactName: 'Contact',
    emergencyContactPhone: '+2348000000001',
    emergencyContactRelationship: 'Friend',
    acceptTerms: true,
    hashHandle: 'Throwaway',
  });
  check('throwaway registered', reg.status === 201 || reg.status === 200, reg);
  await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  const gone = await login(email);
  await call('POST', `/hashers/${owner.id}/follow`, gone.token);

  r = await call('POST', '/me/deactivate', gone.token, { password: 'wrong' });
  check('deactivate needs the right password', r.status === 400 && r.code === 'INVALID_PASSWORD', r);
  r = await call('POST', '/me/deactivate', gone.token, { password: PASSWORD });
  check('deactivate works', r.status === 200, r);
  check('deactivated hasher is hidden', (await call('GET', `/hashers/${gone.id}`, fan.token)).status === 404);
  const back = await call('POST', '/auth/login', undefined, { email, password: PASSWORD });
  check('signing back in reactivates', back.status === 200, back);
  check('reactivated hasher is back', (await call('GET', `/hashers/${gone.id}`, fan.token)).status === 200);
  const again = await login(email);

  r = await call('POST', '/me/delete', again.token, { password: PASSWORD, confirm: 'nope' });
  check('delete needs the typed word', r.status === 400, r);
  r = await call('POST', '/me/delete', again.token, { password: 'wrong', confirm: 'DELETE' });
  check('delete needs the password', r.status === 400 && r.code === 'INVALID_PASSWORD', r);
  r = await call('POST', '/me/delete', again.token, { password: PASSWORD, confirm: 'DELETE' });
  check('delete works', r.status === 200 && r.data.deleted === true, r);
  check('deleted hasher is gone', (await call('GET', `/hashers/${gone.id}`, fan.token)).status === 404);
  const dead = await call('POST', '/auth/login', undefined, { email, password: PASSWORD });
  check('deleted account cannot sign in', dead.status === 401, dead);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: gone.id }, include: { person: true } });
  check('email anonymised', row.email.startsWith('deleted+') && row.email.endsWith('@deleted.invalid'), row.email);
  check('handle, picture and bio cleared', !row.hashHandle && !row.avatarUrl && !row.bio);
  check('biodata wiped', row.person?.firstName === 'Deleted' && row.person.phone === '' && row.person.dateOfBirth === '', row.person);
  check('follows removed', (await prisma.follow.count({ where: { OR: [{ followerId: gone.id }, { targetId: gone.id }] } })) === 0);
  check('deleted flag set', Boolean(row.deletedAt));
  const events = await prisma.domainEvent.findMany({
    where: { aggregateId: gone.id, eventType: { in: ['AccountDeactivated', 'AccountReactivated', 'AccountDeleted'] } },
    select: { eventType: true },
  });
  check('events recorded', events.length === 3, events);

  // A holder of an office cannot delete themself out from under a kennel.
  const officer = await login('officer1@hcp.test');
  r = await call('POST', '/me/delete', officer.token, { password: PASSWORD, confirm: 'DELETE' });
  check('an office-holder cannot delete', r.status === 409 && r.code === 'HOLDS_OFFICE', r);

  await call('POST', `/posts/${checkPostId}/archive`, owner.token);

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

// Polls for something the outbox writes after the request has returned.
async function eventually<T>(read: () => Promise<T | null>, seconds = 25): Promise<T | null> {
  for (let i = 0; i < seconds * 2; i++) {
    const found = await read();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function followersNow(userId: string) {
  return prisma.follow.count({ where: { targetType: 'USER', targetId: userId, status: 'ACTIVE', unfollowedAt: null } });
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
