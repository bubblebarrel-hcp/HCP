import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import { TranscodeState } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { recordEvent } from './record.service';
import { deleteObject, downloadToFile, publicUrlFor, putObject, uploadFile } from './storage.service';

// D67. A clip is whatever the phone or the browser recorded: a WebM from a desktop
// browser (which iPhones cannot play), a QuickTime movie, a 4K file. After it is
// confirmed it is re-encoded to H.264 MP4, at most 1280 on the long side, with the
// index at the front so it starts playing before it has all arrived. The original
// plays until the new one is ready, then is kept for a couple of days (a page that
// cached the old address still works) and deleted.
//
// It runs inside the API, one clip at a time, polled from a timer, the same way
// the outbox does. That is right for a single long-running container (Railway) and
// is what to replace with a queue and a worker when there is more than one API
// instance (the outbox has the same caveat). Every step is idempotent: the claim is
// a row lock, a crashed run is retried, and the original is never touched until
// the replacement is verified and stored.

const MAX_ATTEMPTS = 3;
// Past this long on a clip, the process that had it is presumed dead.
const STUCK_AFTER_MINUTES = 15;
const KEEP_ORIGINAL_HOURS = 48;
// The long side of the picture, in pixels.
const MAX_SIDE = 1280;
// A clip that is already an MP4 of H.264 at this size or smaller is left alone.
const SKIP_BYTES = 12 * 1024 * 1024;
const POSTER_WIDTH = 1200;

export function ffmpegBinary(): string | null {
  return env.media.ffmpegPath || ffmpegStatic || null;
}

export function transcodeAvailable() {
  return env.media.transcodeEnabled && Boolean(ffmpegBinary());
}

// ─── ffmpeg ───

class FfmpegError extends Error {
  // A file that is not a video will never become one: retrying is pointless.
  permanent: boolean;
  constructor(message: string, permanent = false) {
    super(message);
    this.permanent = permanent;
  }
}

