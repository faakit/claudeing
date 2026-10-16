// A plain static server for dist/, for the browser suites: every file read once and kept in memory, sent
// uncompressed (it is localhost), with an ETag so a page that asks again gets a 304. `vite preview` gzips every
// response again for every page (each new browser context starts with an empty cache), which cost the scenario e2e
// about 100 s of CPU in its server alone. Same URLs and types as the preview: `base: './'`, index.html at '/'.
//
//   const { url, stop } = await serveStatic(4173);   // http://localhost:4173/
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.tmj': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.gpl': 'text/plain; charset=utf-8',
};

/** Serve `dir` on `port` (strict: a taken port fails). Resolves with { url, stop } once it listens. */
export function serveStatic(port, dir = 'dist') {
  const root = resolve(dir);
  const cache = new Map();
  const load = (path) => {
    let hit = cache.get(path);
    if (!hit) {
      const body = readFileSync(path);
      hit = { body, etag: `"${createHash('sha1').update(body).digest('base64url')}"` };
      cache.set(path, hit);
    }
    return hit;
  };
  const server = createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const path = normalize(join(root, rel));
    let ok = path.startsWith(root);
    try {
      ok &&= statSync(path).isFile();
    } catch {
      ok = false;
    }
    if (!ok) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    const { body, etag } = load(path);
    const headers = {
      'Content-Type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ETag: etag,
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    res.writeHead(200, { ...headers, 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return new Promise((ok, fail) => {
    server.once('error', (e) =>
      fail(new Error(`static server on port ${port}: ${e.code ?? e.message} (is it taken?)`)),
    );
    server.listen(port, 'localhost', () =>
      ok({ url: `http://localhost:${port}/`, stop: () => server.close() }),
    );
  });
}
