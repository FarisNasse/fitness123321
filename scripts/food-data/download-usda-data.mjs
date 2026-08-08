#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}
const url = arg('--url');
const output = arg('--output');
if (!url || !output || !/^https:\/\//i.test(url)) {
  console.error('Usage: node download-usda-data.mjs --url https://... --output path/to/file');
  process.exit(2);
}

const response = await fetch(url, { redirect: 'follow' });
if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
await fs.promises.mkdir(path.dirname(path.resolve(output)), { recursive: true });
await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(output));
console.log(JSON.stringify({ output, contentLength: response.headers.get('content-length') }, null, 2));