function run(args: string[], opts: { timeoutMs?: number; allowFailure?: boolean } = {}) {
  const binary = ffmpegBinary();
  if (!binary) throw new FfmpegError('ffmpeg is not available');
  return new Promise<string>((resolve, reject) => {
    const child = spawn(binary, ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    // ffmpeg writes everything to stderr. Keep the end of it: that is where the
    // reason is, and a long encode logs a progress line a second.
    let tail = '';
    child.stderr.on('data', (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-16_000);
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new FfmpegError(`ffmpeg ran past ${Math.round((opts.timeoutMs ?? env.media.transcodeTimeoutMs) / 1000)} seconds`));
    }, opts.timeoutMs ?? env.media.transcodeTimeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new FfmpegError(`ffmpeg could not start: ${err.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || opts.allowFailure) return resolve(tail);
      reject(new FfmpegError(`ffmpeg exited ${code}: ${tail.trim().split('\n').slice(-3).join(' | ')}`));
    });
  });
}

export interface Probe {
  durationSec: number | null;
  videoCodec: string | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
}

// `ffmpeg -i file` with no output prints what it found and exits non-zero, which
// is all that is needed here and saves shipping ffprobe as well.
export async function probe(file: string): Promise<Probe> {
  const out = await run(['-i', file], { timeoutMs: 30_000, allowFailure: true });
  const duration = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(out);
  const video = /Stream #[^\n]*Video:\s*([A-Za-z0-9_]+)[^\n]*?[, ](\d{2,5})x(\d{2,5})/.exec(out);
  return {
    durationSec: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : null,
    videoCodec: video ? video[1].toLowerCase() : null,
    width: video ? Number(video[2]) : null,
    height: video ? Number(video[3]) : null,
    hasAudio: /Stream #[^\n]*Audio:/.test(out),
  };
}

// The long side is capped and the other follows, kept even because H.264 needs it.
// Phones store a portrait clip as landscape plus a rotation flag; ffmpeg applies
// that before filtering, so `iw` and `ih` here are the picture as it is watched.
const SCALE = `scale='if(gt(iw,ih),min(${MAX_SIDE},iw),-2)':'if(gt(iw,ih),-2,min(${MAX_SIDE},ih))'`;

export function transcodeArgs(input: string, output: string, hasAudio: boolean) {
  return [
    '-y',
    '-i', input,
    '-vf', `${SCALE},format=yuv420p`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '26',
    // A ceiling, so a busy clip cannot balloon: about 10MB for thirty seconds.
    '-maxrate', '2800k',
    '-bufsize', '5600k',
    '-threads', '2',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '96k', '-ac', '2'] : ['-an']),
    '-movflags', '+faststart',
    output,
  ];
}

// ─── The queue ───

// One clip, claimed with a row lock so two sweeps (or two instances, later) cannot
// take the same one. Attempts back off a minute each, so a clip that fails is not
// hammered.
//
// Every time here is worked out in JavaScript and handed to the query as text cast
// to `timestamp`. Prisma stores these columns as UTC wall-clock time with no zone,
// and Postgres's own now() is in the database's zone, so comparing the two is only
// right on a server whose zone happens to be UTC. Casting the ISO text drops the
// zone and keeps the UTC reading, which is what is stored.
const ts = (date: Date) => date.toISOString();

async function claimNext(now = new Date()): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "MediaAsset"
    SET "transcodeState" = 'PROCESSING'::"TranscodeState",
        "transcodeAttempts" = "transcodeAttempts" + 1,
        "updatedAt" = ${ts(now)}::timestamp
    WHERE id = (
      SELECT id FROM "MediaAsset"
      WHERE "transcodeState" = 'PENDING'::"TranscodeState"
        AND kind = 'VIDEO'::"MediaKind"
        AND "updatedAt" + ("transcodeAttempts" * interval '1 minute') <= ${ts(now)}::timestamp
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return rows[0]?.id ?? null;
}

// Work whose process died: back in the queue, and due at once.
async function releaseStuck(now = new Date()) {
  const stuckBefore = new Date(now.getTime() - STUCK_AFTER_MINUTES * 60_000);
  const longAgo = new Date(now.getTime() - 3600_000);
  return prisma.$executeRaw`
    UPDATE "MediaAsset"
    SET "transcodeState" = 'PENDING'::"TranscodeState", "updatedAt" = ${ts(longAgo)}::timestamp
    WHERE "transcodeState" = 'PROCESSING'::"TranscodeState"
      AND "updatedAt" < ${ts(stuckBefore)}::timestamp`;
}

export async function processAsset(id: string) {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id },
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      sizeBytes: true,
      thumbnailUrl: true,
      transcodeAttempts: true,
    },
  });
  if (!asset) return;

  const dir = await mkdtemp(path.join(os.tmpdir(), 'shiggy-transcode-'));
  try {
    const input = path.join(dir, `in${path.extname(asset.storageKey) || '.bin'}`);
    await downloadToFile(asset.storageKey, input);
    const before = await probe(input);
    if (!before.videoCodec) throw new FfmpegError('That file has no video in it', true);

    const longSide = Math.max(before.width ?? 0, before.height ?? 0);
    const fine =
      asset.mimeType === 'video/mp4' &&
      before.videoCodec === 'h264' &&
      longSide > 0 &&
      longSide <= MAX_SIDE &&
      Number(asset.sizeBytes) <= SKIP_BYTES;

    const base = asset.storageKey.replace(/\.[^./]+$/, '');
    let poster: { key: string; url: string | null } | null = null;

    // A cover for clips that arrived without one (a grab that failed on the phone,
    // or one that never ran): the first moment, small.
    const makePoster = async (source: string) => {
      if (asset.thumbnailUrl) return;
      const posterFile = path.join(dir, 'poster.jpg');
      const at = Math.min(0.2, (before.durationSec ?? 0.4) / 2);
      await run(['-y', '-ss', String(at), '-i', source, '-frames:v', '1', '-vf', `scale='min(${POSTER_WIDTH},iw)':-2`, '-q:v', '4', posterFile], {
        timeoutMs: 30_000,
      });
      const key = `${base}-poster.jpg`;
      await putObject(key, await readFile(posterFile), 'image/jpeg');
      poster = { key, url: publicUrlFor(key) };
    };

    if (fine) {
      try {
        await makePoster(input);
      } catch (err) {
        logger.warn?.('Poster for a clip we kept as it was failed', { id, message: err instanceof Error ? err.message : String(err) });
      }
      await prisma.mediaAsset.update({
        where: { id },
        data: {
          transcodeState: TranscodeState.SKIPPED,
          transcodeError: null,
          transcodedAt: new Date(),
          width: before.width,
          height: before.height,
          durationSec: before.durationSec,
          ...(poster ? { thumbnailUrl: (poster as { url: string | null }).url } : {}),
        },
      });
      return;
    }

    const output = path.join(dir, 'out.mp4');
    await run(transcodeArgs(input, output, before.hasAudio));
    const after = await probe(output);
    const { size } = await stat(output);

    // Do not swap a clip for one that came out wrong. A drift of more than a
    // second and a half means ffmpeg stopped early or lost a stream.
    if (!after.videoCodec || size === 0) throw new FfmpegError('The re-encoded clip has no video');
    if (before.durationSec && after.durationSec && Math.abs(before.durationSec - after.durationSec) > 1.5) {
      throw new FfmpegError(`The re-encoded clip is ${after.durationSec}s but the original was ${before.durationSec}s`);
    }

    try {
      await makePoster(output);
    } catch (err) {
      logger.warn?.('Poster for a re-encoded clip failed', { id, message: err instanceof Error ? err.message : String(err) });
    }

    // Stored under a new key, so the original is untouched until this row points
    // at something that exists.
    const newKey = `${base}-720p.mp4`;
    await uploadFile(newKey, output, 'video/mp4');

    await prisma.$transaction(async (tx) => {
      await tx.mediaAsset.update({
        where: { id },
        data: {
          storageKey: newKey,
          url: publicUrlFor(newKey),
          mimeType: 'video/mp4',
          sizeBytes: BigInt(size),
          width: after.width,
          height: after.height,
          durationSec: after.durationSec,
          originalStorageKey: asset.storageKey,
          transcodeState: TranscodeState.DONE,
          transcodeError: null,
          transcodedAt: new Date(),
          ...(poster ? { thumbnailUrl: (poster as { url: string | null }).url } : {}),
        },
      });
      await recordEvent(tx, {
        eventType: 'MediaTranscoded',
        aggregateType: 'MediaAsset',
        aggregateId: id,
        // The system did this, not a person.
        actorId: null,
        payload: {
          fromMimeType: asset.mimeType,
          fromBytes: Number(asset.sizeBytes),
          toBytes: size,
          width: after.width,
          height: after.height,
        },
      });
    });
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    const permanent = err instanceof FfmpegError && err.permanent;
    const giveUp = permanent || asset.transcodeAttempts >= MAX_ATTEMPTS;
    logger.error('Video transcode failed', { id, attempt: asset.transcodeAttempts, giveUp, message });
    // The original is still what plays; a failure costs only the re-encode.
    await prisma.mediaAsset.update({
      where: { id },
      data: { transcodeState: giveUp ? TranscodeState.FAILED : TranscodeState.PENDING, transcodeError: message },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// One clip, if there is one. Returns whether it found any.
export async function processNext(now = new Date()) {
  const id = await claimNext(now);
  if (!id) return false;
  await processAsset(id);
  return true;
}

// Originals outlive their replacement by a couple of days and are then deleted.
export async function sweepOriginals(now = new Date()) {
  const rows = await prisma.mediaAsset.findMany({
    where: {
      originalStorageKey: { not: null },
      transcodeState: TranscodeState.DONE,
      transcodedAt: { lt: new Date(now.getTime() - KEEP_ORIGINAL_HOURS * 3600_000) },
    },
    select: { id: true, originalStorageKey: true },
    take: 100,
  });
  let deleted = 0;
  for (const row of rows) {
    try {
      if (row.originalStorageKey) await deleteObject(row.originalStorageKey);
      await prisma.mediaAsset.update({ where: { id: row.id }, data: { originalStorageKey: null } });
      deleted++;
    } catch (err) {
      logger.warn?.('Could not delete a replaced original', { id: row.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return deleted;
}

export async function runTranscodeSweep(now = new Date()) {
  const result = { released: 0, processed: 0, originalsDeleted: 0 };
  result.released = Number(await releaseStuck(now));
  // Everything waiting, one at a time: this is CPU work on the machine that also
  // answers requests, so it is never run in parallel.
  while (await processNext(now)) result.processed++;
  result.originalsDeleted = await sweepOriginals(now);
  return result;
}

// ─── The sweep ───

const INTERVAL_MS = 15 * 1000;
let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await runTranscodeSweep();
  } catch (err) {
    logger.error('Transcode sweep failed', { message: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}

export function startTranscodeWorker() {
  if (timer) return;
  if (!transcodeAvailable()) {
    logger.warn?.('Video transcoding is off (TRANSCODE_ENABLED=false, or no ffmpeg): clips are served as uploaded');
    return;
  }
  timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
  logger.info(`Video transcode worker started (every ${INTERVAL_MS / 1000}s, ffmpeg at ${ffmpegBinary()})`);
}

export function stopTranscodeWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
