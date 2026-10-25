#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const srcDir = join(root, 'extension', 'src');
const outDir = join(root, 'extension', 'dist');

const version = process.env.NR_VERSION || '1.0.0';
const wsUrl = process.env.NR_WS_URL || 'wss://lztws.d9v.uk/ws';
const accessKey = process.env.NR_ACCESS_KEY || '';

if (!accessKey) {
  console.error('NR_ACCESS_KEY is required (shared extension access key).');
  process.exit(1);
}
if (!/^wss?:\/\//.test(wsUrl)) {
  console.error('NR_WS_URL must start with ws:// or wss://');
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('NR_VERSION must be semver-like, e.g. 1.0.0');
  process.exit(1);
}

const files = ['00-core.js', '10-ui.js', '20-messages.js', '30-ws.js', '40-main.js'];
const parts = [];
for (const file of files) {
  parts.push(`// ---- ${file} ----\n${await readFile(join(srcDir, file), 'utf8')}`);
}

let header = await readFile(join(srcDir, 'header.txt'), 'utf8');
header = header.replaceAll('__VERSION__', version);

let body = parts.join('\n\n');
body = body
  .replaceAll('__WS_URL__', wsUrl)
  .replaceAll('__ACCESS_KEY__', accessKey)
  .replaceAll('__VERSION__', version);

const banner = `// Generated ${new Date().toISOString()} — build with scripts/build-extension.mjs\n`;
const output = `${banner}${header}\n(function () {\n'use strict';\n\n${body}\n})();\n`;

await mkdir(outDir, { recursive: true });
const target = join(outDir, 'no-rules.user.js');
await writeFile(target, output, 'utf8');
console.log(`Built ${target}`);
console.log(`  version=${version}`);
console.log(`  ws=${wsUrl}`);
console.log(`  accessKeyLength=${accessKey.length}`);
