// MapLibre GL 6 starts its web worker from a URL it derives from import.meta.url.
// A bundler rewrites that to a file:// path, MapLibre then yields an empty worker
// URL, `new Worker('')` fails, and anything that needs the worker (the trail's
// route line, which is a GeoJSON layer) silently never draws.
//
// So the worker is served from our own origin and TrailMap points MapLibre at it
// with setWorkerUrl(). The two files are copied from node_modules rather than
// committed, so they always match the installed version. Runs on `dev` and `build`.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'maplibre-gl', 'dist');
const to = join(root, 'public', 'maplibre');

// The worker imports the shared module by relative path, so both travel together.
const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

if (!existsSync(from)) {
  console.warn('sync-maplibre-worker: maplibre-gl is not installed, skipping');
  process.exit(0);
}
mkdirSync(to, { recursive: true });
for (const file of files) copyFileSync(join(from, file), join(to, file));
console.log(`sync-maplibre-worker: copied ${files.length} files to public/maplibre`);
