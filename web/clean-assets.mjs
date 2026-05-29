// Wipes the built artefacts (../docs/assets) so the next Vite build
// doesn't leave behind stale hash-named bundles. Leaves the
// product-brain markdown in docs/ untouched — only the assets
// directory and the two known compiled HTML entry points are
// candidates for removal. Run before `vite build`.

import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docs = resolve(__dirname, '../docs');
const assets = join(docs, 'assets');

if (existsSync(assets) && statSync(assets).isDirectory()) {
  for (const entry of readdirSync(assets)) {
    const p = join(assets, entry);
    rmSync(p, { recursive: true, force: true });
  }
  // eslint-disable-next-line no-console
  console.log('cleaned ' + assets);
}
