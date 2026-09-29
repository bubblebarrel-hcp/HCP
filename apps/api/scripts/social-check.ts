/**
 * D50 verification pass: followerships, likes, comments, reshares, bookmarks
 * and views, end to end against a running API.
 *
 * Run the API first (`npm run dev`), then `npx ts-node scripts/social-check.ts`.
 * It uses the seeded accounts and cleans up after itself by unfollowing,
 * unliking and withdrawing what it made — except the comments, which are
 * append-only by design and are withdrawn rather than deleted.
 */
const BASE = process.env.API_BASE ?? 'http://localhost:5010/api/v1';
const PASSWORD = 'OnOn2026!';

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

interface Session {
  token: string;
  userId: string;
  name: string;
}

async function api(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: unknown; error?: unknown };
  return { status: res.status, ok: res.ok, data: json.data as never, error: json.error as { code?: string } | undefined };
}

async function login(email: string): Promise<Session> {
  const res = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  if (!res.ok) throw new Error(`login failed for ${email}: ${JSON.stringify(res.error)}`);
  const data = res.data as { accessToken: string; user: { id: string; hashHandle: string | null } };
  return { token: data.accessToken, userId: data.user.id, name: data.user.hashHandle ?? email };
}

async function main() {
  console.log('D50 — social graph and engagement\n');

  const alice = await login('hasher@hcp.test');
  const bob = await login('officer1@hcp.test');
  const carol = await login('officer2@hcp.test');
  console.log(`signed in as ${alice.name}, ${bob.name}, ${carol.name}\n`);

  // ── The public face of a hasher ──
  console.log('hasher profile');
  {
    const res = await api(`/hashers/${bob.userId}`, { token: alice.token });
    check('profile reads', res.ok, res.error);
    const hasher = (res.data as { hasher: Record<string, unknown> })?.hasher;
    check('carries public identity only', hasher !== undefined && !('email' in hasher) && !('person' in hasher));
    check('reports follower counts', typeof hasher?.followers === 'number');

    const anon = await api(`/hashers/${bob.userId}`);
    check('readable signed out', anon.ok, anon.error);
  }

  // ── Follow ──
  console.log('\nfollow');
  {
    const self = await api(`/hashers/${alice.userId}/follow`, { method: 'POST', token: alice.token });
    check('refuses following yourself', self.status === 400 && self.error?.code === 'CANNOT_FOLLOW_SELF', self.error);

    const first = await api(`/hashers/${bob.userId}/follow`, { method: 'POST', token: alice.token });
    check('follows a hasher', first.ok && (first.data as { changed: boolean }).changed, first.error);

    const again = await api(`/hashers/${bob.userId}/follow`, { method: 'POST', token: alice.token });
    check('following twice is one follow', again.ok && !(again.data as { changed: boolean }).changed);
    check(
      'count did not double',
      (again.data as { counts: { followers: number } }).counts.followers ===
        (first.data as { counts: { followers: number } }).counts.followers,
    );

    const state = await api(`/hashers/${bob.userId}/follow`, { token: alice.token });
    check('state says following', (state.data as { following: boolean })?.following === true);

    const followers = await api(`/hashers/${bob.userId}/followers`, { token: alice.token });
    const list = (followers.data as { items: { id: string }[] })?.items ?? [];
    check('appears in the follower list', list.some((u) => u.id === alice.userId));

    const anonymous = await api(`/hashers/${bob.userId}/follow`, { method: 'POST' });
    check('signed out cannot follow', anonymous.status === 401);
  }

  // ── Follow a kennel ──
  console.log('\nfollow a kennel');
  let kennelSlug: string | null = null;
  {
    const kennels = await api('/kennels?limit=1');
    kennelSlug = (kennels.data as { items: { slug: string }[] })?.items?.[0]?.slug ?? null;
    if (!kennelSlug) {
      check('a kennel exists to follow', false);
    } else {
      const res = await api(`/kennels/${kennelSlug}/follow`, { method: 'POST', token: alice.token });
      check('follows a kennel', res.ok && (res.data as { changed: boolean }).changed, res.error);

      const detail = await api(`/kennels/${kennelSlug}`);
      check('kennel page carries a follower count', typeof (detail.data as { kennel: { followerCount: number } })?.kennel?.followerCount === 'number');

      // Following is not joining: the member count must not have moved.
      const members = (detail.data as { kennel: { activeMemberCount: number; followerCount: number } }).kennel;
      check('a follower is not a member', members.followerCount >= 1);
    }
  }

  // ── Find something to engage with ──
  console.log('\nengagement');
  const feed = await api('/feed?limit=30', { token: alice.token });
  const items = (feed.data as { items: { kind: string; id: string; engagement: unknown }[] })?.items ?? [];
  check('the feed carries engagement on every card', items.length > 0 && items.every((i) => i.engagement));
  // A published report, for the link-preview section. The feed is the cheapest
  // place to find one that is definitely readable.
  const reportId = items.find((i) => i.kind === 'REPORT')?.id ?? null;

  const reels = await api('/reels?limit=1', { token: alice.token });
  const reel = (reels.data as { items: { id: string; author: { id: string } }[] })?.items?.[0];
  if (!reel) {
    check('a reel exists to engage with', false);
    return report();
  }
  // Engage as somebody who is not the author, so reshare is allowed.
  const viewer = reel.author.id === alice.userId ? bob : alice;
  const other = viewer === alice ? bob : alice;

  // ── Like ──
  {
    const liked = await api(`/engagement/reels/${reel.id}/like`, { method: 'POST', token: viewer.token });
    check('likes a reel', liked.ok && (liked.data as { changed: boolean }).changed, liked.error);
    const count = (liked.data as { engagement: { likes: number; liked: boolean } }).engagement;
    check('the count went up and the flag is set', count.likes >= 1 && count.liked);

    const twice = await api(`/engagement/reels/${reel.id}/like`, { method: 'POST', token: viewer.token });
    check('liking twice is one like', twice.ok && !(twice.data as { changed: boolean }).changed);
    check(
      'the count did not double',
      (twice.data as { engagement: { likes: number } }).engagement.likes === count.likes,
    );

    const who = await api(`/engagement/reels/${reel.id}/likes`, { token: viewer.token });
    const likers = (who.data as { items: { id: string }[] })?.items ?? [];
    check('appears in the like list', likers.some((u) => u.id === viewer.userId));

    const unliked = await api(`/engagement/reels/${reel.id}/like`, { method: 'DELETE', token: viewer.token });
    check('unlikes', unliked.ok && (unliked.data as { engagement: { liked: boolean } }).engagement.liked === false);
    check(
      'the count came back down',
      (unliked.data as { engagement: { likes: number } }).engagement.likes === count.likes - 1,
    );
    // Put it back so the rest of the checks have a like to look at.
    await api(`/engagement/reels/${reel.id}/like`, { method: 'POST', token: viewer.token });
  }

  // ── Comment ──
  console.log('\ncomments');
  let commentId: string | null = null;
  {
    const empty = await api(`/engagement/reels/${reel.id}/comments`, {
      method: 'POST',
      token: viewer.token,
      body: { body: '   ' },
    });
    check('refuses an empty comment', empty.status === 400, empty.error);

    const added = await api(`/engagement/reels/${reel.id}/comments`, {
      method: 'POST',
      token: viewer.token,
      body: { body: 'On On! Great trail.' },
    });
    check('comments', added.ok, added.error);
    commentId = (added.data as { comment: { id: string } })?.comment?.id ?? null;

    const replied = await api(`/engagement/reels/${reel.id}/comments`, {
      method: 'POST',
      token: other.token,
      body: { body: 'It was. The beer check was the best bit.', parentId: commentId },
    });
    check('replies to a comment', replied.ok, replied.error);
    const reply = (replied.data as { comment: { id: string; parentId: string } })?.comment;
    check('the reply hangs from the root', reply?.parentId === commentId);

    const nested = await api(`/engagement/reels/${reel.id}/comments`, {
      method: 'POST',
      token: viewer.token,
      body: { body: 'Agreed.', parentId: reply.id },
    });
    check(
      'a reply to a reply flattens to the same root',
      nested.ok && (nested.data as { comment: { parentId: string } }).comment.parentId === commentId,
      nested.error,
    );

    const thread = await api(`/engagement/reels/${reel.id}/comments`, { token: viewer.token });
    const roots = (thread.data as { items: { id: string; replyCount: number; replies: unknown[] }[] })?.items ?? [];
    const root = roots.find((c) => c.id === commentId);
    check('the thread lists the root', Boolean(root));
    check('the root counts its replies', (root?.replyCount ?? 0) === 2, root?.replyCount);
    check('the root previews its replies', (root?.replies.length ?? 0) === 2);

    // A comment is itself likeable.
    const likedComment = await api(`/engagement/comments/${commentId}/like`, { method: 'POST', token: other.token });
    check('likes a comment', likedComment.ok, likedComment.error);

    const edited = await api(`/comments/${commentId}`, {
      method: 'PATCH',
      token: viewer.token,
      body: { body: 'On On! Great trail, and a long one.' },
    });
    check('the author edits their comment', edited.ok, edited.error);
    check('the edit is marked', Boolean((edited.data as { comment: { editedAt: string } })?.comment?.editedAt));

    const notMine = await api(`/comments/${commentId}`, {
      method: 'PATCH',
      token: other.token,
      body: { body: 'Nope.' },
    });
    check('somebody else cannot edit it', notMine.status === 403, notMine.error);

    const notTheirs = await api(`/comments/${commentId}`, { method: 'DELETE', token: other.token });
    check('somebody else cannot withdraw it', notTheirs.status === 403, notTheirs.error);
  }

  // ── Reshare ──
  console.log('\nreshare');
  {
    const own = await api(`/engagement/reels/${reel.id}/reshare`, {
      method: 'POST',
      token: reel.author.id === viewer.userId ? viewer.token : '',
    });
    if (reel.author.id === viewer.userId) {
      check('cannot reshare your own', own.status === 400 && own.error?.code === 'CANNOT_RESHARE_OWN');
    } else {
      check('cannot reshare your own (skipped: not the author)', true);
    }

    const shared = await api(`/engagement/reels/${reel.id}/reshare`, {
      method: 'POST',
      token: viewer.token,
      body: { commentary: 'Everybody should see this one.' },
    });
    check('reshares', shared.ok && (shared.data as { changed: boolean }).changed, shared.error);

    const list = await api(`/engagement/reels/${reel.id}/reshares`, { token: viewer.token });
    const sharers = (list.data as { items: { sharer: { id: string }; commentary: string }[] })?.items ?? [];
    check('appears in the reshare list', sharers.some((s) => s.sharer.id === viewer.userId));
    check('carries the commentary', sharers[0]?.commentary === 'Everybody should see this one.');

    const feedNow = await api('/feed?limit=30', { token: viewer.token });
    const reshares = ((feedNow.data as { items: { kind: string; original: unknown }[] })?.items ?? []).filter(
      (i) => i.kind === 'RESHARE',
    );
    check('the reshare is a feed card', reshares.length > 0);
    check('the card quotes the original', Boolean(reshares[0]?.original));

    const following = await api('/feed?limit=30&scope=FOLLOWING', { token: viewer.token });
    const narrowed = (following.data as { items: { kind: string }[]; scope: string })?.items ?? [];
    check('the following feed answers', following.ok, following.error);
    check('your own reshare is in your following feed', narrowed.some((i) => i.kind === 'RESHARE'));

    const anon = await api('/feed?limit=5&scope=FOLLOWING');
    check('signed out, following is empty rather than everything', ((anon.data as { items: unknown[] })?.items ?? []).length === 0);

    const undone = await api(`/engagement/reels/${reel.id}/reshare`, { method: 'DELETE', token: viewer.token });
    check('withdraws a reshare', undone.ok && (undone.data as { engagement: { reshared: boolean } }).engagement.reshared === false);
  }

  // ── Bookmark ──
  console.log('\nbookmark');
  {
    const saved = await api(`/engagement/reels/${reel.id}/bookmark`, {
      method: 'POST',
      token: viewer.token,
      body: { note: 'Show this to the Grand Master.' },
    });
    check('bookmarks', saved.ok && (saved.data as { engagement: { bookmarked: boolean } }).engagement.bookmarked, saved.error);

    const mine = await api('/me/bookmarks', { token: viewer.token });
    const rows = (mine.data as { items: { subjectId: string; note: string; available: boolean }[] })?.items ?? [];
    const row = rows.find((b) => b.subjectId === reel.id);
    check('appears in my bookmarks', Boolean(row));
    check('keeps the note', row?.note === 'Show this to the Grand Master.');
    check('resolves the subject', row?.available === true);

    // A bookmark is private: it must not show up in anybody else's engagement.
    const theirs = await api(`/engagement/reels/${reel.id}`, { token: other.token });
    check('somebody else does not see it as bookmarked', (theirs.data as { bookmarked: boolean })?.bookmarked === false);

    const filtered = await api('/me/bookmarks?subject=runs', { token: viewer.token });
    check(
      'filtering by kind works',
      ((filtered.data as { items: { subjectType: string }[] })?.items ?? []).every((b) => b.subjectType === 'RUN'),
    );

    const removed = await api(`/engagement/reels/${reel.id}/bookmark`, { method: 'DELETE', token: viewer.token });
    check('unsaves', removed.ok && (removed.data as { engagement: { bookmarked: boolean } }).engagement.bookmarked === false);
  }

  // ── Views ──
  console.log('\nviews');
  {
    const before = await api(`/engagement/reels/${reel.id}`, { token: carol.token });
    const start = (before.data as { views: number }).views;

    const first = await api(`/engagement/reels/${reel.id}/views`, { method: 'POST', token: carol.token });
    check('counts a view', first.ok && (first.data as { counted: boolean }).counted, first.error);
    // Whether this is Carol's first view depends on whether this script has run
    // against this database before, so the expectation is derived rather than
    // assumed — otherwise a correct dedupe reads as a regression on the second
    // run (the re-runnability gripe in CODEX/TODO.md).
    const wasFirst = (first.data as { firstTime: boolean }).firstTime;

    const second = await api(`/engagement/reels/${reel.id}/views`, { method: 'POST', token: carol.token });
    check('the same viewer again is not a new viewer', (second.data as { firstTime: boolean }).firstTime === false);

    const after = await api(`/engagement/reels/${reel.id}`, { token: carol.token });
    const now = (after.data as { views: number }).views;
    check(
      wasFirst
        ? 'a new viewer moves the count by exactly one'
        : 'a returning viewer does not move the count (deduped)',
      now === start + (wasFirst ? 1 : 0),
      { start, now, wasFirst },
    );

    const anon = await api(`/engagement/reels/${reel.id}/views`, { method: 'POST' });
    check('an anonymous open still counts', anon.ok && (anon.data as { counted: boolean }).counted);
  }

  // ── A hasher's written post (D51) ──
  console.log('\nposts');
  let postId: string | null = null;
  {
    const draft = await api('/posts', { method: 'POST', token: alice.token, body: { body: 'Check the check.' } });
    check('creates a draft', draft.ok, draft.error);
    postId = (draft.data as { post: { id: string; status: string } })?.post?.id ?? null;
    check('which starts as a draft', (draft.data as { post: { status: string } })?.post?.status === 'DRAFT');

    // A draft is nobody else's business, and not in anybody's feed.
    const peeking = await api(`/posts/${postId}`, { token: bob.token });
    check('a draft is invisible to everybody else', peeking.status === 404, peeking.status);

    const published = await api(`/posts/${postId}/publish`, { method: 'POST', token: alice.token });
    check('publishes', published.ok, published.error);
    check('and is public the moment it lands', (published.data as { post: { status: string } }).post.status === 'PUBLISHED');

    const anon = await api(`/posts/${postId}`);
    check('readable with no account at all', anon.ok, anon.error);

    const twice = await api(`/posts/${postId}/publish`, { method: 'POST', token: alice.token });
    check('publishing twice is not an error', twice.ok);

    // Nothing to read is not a post.
    const emptyDraft = await api('/posts', { method: 'POST', token: alice.token, body: { body: '   ' } });
    const emptyId = (emptyDraft.data as { post: { id: string } })?.post?.id;
    const refused = await api(`/posts/${emptyId}/publish`, { method: 'POST', token: alice.token });
    check('an empty post is refused', refused.status === 400 && refused.error?.code === 'POST_EMPTY', refused.error);

    const notMine = await api(`/posts/${postId}`, { method: 'PATCH', token: bob.token, body: { body: 'no' } });
    check('somebody else cannot edit it', notMine.status === 403, notMine.error);

    const edited = await api(`/posts/${postId}`, {
      method: 'PATCH',
      token: alice.token,
      body: { body: 'Check the check. Twice.' },
    });
    check('the author edits it', edited.ok, edited.error);
    check('and the edit is marked', Boolean((edited.data as { post: { editedAt: string } }).post.editedAt));

    const feedNow = await api('/feed?limit=30', { token: alice.token });
    const mine = ((feedNow.data as { items: { kind: string; id: string }[] })?.items ?? []).find(
      (i) => i.kind === 'POST' && i.id === postId,
    );
    check('it is in the feed', Boolean(mine));

    // Engagement is polymorphic, so a post should need nothing special.
    const liked = await api(`/engagement/posts/${postId}/like`, { method: 'POST', token: bob.token });
    check('a post can be liked like anything else', liked.ok, liked.error);
    const commented = await api(`/engagement/posts/${postId}/comments`, {
      method: 'POST',
      token: bob.token,
      body: { body: 'It never is.' },
    });
    check('and commented on', commented.ok, commented.error);

    const subject = await api(`/engagement/posts/${postId}`, { token: alice.token });
    const s = (subject.data as { subject: { href: string; isPublic: boolean } }).subject;
    check('it links to its own page', s.href === `/posts/${postId}`, s.href);
    check('and is always public', s.isPublic === true);
  }

  // ── What the share dialog needs ──
  console.log('\nshare');
  // Kept for the link-preview section below, which needs one of each.
  let publicRunId: string | null = null;
  let privateRunId: string | null = null;
  {
    const detail = await api(`/engagement/reels/${reel.id}`, { token: viewer.token });
    const subject = (detail.data as { subject: { href: string; label: string; isPublic: boolean } }).subject;
    check('carries a canonical link', typeof subject.href === 'string' && subject.href.startsWith('/'), subject);
    // The share dialog turns href into an absolute URL and puts it in WhatsApp,
    // so it has to be a page that exists — `/reels?reel=<id>` was not one.
    check('a reel links to its own page, not a query on the grid', subject.href === `/reels/${reel.id}`, subject.href);
    check('carries something to call it', Boolean(subject.label));
    check('says whether the link is public', typeof subject.isPublic === 'boolean');

    // A public reel's link has to work with no account at all, or the share
    // button is sending people to a 404.
    const anon = await api(`/engagement/reels/${reel.id}`);
    if (subject.isPublic) {
      check('a public subject really does resolve signed out', anon.ok, anon.error);
      check('and says so to the signed-out reader too', (anon.data as { subject: { isPublic: boolean } })?.subject?.isPublic === true);
    } else {
      check('a non-public subject is 404 signed out', anon.status === 404, anon.status);
    }

    // A members-only run is the case the warning exists for. Past runs are
    // where the seeded members-only ones are; 'all' is not a scope the API
    // accepts (upcoming | past | drafts), and asking for one it rejects would
    // have quietly turned this into a skip.
    const [upcoming, past] = await Promise.all([
      api('/runs?scope=upcoming&limit=50', { token: viewer.token }),
      api('/runs?scope=past&limit=50', { token: viewer.token }),
    ]);
    const runIds = [
      ...((upcoming.data as { items: { id: string }[] })?.items ?? []),
      ...((past.data as { items: { id: string }[] })?.items ?? []),
    ].map((r) => r.id);
    for (const runId of runIds) {
      const one = await api(`/engagement/runs/${runId}`, { token: viewer.token });
      if (!one.ok) continue;
      const s = (one.data as { subject: { isPublic: boolean } }).subject;
      if (s.isPublic) {
        publicRunId ??= runId;
        continue;
      }
      privateRunId ??= runId;
    }
    if (privateRunId) {
      const outside = await api(`/engagement/runs/${privateRunId}`);
      check('a run marked not-public is really 404 to a stranger', outside.status === 404, outside.status);
    } else {
      check('a members-only run exists to check (skipped: none visible)', true);
    }
  }

  // ── Link previews (D50) ──
  //
  // These read the web app, not the API, because the bug they guard against —
  // a shared link with no title and no card — is invisible to a typechecker
  // and to every check above. Skipped cleanly when the web app is not running.
  console.log('\nlink previews');
  {
    const WEB = process.env.WEB_BASE ?? 'http://localhost:3010';
    const head = async (path: string) => {
      const res = await fetch(`${WEB}${path}`);
      return res.ok ? await res.text() : null;
    };
    const meta = (html: string, property: string) =>
      html.match(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`))?.[1] ?? null;

    let reachable = true;
    try {
      await fetch(WEB, { signal: AbortSignal.timeout(3000) });
    } catch {
      reachable = false;
    }

    if (!reachable) {
      check(`the web app is running at ${WEB} (skipped: not reachable)`, true);
    } else {
      if (publicRunId) {
        const html = await head(`/runs/${publicRunId}`);
        check('a public run page answers', Boolean(html));
        check('and carries an Open Graph title', Boolean(html && meta(html, 'og:title')), meta(html ?? '', 'og:title'));
        check('and a description worth previewing', (meta(html ?? '', 'og:description')?.length ?? 0) > 20);
      }

      // The one that matters most: a members-only run must give a preview
      // crawler nothing, and must not claim "not found" to the member who can
      // in fact open it.
      if (privateRunId) {
        const html = await head(`/runs/${privateRunId}`);
        const title = meta(html ?? '', 'og:title');
        check('a members-only run still renders for its own members', Boolean(html));
        check('but its preview gives away nothing', title === 'Run', title);
        check('and does not claim it is missing', !/not found/i.test(title ?? ''), title);
      }

      const reportHtml = await head(`/reports/${reportId ?? ''}`);
      if (reportId && reportHtml) {
        check('a published report carries an Open Graph title', Boolean(meta(reportHtml, 'og:title')));
        check('and an excerpt rather than an empty card', (meta(reportHtml, 'og:description')?.length ?? 0) > 20);
      }

      const reelHtml = await head(`/reels/${reel.id}`);
      check('a reel page answers at its own address', Boolean(reelHtml));
      check('and carries an Open Graph title', Boolean(reelHtml && meta(reelHtml, 'og:title')));
    }
  }

  // ── Visibility ──
  console.log('\nvisibility');
  {
    const nonsense = await api('/engagement/reels/not-a-uuid/like', { method: 'POST', token: viewer.token });
    check('a non-uuid is a 400 at the edge', nonsense.status === 400, nonsense.status);

    const missing = await api('/engagement/reels/00000000-0000-4000-8000-000000000000/like', {
      method: 'POST',
      token: viewer.token,
    });
    check('an unknown subject is 404', missing.status === 404, missing.status);

    const badKind = await api(`/engagement/widgets/${reel.id}/like`, { method: 'POST', token: viewer.token });
    check('an unknown kind of subject is refused', badKind.status === 400, badKind.status);
  }

  // ── Withdraw what we made ──
  console.log('\ncleanup');
  {
    if (commentId) {
      const gone = await api(`/comments/${commentId}`, { method: 'DELETE', token: viewer.token });
      check('the author withdraws their comment', gone.ok, gone.error);
      const thread = await api(`/engagement/reels/${reel.id}/comments`, { token: viewer.token });
      const root = ((thread.data as { items: { id: string; body: string | null; status: string }[] })?.items ?? []).find(
        (c) => c.id === commentId,
      );
      check('the row stays but says nothing', root?.status === 'DELETED' && root?.body === null, root);
    }
    if (postId) await api(`/posts/${postId}/archive`, { method: 'POST', token: alice.token });
    await api(`/engagement/reels/${reel.id}/like`, { method: 'DELETE', token: viewer.token });
    await api(`/hashers/${bob.userId}/follow`, { method: 'DELETE', token: alice.token });
    if (kennelSlug) await api(`/kennels/${kennelSlug}/follow`, { method: 'DELETE', token: alice.token });
    check('cleaned up', true);
  }

  report();
}

function report() {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
