import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawnSync } from 'child_process';

// Placeholder media for the heavy seed. Photos are procedurally drawn PNGs
// (hills, a sun, a few trees) so the app has real images to render without
// shipping any binary assets, and they need no dependency beyond node's zlib.
// Videos are short ffmpeg test patterns. Both land in uploads/seed/, which is
// git-ignored and served by the API's local-disk storage driver.

export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
export const SEED_DIR = 'seed';

type RGB = [number, number, number];

interface Palette {
  skyTop: RGB;
  skyBottom: RGB;
  sun: RGB;
  hills: [RGB, RGB, RGB];
  tree: RGB;
}

const PALETTES: Palette[] = [
  { skyTop: [255, 196, 150], skyBottom: [255, 232, 205], sun: [255, 214, 120], hills: [[244, 130, 92], [214, 84, 40], [150, 52, 22]], tree: [88, 36, 18] }, // dawn
  { skyTop: [96, 84, 160], skyBottom: [250, 160, 150], sun: [255, 224, 150], hills: [[120, 78, 140], [84, 52, 110], [52, 32, 76]], tree: [30, 20, 48] }, // dusk
  { skyTop: [120, 190, 240], skyBottom: [222, 242, 252], sun: [255, 244, 190], hills: [[130, 196, 120], [76, 158, 84], [40, 112, 60]], tree: [24, 78, 44] }, // noon
  { skyTop: [96, 196, 200], skyBottom: [208, 240, 236], sun: [255, 240, 170], hills: [[72, 170, 170], [38, 128, 140], [20, 86, 104]], tree: [14, 60, 74] }, // lagoon
  { skyTop: [238, 186, 96], skyBottom: [254, 232, 168], sun: [255, 250, 220], hills: [[204, 160, 70], [168, 116, 44], [118, 76, 30]], tree: [74, 48, 20] }, // savannah
  { skyTop: [18, 28, 70], skyBottom: [70, 90, 150], sun: [236, 240, 255], hills: [[40, 54, 100], [26, 36, 74], [14, 20, 46]], tree: [8, 12, 30] }, // night
];

// Small seeded generator so every run of the seed draws the same pictures.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgb: Buffer) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export function scenePng(seed: number, width: number, height: number, palette?: Palette) {
  const rnd = mulberry32(seed);
  const p = palette ?? PALETTES[seed % PALETTES.length];
  const px = Buffer.alloc(width * height * 3);

  const sunX = width * (0.2 + rnd() * 0.6);
  const sunY = height * (0.16 + rnd() * 0.2);
  const sunR = Math.min(width, height) * (0.06 + rnd() * 0.04);

  const layers = p.hills.map((color, i) => ({
    color,
    base: height * (0.5 + i * 0.13 + rnd() * 0.04),
    amp1: height * (0.05 + rnd() * 0.05),
    amp2: height * (0.015 + rnd() * 0.02),
    f1: (1.2 + rnd() * 1.6) / width,
    f2: (4 + rnd() * 5) / width,
    ph1: rnd() * 6.28,
    ph2: rnd() * 6.28,
  }));
  const hillY = (l: (typeof layers)[number], x: number) =>
    l.base + l.amp1 * Math.sin(x * l.f1 * 6.283 + l.ph1) + l.amp2 * Math.sin(x * l.f2 * 6.283 + l.ph2);

  for (let y = 0; y < height; y++) {
    const sky = mix(p.skyTop, p.skyBottom, y / (height * 0.7));
    for (let x = 0; x < width; x++) {
      let c: RGB = sky;
      const d = Math.hypot(x - sunX, y - sunY);
      if (d < sunR * 3.2) c = mix(c, p.sun, Math.max(0, 1 - d / (sunR * 3.2)) * 0.35);
      if (d < sunR) c = p.sun;
      for (let i = 0; i < layers.length; i++) {
        const top = hillY(layers[i], x);
        if (y >= top) c = mix(layers[i].color, [0, 0, 0], Math.min(0.28, ((y - top) / height) * 0.5));
      }
      const o = (y * width + x) * 3;
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
    }
  }

  // A few trees on the nearest ridge.
  const front = layers[2];
  const trees = 5 + Math.floor(rnd() * 8);
  for (let t = 0; t < trees; t++) {
    const tx = Math.floor(rnd() * width);
    const ty = Math.floor(hillY(front, tx)) + 4;
    const th = Math.floor(height * (0.05 + rnd() * 0.06));
    for (let row = 0; row < th; row++) {
      const half = Math.floor((row / th) * th * 0.32) + 1;
      const y = ty - th + row;
      if (y < 0 || y >= height) continue;
      for (let x = tx - half; x <= tx + half; x++) {
        if (x < 0 || x >= width) continue;
        const o = (y * width + x) * 3;
        px[o] = p.tree[0];
        px[o + 1] = p.tree[1];
        px[o + 2] = p.tree[2];
      }
    }
  }

  return encodePng(width, height, px);
}

