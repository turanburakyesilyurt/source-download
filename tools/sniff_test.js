'use strict';
/* Source Download — tests for API detection & content sniffing.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
const assert = require('assert');

// --- copied logic under test (mirrors panel.js) ---
const STATIC_EXTS = new Set(['png','jpg','jpeg','gif','webp','svg','mp4','mp3','css','js','mjs','woff','woff2','ttf','otf','json','html','txt','xml','wasm','webmanifest','manifest']);

function getExt(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : '';
  } catch {
    const m = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    return m ? m[1].toLowerCase() : '';
  }
}

function isApiRequest(entry) {
  return !!apiKindOf(entry);
}

function apiKindOf(entry) {
  const request = entry.request || {};
  const url = request.url || '';
  const mime = entry.response && entry.response.content ? entry.response.content.mimeType : '';
  const rt = entry._resourceType || (entry.response && entry.response._resourceType);
  if (rt === 'XHR' || rt === 'Fetch' || rt === 'xhr' || rt === 'fetch') {
    const pathname = (() => { try { return new URL(url).pathname; } catch { return ''; } })();
    const ext = (pathname.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
    if (!ext || !STATIC_EXTS.has(ext)) return 'xhr';
  }
  if (request.postData && (request.postData.text || (request.postData.params && request.postData.params.length))) return 'body';
  if (mime && mime.toLowerCase().includes('json')) {
    try {
      const pathname = new URL(url).pathname;
      if (STATIC_EXTS.has((pathname.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase())) return null;
    } catch { /* keep */ }
    return 'json';
  }
  try {
    const u = new URL(url);
    if ((request.method || 'GET') === 'GET' && u.search && !getExt(url)) {
      const ml = mime.toLowerCase();
      if (
        ml.startsWith('image/') || ml.startsWith('video/') || ml.startsWith('audio/') ||
        ml.includes('font') || ml === 'text/css' || /javascript/.test(ml) ||
        ml.includes('wasm') || ml === 'text/html'
      ) return null;
      return 'query';
    }
  } catch { /* noop */ }
  return null;
}

function sniffTextType(text) {
  const t = text.trim();
  if (!t) return null;
  const head = t.slice(0, 4096);
  if (/^<svg[\s>/]/i.test(head)) return 'svg';
  if (/^<!doctype\s+html/i.test(head) || /^<html[\s>]/i.test(head)) return 'document';
  if (/^<\?xml/i.test(head)) return 'document';
  const first = head[0];
  if (first === '{' || first === '[') {
    try { JSON.parse(t.length <= 262144 ? t : t.slice(0, 262144)); } catch { /* still promote */ }
    return 'json';
  }
  if (/^[a-zA-Z_$][\w$]*\s*\(/.test(head)) return 'js'; // JSONP
  if (/^(function\b|const\b|let\b|var\b|class\b|async\b|document\.|window\.|module\.exports|import\b|export\b)/.test(head)) return 'js';
  if (/^@(charset|import|media|supports|font-face|keyframes|namespace)\b/i.test(head)) return 'css';
  return null;
}

function sniffBinaryType(content) {
  const b = content instanceof Uint8Array ? content : new Uint8Array(content || []);
  if (b.length < 4) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image';
  if (b[0] === 0x00 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d) return 'wasm';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'document';
  if (b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x46) return 'font';
  if ((b[0] === 0x00 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) ||
      (b[0] === 0x4f && b[1] === 0x54 && b[2] === 0x54 && b[3] === 0x4f)) return 'font';
  return null;
}

// --- isApiRequest tests ---
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/api/users?limit=10' }, _resourceType: 'Fetch' }), true, 'fetch query');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/api/users' }, _resourceType: 'Fetch' }), true, 'fetch no-ext');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/bundle.js' }, _resourceType: 'Script' }), false, 'script rt');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/logo.png' }, _resourceType: 'Fetch' }), false, 'fetch png is static');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/data.json' }, response: { content: { mimeType: 'application/json' } }, _resourceType: 'Fetch' }), false, 'fetch json file is static');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/api/state' }, response: { content: { mimeType: 'application/json' } } }), true, 'json response');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/poll?a=1&b=2' }, _resourceType: 'XHR' }), true, 'xhr');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/feed', method: 'POST', postData: { text: '{"x":1}' } } }), true, 'postData');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/static/thing' } }), false, 'no query no ext no rt');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/static/thing?v=1' } }), true, 'query on ext-less GET is api');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/app.css?v=2' }, response: { content: { mimeType: 'text/css' } } }), false, 'css cache-bust');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/logo?v=1' }, response: { content: { mimeType: 'image/png' } } }), false, 'png resize endpoint');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/data?v=1' }, response: { content: { mimeType: 'application/json' } } }), true, 'query + json mime is api');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/video.mp4?v=1' } }), false, 'mp4 with query');
assert.strictEqual(apiKindOf({ request: { url: 'https://x.com/api/users' }, _resourceType: 'Fetch' }), 'xhr', 'xhr kind');
assert.strictEqual(apiKindOf({ request: { url: 'https://x.com/feed', method: 'POST', postData: { text: '{}' } } }), 'body', 'body kind');
assert.strictEqual(apiKindOf({ request: { url: 'https://x.com/api/state' }, response: { content: { mimeType: 'application/json' } } }), 'json', 'json kind');
assert.strictEqual(apiKindOf({ request: { url: 'https://x.com/search?q=1' } }), 'query', 'query kind');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/search?q=hello' } }), true, 'query only');
assert.strictEqual(isApiRequest({ request: { url: 'https://x.com/a.css?v=2' } }), false, 'css with query');

