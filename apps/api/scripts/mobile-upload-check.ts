// What the phone sends when it posts a reel (apps/mobile/src/lib/media.ts and
// reel-composer.tsx), replayed against a local API: a draft, then for each item an
// upload target, a PUT of the bytes to storage, a confirm, and for a video a poster
// grabbed on the phone, then publish. It checks the API accepts exactly that shape,
// that a retry resumes rather than duplicating, and that the 25MB cap says so.
// Run against a local API: `npx tsx scripts/mobile-upload-check.ts`.
//
// It cannot check the phone itself (the picker, the camera, the thumbnail from
// expo-video); that needs a device. It deletes the reel it makes.

import 'dotenv/config';

const BASE = process.env.CHECK_API ?? 'http://localhost:5010/api/v1';
const PASSWORD = 'OnOn2026!';

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
  const json = (await res.json().catch(() => ({}))) as { data?: any; error?: { code?: string; message?: string } };
  return { status: res.status, data: json.data, code: json.error?.code, message: json.error?.message };
}

// The mobile app's own request shape, field for field (lib/media.ts#uploadInternal).
function targetFor(kind: 'PHOTO' | 'VIDEO', mimeType: string, size: number, reelId: string, slot: number) {
  return {
    kind,
    mimeType,
    sizeBytes: size,
    target: { type: 'REEL', id: reelId },
    caption: null,
    clientId: `REEL:${reelId}:${slot}`,
  };
}

async function main() {
  const login = await call('POST', '/auth/login', undefined, { email: 'member02@hcp.test', password: PASSWORD });
  if (login.status !== 200) throw new Error(`login failed: ${login.status}`);
  const token = login.data.accessToken as string;

  // ── The draft, as the composer creates it ──
  const draft = await call('POST', '/reels', token, { caption: 'from the phone', kennelId: null, visibility: 'PUBLIC', pinned: false });
  check('the draft is created', draft.status === 201 || draft.status === 200, draft);
  const reelId = draft.data?.reel?.id as string;
  if (!reelId) throw new Error('no reel');

  try {
    // ── An iPhone's own formats ──
    const photoBytes = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const clip = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypqt  '), Buffer.alloc(2048)]);

    const photo = await call('POST', '/media/uploads', token, targetFor('PHOTO', 'image/heic', photoBytes.length, reelId, 0));
    check('a HEIC photo is accepted for upload', photo.status === 201 || photo.status === 200, photo);
    const video = await call('POST', '/media/uploads', token, targetFor('VIDEO', 'video/quicktime', clip.length, reelId, 1));
    check('a QuickTime clip is accepted for upload', video.status === 201 || video.status === 200, video);
    check('the phone key fits the API cap', `REEL:${reelId}:1`.length <= 120);

    for (const [label, made, bytes] of [['photo', photo, photoBytes], ['video', video, clip]] as const) {
      const up = made.data?.upload;
      check(`${label}: an upload target comes back`, Boolean(up?.url) && up.method === 'PUT', up);
      if (!up) continue;
      const put = await fetch(up.url, { method: up.method, headers: up.headers, body: bytes });
      check(`${label}: the PUT to storage is accepted`, put.ok, put.status);
    }

    // ── Confirm, with what the picker measured ──
    const confirmedPhoto = await call('POST', `/media/${photo.data.media.id}/confirm`, token, { width: 3024, height: 4032, durationSec: null });
    check('the photo confirms with the picker\'s size', confirmedPhoto.status === 200 && confirmedPhoto.data?.media?.width === 3024, confirmedPhoto);
    const confirmedVideo = await call('POST', `/media/${video.data.media.id}/confirm`, token, { width: 1280, height: 720, durationSec: 12.4 });
    check('the clip confirms with its length', confirmedVideo.status === 200 && Math.round(confirmedVideo.data?.media?.durationSec * 10) === 124, confirmedVideo);

    // ── The poster the phone grabbed (a JPEG as a data URL) ──
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4000)]);
    const poster = await call('POST', `/media/${video.data.media.id}/poster`, token, { image: `data:image/jpeg;base64,${jpeg.toString('base64')}` });
    check('the clip\'s poster is accepted', poster.status === 200 || poster.status === 201, poster);
    check('...and becomes its thumbnail', Boolean(poster.data?.media?.thumbnailUrl), poster.data?.media);
    const notImage = await call('POST', `/media/${video.data.media.id}/poster`, token, { image: `data:image/jpeg;base64,${Buffer.from('hello, not an image').toString('base64')}` });
    check('a poster that is not an image is refused', notImage.status === 400, notImage.status);
    const tooBig = await call('POST', `/media/${video.data.media.id}/poster`, token, {
      image: `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(700_000)]).toString('base64')}`,
    });
    check('an over-large poster is refused', tooBig.status === 400 || tooBig.status === 413, tooBig.status);

    // ── A retry of the same item resumes ──
    const again = await call('POST', '/media/uploads', token, targetFor('VIDEO', 'video/quicktime', clip.length, reelId, 1));
    check('retrying the same item reuses it, not a second asset', again.data?.media?.id === video.data.media.id, { first: video.data.media.id, second: again.data?.media?.id });

    // ── The cap ──
    const big = await call('POST', '/media/uploads', token, targetFor('VIDEO', 'video/mp4', 26 * 1024 * 1024, reelId, 2));
    check('a clip over 25MB is refused with a code the phone can show', big.status === 400 && big.code === 'FILE_TOO_LARGE', big);
    check('...and a message that names the limit', /25MB/.test(big.message ?? ''), big.message);

    // ── Publish, and what the rail then shows ──
    const published = await call('POST', `/reels/${reelId}/publish`, token);
    check('the reel publishes', published.status === 200 || published.status === 201, published);
    const shown = await call('GET', `/reels/${reelId}`, token);
    const items = shown.data?.reel?.items ?? [];
    check('both items are on the reel, in the order they were added', items.length === 2 && items[0].kind === 'PHOTO' && items[1].kind === 'VIDEO', items.map((i: any) => i.kind));
    check('the video carries its poster for the grid and the rail', Boolean(items[1]?.posterUrl), items[1]);
  } finally {
    const gone = await call('DELETE', `/reels/${reelId}`, token);
    check('the check cleans up its reel', gone.status === 200 || gone.status === 204, gone.status);
  }

  console.log(`mobile-upload-check: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
