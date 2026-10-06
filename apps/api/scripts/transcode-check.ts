// D67 checks: video re-encoding. Real clips (made by ffmpeg) go through the worker
// against local storage and the local database: a 1080p WebM, a portrait QuickTime
// movie, a clip already in the right shape, and a file that is not a video; then
// the queue (one claim at a time, stuck work released, retries and giving up), the
// cleanup of replaced originals, and an upload through the real API that the
// running server's own worker converts.
//
//   npx tsx scripts/transcode-check.ts          the worker, in this process (stop the API first:
//                                               its own worker would take these clips)
//   npx tsx scripts/transcode-check.ts --e2e    one upload through the running API's own worker
//
// Run it on local storage: R2_ACCOUNT_ID= R2_ACCESS_KEY_ID= R2_SECRET_ACCESS_KEY= npx tsx ...
// It refuses to run against R2 (it would write to the real bucket), and removes
// everything it makes.

import 'dotenv/config';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const exec = promisify(execFile);
const BASE = process.env.CHECK_API ?? 'http://localhost:5010/api/v1';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const e2eOnly = process.argv.includes('--e2e');
let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`  FAIL ${name}`, detail ?? '');
  }
}

async function main() {
  const storage = await import('../src/services/storage.service');
  const transcode = await import('../src/services/transcode.service');
  if (!e2eOnly && storage.storageDriver !== 'local') throw new Error('R2 is configured: refusing to write to the real bucket');
  if (!transcode.transcodeAvailable()) throw new Error('no ffmpeg available');
  const ffmpeg = transcode.ffmpegBinary()!;

  const dir = await mkdtemp(path.join(os.tmpdir(), 'transcode-check-'));
  const made: string[] = [];
  const keys: string[] = [];
  const uploader = await prisma.user.findFirst({ where: { email: 'member03@hcp.test' }, select: { id: true } });
  if (!uploader) throw new Error('no member03 in the seed');

  const src = async (name: string, args: string[]) => {
    const out = path.join(dir, name);
    await exec(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args, out]);
    return out;
  };
  const lavfi = (size: string, secs: number, audio: boolean) => [
    '-f', 'lavfi', '-i', `testsrc2=size=${size}:rate=30:duration=${secs}`,
    ...(audio ? ['-f', 'lavfi', '-i', `sine=frequency=440:duration=${secs}`] : []),
  ];

  // An asset row pointing at a file in local storage, the way confirm leaves it.
  const asset = async (file: string, mimeType: string, ext: string, extra: Record<string, unknown> = {}) => {
    const key = `transcode-check/${randomUUID()}${ext}`;
    keys.push(key);
    await storage.uploadFile(key, file, mimeType);
    const { size } = await stat(file);
    const row = await prisma.mediaAsset.create({
      data: {
        uploaderId: uploader.id,
        kind: 'VIDEO',
        storageKey: key,
        url: storage.publicUrlFor(key),
        mimeType,
        sizeBytes: BigInt(size),
        uploadState: 'AVAILABLE',
        moderationState: 'APPROVED',
        // NONE unless a queue test says otherwise, so a server running its own worker
        // against this database cannot take a clip out from under a check.
        transcodeState: 'NONE',
        ...extra,
      },
    });
    made.push(row.id);
    return row;
  };
  const reload = (id: string) => prisma.mediaAsset.findUniqueOrThrow({ where: { id } });
  const onDisk = (key: string) => existsSync(path.join(storage.localRoot, key));
  const bytesOf = async (key: string) => readFile(path.join(storage.localRoot, key));

  if (!e2eOnly) try {
    // ───────────── A 1080p WebM with sound ─────────────
    const webm = await src('big.webm', [...lavfi('1920x1080', 3, true), '-c:v', 'libvpx', '-b:v', '4M', '-c:a', 'libvorbis']);
    const a = await asset(webm, 'video/webm', '.webm');
    await transcode.processAsset(a.id);
    const A = await reload(a.id);
    check('a WebM is re-encoded', A.transcodeState === 'DONE', A.transcodeError);
    check('...to an MP4', A.mimeType === 'video/mp4' && A.storageKey.endsWith('-720p.mp4'), A.storageKey);
    check('...at 1280 on the long side', A.width === 1280 && A.height === 720, [A.width, A.height]);
    check('...with its length kept', Math.abs((A.durationSec ?? 0) - 3) < 0.6, A.durationSec);
    check('...and the address now points at the new file', A.url === storage.publicUrlFor(A.storageKey) && A.url !== storage.publicUrlFor(keys[0]));
    check('...the original is kept for now', A.originalStorageKey === keys[0] && onDisk(keys[0]));
    const mp4 = await bytesOf(A.storageKey);
    const moov = mp4.indexOf('moov');
    const mdat = mp4.indexOf('mdat');
    check('...with the index at the front, so it starts before it has all arrived', moov > 0 && mdat > 0 && moov < mdat, { moov, mdat });
    const probed = await transcode.probe(path.join(storage.localRoot, A.storageKey));
    check('...as H.264 with sound', probed.videoCodec === 'h264' && probed.hasAudio, probed);
    check('...and it is smaller than the original', Number(A.sizeBytes) < Number(a.sizeBytes), [Number(a.sizeBytes), Number(A.sizeBytes)]);
    check('...with a cover made for it', Boolean(A.thumbnailUrl), A.thumbnailUrl);
    const event = await prisma.domainEvent.findFirst({ where: { eventType: 'MediaTranscoded', aggregateId: a.id } });
    check('...recorded as a system event', event?.actorId === null && event?.actorType === 'SYSTEM', event);

    // ───────────── A portrait QuickTime movie with no sound ─────────────
    const mov = await src('portrait.mov', [...lavfi('1080x1920', 2, false), '-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
    const b = await asset(mov, 'video/quicktime', '.mov');
    await transcode.processAsset(b.id);
    const B = await reload(b.id);
    check('a portrait movie is re-encoded', B.transcodeState === 'DONE', B.transcodeError);
    check('...with its long side at 1280, not its width', B.width === 720 && B.height === 1280, [B.width, B.height]);
    const bp = await transcode.probe(path.join(storage.localRoot, B.storageKey));
    check('...and no sound where there was none', !bp.hasAudio, bp);

    // ───────────── A clip that is already right is left alone ─────────────
    const fine = await src('fine.mp4', [...lavfi('640x360', 1, true), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac']);
    const c = await asset(fine, 'video/mp4', '.mp4');
    await transcode.processAsset(c.id);
    const C = await reload(c.id);
    check('a small H.264 MP4 is left as it is', C.transcodeState === 'SKIPPED' && C.storageKey === c.storageKey, [C.transcodeState, C.storageKey]);
    check('...but its size and length are filled in', C.width === 640 && C.height === 360 && Boolean(C.durationSec), [C.width, C.height, C.durationSec]);
    check('...and it still gets a cover', Boolean(C.thumbnailUrl));

    // ───────────── An existing cover is never replaced ─────────────
    const withPoster = await asset(webm, 'video/webm', '.webm', { thumbnailUrl: 'https://example.test/mine.jpg' });
    await transcode.processAsset(withPoster.id);
    check('a cover the phone made is kept', (await reload(withPoster.id)).thumbnailUrl === 'https://example.test/mine.jpg');

    // ───────────── Not a video ─────────────
    const junkFile = path.join(dir, 'junk.mp4');
    await (await import('node:fs/promises')).writeFile(junkFile, Buffer.from('this is not a video, it is a sentence'));
    const d = await asset(junkFile, 'video/mp4', '.mp4');
    await transcode.processAsset(d.id);
    const D = await reload(d.id);
    check('a file that is not a video is given up on at once', D.transcodeState === 'FAILED' && /no video/i.test(D.transcodeError ?? ''), D);
    check('...and its original is untouched', D.storageKey === d.storageKey && onDisk(d.storageKey) && D.url === d.url);

    // ───────────── Retries, then giving up ─────────────
    const gone = await asset(junkFile, 'video/mp4', '.mp4', { transcodeAttempts: 1 });
    await storage.deleteObject(gone.storageKey);
    await transcode.processAsset(gone.id);
    const first = await reload(gone.id);
    check('a transient failure goes back in the queue', first.transcodeState === 'PENDING' && Boolean(first.transcodeError), first.transcodeState);
    await prisma.mediaAsset.update({ where: { id: gone.id }, data: { transcodeAttempts: 3 } });
    await transcode.processAsset(gone.id);
    check('...and is given up on after three tries', (await reload(gone.id)).transcodeState === 'FAILED');

    // ───────────── The queue ─────────────
    const q = await asset(fine, 'video/mp4', '.mp4', { transcodeState: 'PENDING' });
    const claims = await Promise.all([transcode.processNext(), transcode.processNext(), transcode.processNext()]);
    check('two sweeps cannot take the same clip', claims.filter(Boolean).length === 1, claims);
    check('...and the clip was handled', ['SKIPPED', 'DONE'].includes((await reload(q.id)).transcodeState));

    const stuck = await asset(fine, 'video/mp4', '.mp4', { transcodeState: 'PROCESSING' });
    await prisma.mediaAsset.update({ where: { id: stuck.id }, data: { updatedAt: new Date(Date.now() - 20 * 60_000) } });
    const swept = await transcode.runTranscodeSweep();
    check('work whose process died is released and done', swept.released >= 1 && ['SKIPPED', 'DONE'].includes((await reload(stuck.id)).transcodeState), swept);

    const recent = await asset(fine, 'video/mp4', '.mp4', { transcodeState: 'PROCESSING' });
    const left = await transcode.runTranscodeSweep();
    check('...but work that is just starting is not taken from its owner', (await reload(recent.id)).transcodeState === 'PROCESSING', left);

    // ───────────── Cleaning up replaced originals ─────────────
    const oldKey = keys[0];
    check('an original under two days old stays', (await transcode.sweepOriginals(new Date())) >= 0 && onDisk(oldKey));
    await prisma.mediaAsset.update({ where: { id: a.id }, data: { transcodedAt: new Date(Date.now() - 3 * 86_400_000) } });
    const cleaned = await transcode.sweepOriginals(new Date());
    check('an original past two days is deleted', cleaned >= 1 && !onDisk(oldKey), cleaned);
    const A2 = await reload(a.id);
    check('...its record forgets it, and the new file stays', A2.originalStorageKey === null && onDisk(A2.storageKey));
  } finally {
    // The sweep above can have claimed some rows: clean up by id, files by key.
    for (const id of made) await prisma.domainEvent.deleteMany({ where: { aggregateId: id } });
    const rows = await prisma.mediaAsset.findMany({ where: { id: { in: made } }, select: { storageKey: true, originalStorageKey: true, thumbnailUrl: true } });
    for (const r of rows) {
      // The cover is named after the key the clip was uploaded under, which for a
      // converted clip is the original, not the new file.
      const uploadedAs = r.originalStorageKey ?? r.storageKey;
      for (const k of [r.storageKey, r.originalStorageKey, uploadedAs.replace(/\.[^./]+$/, '-poster.jpg')]) {
        if (k) await storage.deleteObject(k).catch(() => undefined);
      }
    }
    for (const k of keys) await storage.deleteObject(k).catch(() => undefined);
    await prisma.mediaAsset.deleteMany({ where: { id: { in: made } } });
    await rm(path.join(storage.localRoot, 'transcode-check'), { recursive: true, force: true });
  }

  // ───────────── End to end through the real API ─────────────
  // The running server's own worker does this part: nothing here calls it.
  const health = e2eOnly ? await fetch(`${BASE}/health`).catch(() => null) : null;
  if (e2eOnly && !health?.ok) throw new Error('no API at ' + BASE);
  if (e2eOnly) {
    const login = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'member03@hcp.test', password: 'OnOn2026!' }) }).then((r) => r.json() as Promise<any>);
    const token = login.data.accessToken as string;
    const call = async (method: string, p: string, body?: unknown) => {
      const res = await fetch(`${BASE}${p}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: res.status, data: ((await res.json().catch(() => ({}))) as any).data };
    };
    const clip = await src('e2e.webm', [...lavfi('1920x1080', 2, true), '-c:v', 'libvpx', '-b:v', '3M', '-c:a', 'libvorbis']);
    const bytes = await readFile(clip);
    const draft = await call('POST', '/reels', { caption: 'transcode-check', visibility: 'PUBLIC', pinned: false });
    const reelId = draft.data.reel.id as string;
    try {
      const asked = await call('POST', '/media/uploads', { kind: 'VIDEO', mimeType: 'video/webm', sizeBytes: bytes.length, target: { type: 'REEL', id: reelId }, caption: null, clientId: `REEL:${reelId}:0` });
      await fetch(asked.data.upload.url, { method: 'PUT', headers: asked.data.upload.headers, body: bytes });
      const confirmed = await call('POST', `/media/${asked.data.media.id}/confirm`, { width: 1920, height: 1080, durationSec: 2 });
      const mediaId = asked.data.media.id as string;
      const queued = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
      check('confirming a video queues it', confirmed.status === 200 && ['PENDING', 'PROCESSING', 'DONE'].includes(queued.transcodeState), queued.transcodeState);
      check('...and what plays meanwhile is what was uploaded', confirmed.data?.media?.url?.endsWith('.webm') || queued.transcodeState === 'DONE');

      let row = queued;
      for (let i = 0; i < 60 && row.transcodeState !== 'DONE' && row.transcodeState !== 'FAILED'; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        row = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: mediaId } });
      }
      check('the server converts it by itself', row.transcodeState === 'DONE', [row.transcodeState, row.transcodeError]);
      if (row.transcodeState === 'DONE') {
        const res = await fetch(row.url!);
        check('...and serves the new file as video/mp4', res.ok && (res.headers.get('content-type') ?? '').includes('video/mp4'), res.headers.get('content-type'));
        await call('POST', `/reels/${reelId}/publish`);
        const shown = await call('GET', `/reels/${reelId}`);
        const item = shown.data?.reel?.items?.[0];
        check('...and the reel shows the new address and cover', Boolean(item?.url?.endsWith('-720p.mp4')) && Boolean(item?.posterUrl), item);
        for (const k of [row.storageKey, row.originalStorageKey, (row.originalStorageKey ?? row.storageKey).replace(/\.[^./]+$/, '-poster.jpg')]) if (k) await storage.deleteObject(k).catch(() => undefined);
      }
      await call('DELETE', `/reels/${reelId}`);
      await prisma.reel.deleteMany({ where: { id: reelId } }).catch(() => undefined);
      await prisma.mediaLink.deleteMany({ where: { mediaId } });
      await prisma.domainEvent.deleteMany({ where: { aggregateId: mediaId } });
      await prisma.mediaAsset.deleteMany({ where: { id: mediaId } }).catch(() => undefined);
    } finally {
      await prisma.reel.deleteMany({ where: { id: reelId } }).catch(() => undefined);
    }
  }

  await rm(dir, { recursive: true, force: true });
  console.log(`transcode-check: ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