// --- sniffTextType tests ---
assert.strictEqual(sniffTextType('{"name": "a", "items": [1,2]}'), 'json', 'json obj');
assert.strictEqual(sniffTextType('[{"a":1}]'), 'json', 'json arr');
assert.strictEqual(sniffTextType('   { "k" : "v" }   '), 'json', 'json padded');
assert.strictEqual(sniffTextType('const x = 1;\nfunction f() { return 2; }'), 'js', 'js const');
assert.strictEqual(sniffTextType('function foo() {}'), 'js', 'js function');
assert.strictEqual(sniffTextType('window.loadData = function () {};'), 'js', 'js window');
assert.strictEqual(sniffTextType('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'), 'svg', 'svg');
assert.strictEqual(sniffTextType('<!DOCTYPE html><html><head></head></html>'), 'document', 'html');
assert.strictEqual(sniffTextType('<?xml version="1.0"?><rss/>'), 'document', 'xml');
assert.strictEqual(sniffTextType('@import url("x.css");'), 'css', 'css import');

// --- CSS @import extraction (matches panel.js scanCssResources) ---
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*(?:'([^']*)'|"([^"]*)"|([^)'"]+))\s*\)|'([^']*)'|"([^"]*)")\s*[^;]*;/g;
function importRefs(text) {
  const refs = [];
  CSS_IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = CSS_IMPORT_RE.exec(text)) !== null) {
    const ref = (m[1] || m[2] || m[3] || m[4] || m[5] || '').trim();
    if (ref && !ref.startsWith('#') && !ref.startsWith('data:')) refs.push(ref);
  }
  return refs;
}
assert.deepStrictEqual(
  importRefs('@import url("fonts/roboto.css");@import "theme.css";'),
  ['fonts/roboto.css', 'theme.css'],
  'import url() + bare string'
);
assert.deepStrictEqual(
  importRefs(`@import 'print.css' print; @import url(https://fonts.googleapis.com/css2?family=Roboto&display=swap);`),
  ['print.css', 'https://fonts.googleapis.com/css2?family=Roboto&display=swap'],
  'import with media query + unquoted url'
);
assert.deepStrictEqual(importRefs('.a{background:url(img/bg.png)}'), [], 'no import in body');
assert.deepStrictEqual(importRefs('@import url("data:font/woff2;base64,AAAA");'), [], 'data: import ignored');
assert.strictEqual(sniffTextType('plain random text'), null, 'unknown');
assert.strictEqual(sniffTextType('callback({"a":1});'), 'js', 'jsonp');
assert.strictEqual(sniffTextType(''), null, 'empty');

// large single-line json (>262KB) still promotes
const big = '[' + Array.from({ length: 30000 }, () => '{"a":1,"b":2,"c":3,"d":4,"e":5}').join(',') + ']';
assert.strictEqual(sniffTextType(big), 'json', 'big single-line json');

// --- sniffBinaryType tests ---
assert.strictEqual(sniffBinaryType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image', 'png');
assert.strictEqual(sniffBinaryType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])), 'image', 'jpeg');
assert.strictEqual(sniffBinaryType(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00])), 'wasm', 'wasm');
assert.strictEqual(sniffBinaryType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35])), 'document', 'pdf');
assert.strictEqual(sniffBinaryType(new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0x00, 0x01])), 'font', 'woff');
assert.strictEqual(sniffBinaryType(new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x00])), 'font', 'ttf');
assert.strictEqual(sniffBinaryType(new Uint8Array([1, 2, 3, 4])), null, 'unknown binary');

console.log('ALL MIXED TESTS PASSED');
