import { buildSync } from 'esbuild';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'api');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { entry: 'server/vercelIndex.ts', outfile: 'api/index.mjs' },
  { entry: 'server/vercelTranslateVoice.ts', outfile: 'api/translate-voice.mjs' },
];

for (const { entry, outfile } of targets) {
  buildSync({
    entryPoints: [path.join(rootDir, entry)],
    outfile: path.join(rootDir, outfile),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    packages: 'external',
    sourcemap: false,
    logLevel: 'info',
  });
}