export interface SeedImage {
  storageKey: string;
  width: number;
  height: number;
  sizeBytes: number;
}

function write(storageKey: string, data: Buffer) {
  const file = path.join(UPLOAD_ROOT, storageKey);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

// 18 landscape and 6 portrait scenes for run photos, posts and capsules.
export function generatePhotos(): SeedImage[] {
  const out: SeedImage[] = [];
  for (let i = 0; i < 24; i++) {
    const portrait = i >= 18;
    const width = portrait ? 640 : 960;
    const height = portrait ? 800 : 640;
    const buf = scenePng(1000 + i * 37, width, height);
    const storageKey = `${SEED_DIR}/photo-${String(i + 1).padStart(2, '0')}.png`;
    write(storageKey, buf);
    out.push({ storageKey, width, height, sizeBytes: buf.length });
  }
  return out;
}

// Kennel logo (square) and banner (wide), tinted by the kennel's own colour.
export function generateBranding(slug: string, index: number, primary: RGB, secondary: RGB) {
  const palette: Palette = {
    skyTop: mix(primary, [255, 255, 255], 0.55),
    skyBottom: mix(primary, [255, 255, 255], 0.85),
    sun: [255, 220, 130],
    hills: [mix(primary, secondary, 0.2), primary, mix(primary, [0, 0, 0], 0.45)],
    tree: mix(secondary, [0, 0, 0], 0.5),
  };
  const logo: SeedImage = { storageKey: `${SEED_DIR}/brand/${slug}-logo.png`, width: 400, height: 400, sizeBytes: 0 };
  const banner: SeedImage = { storageKey: `${SEED_DIR}/brand/${slug}-banner.png`, width: 1200, height: 400, sizeBytes: 0 };
  const logoBuf = scenePng(5000 + index * 11, logo.width, logo.height, palette);
  const bannerBuf = scenePng(7000 + index * 13, banner.width, banner.height, palette);
  write(logo.storageKey, logoBuf);
  write(banner.storageKey, bannerBuf);
  logo.sizeBytes = logoBuf.length;
  banner.sizeBytes = bannerBuf.length;
  return { logo, banner };
}

export interface SeedVideo {
  storageKey: string;
  width: number;
  height: number;
  durationSec: number;
  sizeBytes: number;
}

const VIDEO_SOURCES = [
  'testsrc2=size=360x640:rate=24:duration=4',
  'rgbtestsrc=size=360x640:rate=24:duration=4',
  'gradients=size=360x640:rate=24:duration=4:speed=0.05',
  'mandelbrot=size=360x640:rate=24',
  'smptebars=size=360x640:rate=24:duration=4',
  'life=size=360x640:rate=24:mold=10:ratio=0.1:death_color=#171717:life_color=#F4511E',
];

function ffmpegPath() {
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg'].filter(Boolean) as string[];
  for (const c of candidates) {
    const r = spawnSync(c, ['-version'], { stdio: 'ignore' });
    if (r.status === 0) return c;
  }
  return null;
}

// Returns whatever could be made. With no ffmpeg on the machine that is
// nothing, and the seed carries on without reels rather than fail.
export function generateVideos(count: number): SeedVideo[] {
  const bin = ffmpegPath();
  if (!bin) {
    console.warn('  ffmpeg not found (set FFMPEG_PATH): skipping reels');
    return [];
  }
  const out: SeedVideo[] = [];
  for (let i = 0; i < count; i++) {
    const storageKey = `${SEED_DIR}/reel-${String(i + 1).padStart(2, '0')}.mp4`;
    const file = path.join(UPLOAD_ROOT, storageKey);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const source = VIDEO_SOURCES[i % VIDEO_SOURCES.length];
    const r = spawnSync(
      bin,
      ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', source, '-t', '4', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-movflags', '+faststart', file],
      { stdio: 'ignore' },
    );
    if (r.status !== 0 || !fs.existsSync(file)) continue;
    out.push({ storageKey, width: 360, height: 640, durationSec: 4, sizeBytes: fs.statSync(file).size });
  }
  return out;
}
