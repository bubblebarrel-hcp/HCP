/* End-to-end check of D60 against a running API (http://localhost:5010):
   blocks and mutes, reactions, polls, link-preview SSRF guard, mentions inbox,
   run-tagged posts. Run: npx ts-node scripts/social-v2-check.ts */
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
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const a = await login('hasher@hcp.test'); // author
  const b = await login('officer1@hcp.test');
  const c = await login('officer2@hcp.test');
  // Clean slate between runs.
  for (const [t, other] of [[a.token, b.id], [a.token, c.id], [b.token, a.id], [c.token, a.id]] as const) {
    await call('DELETE', `/hashers/${other}/block`, t);
    await call('DELETE', `/hashers/${other}/mute`, t);
  }

  // ── Polls ──
  const draft = await call('POST', '/posts', a.token, {
    body: `Where is the on-after? ${Date.now()}`,
    poll: { options: ['Pub', 'Park', 'Home'], hours: 2 },
  });
  const postId = draft.data.post.id;
  check('poll created with the draft', draft.data.post.poll?.options.length === 3, draft.data);
  await call('POST', `/posts/${postId}/publish`, a.token);
  const bad = await call('POST', '/posts', a.token, { body: 'x', poll: { options: ['only one'] } });
  check('a poll needs two answers', bad.status === 400, bad);
  const optionId = draft.data.post.poll.options[0].id;

  let seen = (await call('GET', `/posts/${postId}`, b.token)).data.post.poll;
  check('results hidden before voting', seen.options[0].votes === null && seen.myVote === null, seen);
  const voted = await call('POST', `/posts/${postId}/poll/vote`, b.token, { optionId });
  check('vote counted and results shown', voted.data.poll.options[0].votes === 1 && voted.data.poll.myVote === optionId, voted);
  const again = await call('POST', `/posts/${postId}/poll/vote`, b.token, { optionId: draft.data.post.poll.options[1].id });
  check('vote can be changed', again.data.poll.options[0].votes === 0 && again.data.poll.options[1].votes === 1, again);

  // ── Reactions ──
  const r1 = await call('POST', `/engagement/posts/${postId}/like`, b.token, { reaction: 'BEER' });
  check('beer reaction', r1.data.engagement.myReaction === 'BEER' && r1.data.engagement.reactions.BEER === 1, r1);
  const r2 = await call('POST', `/engagement/posts/${postId}/like`, b.token, { reaction: 'SHIGGY' });
  check('reaction swap keeps the like count', r2.data.engagement.likes === 1 && r2.data.engagement.reactions.SHIGGY === 1 && r2.data.engagement.reactions.BEER === 0, r2);
  const r3 = await call('POST', `/engagement/posts/${postId}/like`, b.token, { reaction: 'NOPE' });
  check('bad reaction refused', r3.status === 400, r3);

  // ── Mentions inbox ──
  const me = await call('GET', '/auth/me', b.token);
  const bUser = me.data.user.username as string;
  const comment = await call('POST', `/engagement/posts/${postId}/comments`, a.token, { body: `hey @${bUser} look` });
  check('comment with mention created', comment.status === 201 || comment.status === 200, comment);
  const inbox = await call('GET', '/me/mentions', b.token);
  check('mention is in the inbox', inbox.data.items.some((i: any) => i.in === 'COMMENT' && i.targetId === postId), inbox.data);

  // ── Link preview SSRF guard ──
  const ssrf = await call('POST', '/posts', a.token, { body: `look http://127.0.0.1:5010/api/v1/health ${Date.now()}` });
  await call('POST', `/posts/${ssrf.data.post.id}/publish`, a.token);
  await wait(2500);
  const ssrfPost = await call('GET', `/posts/${ssrf.data.post.id}`, a.token);
  check('private address is never fetched for a preview', ssrfPost.data.post.linkPreview === null, ssrfPost.data.post.linkPreview);

  // ── Mute: A mutes B ──
  await call('PUT', `/hashers/${b.id}/mute`, a.token);
  const bPost = await call('POST', '/posts', b.token, { body: `from b ${Date.now()}` });
  await call('POST', `/posts/${bPost.data.post.id}/publish`, b.token);
  let list = await call('GET', '/posts?limit=30', a.token);
  check('muted hasher leaves post list', !list.data.items.some((p: any) => p.author.id === b.id), 'still there');
  const direct = await call('GET', `/posts/${bPost.data.post.id}`, a.token);
  check('muted hasher still reachable by link', direct.status === 200, direct);
  list = await call('GET', '/posts?limit=30', b.token);
  check('being muted changes nothing for B', list.data.items.some((p: any) => p.id === bPost.data.post.id), 'gone');
  await call('DELETE', `/hashers/${b.id}/mute`, a.token);

  // ── Block: A blocks B ──
  await call('POST', `/hashers/${a.id}/follow`, b.token);
  const blocked = await call('PUT', `/hashers/${b.id}/block`, a.token);
  check('block recorded', blocked.data?.kind === 'BLOCK', blocked);
  const aPage = await call('GET', `/hashers/${a.id}`, b.token);
  check('blocker profile is 404 to the blocked', aPage.status === 404, aPage);
  const aPost = await call('GET', `/posts/${postId}`, b.token);
  check('blocker post is 404 to the blocked', aPost.status === 404, aPost);
  const refollow = await call('POST', `/hashers/${a.id}/follow`, b.token);
  check('blocked cannot follow', refollow.status === 404, refollow);
  const sugg = await call('GET', `/mentions/suggest?q=${me.data.user.username.slice(0, 4)}`, a.token);
  check('blocked hasher not suggested', !sugg.data.items.some((i: any) => i.id === b.id), sugg.data);
  const bView = await call('GET', `/hashers/${b.id}`, a.token);
  check('blocker can still open the page to unblock', bView.status === 200 && bView.data.hasher.myBlock === 'BLOCK', bView);
  const list2 = await call('GET', '/me/blocks', a.token);
  check('block listed', list2.data.items.some((i: any) => i.id === b.id), list2);
  await call('DELETE', `/hashers/${b.id}/block`, a.token);
  const restored = await call('GET', `/posts/${postId}`, b.token);
  check('unblock restores access', restored.status === 200, restored);

  // ── Run-tagged posts ──
  const runs = await call('GET', '/me/taggable-runs', a.token);
  console.log(`      (${runs.data.items.length} taggable runs for hasher)`);
  if (runs.data.items.length) {
    const runId = runs.data.items[0].id;
    const tagged = await call('POST', '/posts', a.token, { body: `about a run ${Date.now()}`, runId });
    await call('POST', `/posts/${tagged.data.post.id}/publish`, a.token);
    const byRun = await call('GET', `/posts?runId=${runId}`, a.token);
    check('posts by run', byRun.data.items.some((p: any) => p.id === tagged.data.post.id), byRun.data);
  }

  // ── Milestone opt-out ──
  const opt = await call('PATCH', '/me/privacy', a.token, { shareMilestones: false });
  check('milestone opt-out saved', opt.data.shareMilestones === false, opt);
  await call('PATCH', '/me/privacy', a.token, { shareMilestones: true });

  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
}
main();
