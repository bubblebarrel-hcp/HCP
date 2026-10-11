// A synthetic 1080p clip through the real transcode pipeline (D67, D69): checks the
// default 720p, the 360p and the 1080p all come out, are stored, and are what a
// post would serialize. Needs a local database and the bundled ffmpeg; it removes
// what it made. Run: `npx tsx scripts/rendition-check.ts`.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import prisma from '../src/config/prisma';
import { processAsset, probe } from '../src/services/transcode.service';
import { deleteObject, putObject, publicUrlFor, downloadToFile } from '../src/services/storage.service';
import { serializeRenditions } from '../src/services/rendition';

async function main() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rendition-check-'));
  const src = path.join(dir, 'src.mp4');
  const made = spawnSync(ffmpegStatic as string, [
    '-y', '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440',
    '-t', '3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', src,
  ]);
  if (made.status !== 0) throw new Error('could not make a test clip');

  const key = `check/rendition-${Date.now()}.mp4`;
  await putObject(key, readFileSync(src), 'video/mp4');
  const user = await prisma.user.findFirstOrThrow({ where: { email: 'hasher@hcp.test' } });
  const asset = await prisma.mediaAsset.create({
    data: {
      uploaderId: user.id, kind: 'VIDEO', storageKey: key, url: publicUrlFor(key), mimeType: 'video/mp4',
      sizeBytes: BigInt(readFileSync(src).length), uploadState: 'AVAILABLE', transcodeState: 'PENDING', transcodeAttempts: 1,
    },
  });

  let failed = 0;
  const check = (name: string, ok: boolean, detail?: unknown) => { if (!ok) { failed++; console.log('  FAIL', name, detail ?? ''); } else console.log('  ok  ', name); };
  try {
    await processAsset(asset.id);
    const row = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id }, include: { renditions: true } });
    const labels = row.renditions.map((r) => r.label).sort();
    check('transcode finished', row.transcodeState === 'DONE', row.transcodeState + ' ' + row.transcodeError);
    check('default is 720p', Math.min(row.width ?? 0, row.height ?? 0) === 720, [row.width, row.height]);
    check('has 360p and 1080p', labels.join() === '1080p,360p', labels);
    check('renditionsAt is set', row.renditionsAt !== null);
    const out = serializeRenditions(row.renditions);
    check('serialized small to large', out[0]?.label === '360p' && out[1]?.label === '1080p', out.map((o) => o.label));
    for (const r of row.renditions) {
      const f = path.join(dir, `${r.label}.mp4`);
      await downloadToFile(r.storageKey, f);
      const info = await probe(f);
      const short = Math.min(info.width ?? 0, info.height ?? 0);
      check(`${r.label} is really ${r.label}`, short === Number.parseInt(r.label), short);
      check(`${r.label} has sound`, info.hasAudio);
    }
  } finally {
    const row = await prisma.mediaAsset.findUnique({ where: { id: asset.id }, include: { renditions: true } });
    for (const k of [key, row?.storageKey, row?.originalStorageKey, ...(row?.renditions.map((r) => r.storageKey) ?? [])]) {
      if (k) await deleteObject(k).catch(() => undefined);
    }
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    await prisma.$disconnect();
  }
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
