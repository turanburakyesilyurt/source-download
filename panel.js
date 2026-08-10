/*
 * Source Download — Chrome DevTools panel.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
/* global SourceDownloadZip, SourceDownloadBeautify */

'use strict';

/* ============================================================
 * 1. Constants & helpers
 * ============================================================ */

const TYPES = {
  all:      { label: 'All',       folder: null },
  api:      { label: 'API',       folder: 'api' },
  image:    { label: 'Images',    folder: 'images' },
  svg:      { label: 'SVG',       folder: 'svg' },
  video:    { label: 'Videos',    folder: 'videos' },
  audio:    { label: 'Audio',     folder: 'audio' },
  css:      { label: 'CSS',       folder: 'css' },
  js:       { label: 'JS',        folder: 'js' },
  font:     { label: 'Fonts',     folder: 'fonts' },
  document: { label: 'Documents', folder: 'documents' },
  json:     { label: 'JSON',      folder: 'json' },
  wasm:     { label: 'WASM',      folder: 'wasm' },
  manifest: { label: 'Manifests', folder: 'manifests' },
  text:     { label: 'Text',      folder: 'text' },
  other:    { label: 'Other',     folder: 'other' },
};

const EXT_TYPES = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  ico: 'image', avif: 'image', bmp: 'image', jxl: 'image', jfif: 'image',
  svg: 'svg', svgz: 'svg',
  mp4: 'video', webm: 'video', mkv: 'video', mov: 'video', m4v: 'video', ogv: 'video',
  ts: 'video', m3u8: 'video', m3u: 'video', mpd: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', m4a: 'audio', aac: 'audio',
  flac: 'audio', opus: 'audio', weba: 'audio',
  css: 'css',
  js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', tsx: 'js',
  woff: 'font', woff2: 'font', ttf: 'font', otf: 'font', eot: 'font',
  pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document',
  ppt: 'document', pptx: 'document', txt: 'document', xml: 'document',
  html: 'document', htm: 'document', csv: 'document', md: 'document', rtf: 'document',
  zip: 'document', gz: 'document',
  json: 'json', json5: 'json', geojson: 'json', map: 'json',
  wasm: 'wasm',
  webmanifest: 'manifest', manifest: 'manifest',
};

const MIME_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/svg+xml': 'svg', 'image/avif': 'avif', 'image/x-icon': 'ico', 'image/bmp': 'bmp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/x-m4v': 'm4v', 'video/ogg': 'ogv',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg',
  'audio/aac': 'aac', 'audio/mp4': 'm4a', 'audio/flac': 'flac', 'audio/webm': 'weba',
  'text/css': 'css', 'text/javascript': 'js', 'application/javascript': 'js',
  'font/woff2': 'woff2', 'font/woff': 'woff', 'application/font-woff': 'woff',
  'font/ttf': 'ttf', 'font/otf': 'otf', 'application/x-font-ttf': 'ttf',
  'application/vnd.ms-fontobject': 'eot',
  'application/json': 'json', 'application/manifest+json': 'webmanifest',
  'text/html': 'html', 'text/plain': 'txt',
  'application/pdf': 'pdf', 'text/xml': 'xml', 'application/xml': 'xml', 'text/csv': 'csv',
  'application/wasm': 'wasm',
};

const TYPE_DOT_COLORS = {
  all: '#9aa0ae',
  api: '#a78bfa',
  image: '#7dd3fc',
  svg: '#fbbf24',
  video: '#fca5a5',
  audio: '#fcd34d',
  css: '#c4b5fd',
  js: '#86efac',
  font: '#f9a8d4',
  document: '#fdba74',
  json: '#60a5fa',
  wasm: '#f472b6',
  manifest: '#a78bfa',
  text: '#5eead4',
  other: '#e5e7eb',
};

const ICONS = {  download: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v7.5M4.5 7l3.5 3L11.5 7"/><path d="M2.5 12.5h11"/></svg>',
  open: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5H2.5V13.5H13.5V10"/><path d="M9 2.5h4.5V7"/><path d="M13.5 2.5L8 8"/></svg>',
  copy: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="8" height="8" rx="2"/><path d="M4 10H3a1 1 0 01-1-1V3a1 1 0 011-1h6a1 1 0 011 1v1"/></svg>',
  all: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h10M7 18h10M5 8v8M19 8v8"/></svg>',
  api: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7"/><path d="M9 7l-3-3M15 7l3-3"/><path d="M9 13h2M13 13h2M9 16h4"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="M21 15l-5-5-9 9"/></svg>',
  video: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><polygon points="10,9 15,12 10,15" fill="currentColor" stroke="none"/></svg>',
  audio: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
  css: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l1.6 16L12 21.5 18.4 20 20 4z"/><path d="M8 8h8M8.5 12.5h7M9.5 16.5h5"/></svg>',
  js: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8v7a3 3 0 006 0v-1"/><path d="M8 15h3"/></svg>',
  font: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19L9 5h6l4 14"/><path d="M7 13.5h10"/></svg>',
  document: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/></svg>',
  svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L21 20H3z"/><path d="M12 9l2.5 5h-5z"/></svg>',
  json: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v3a2 2 0 01-2 2 2 2 0 012 2v3a2 2 0 002 2h2"/><path d="M15 5h2a2 2 0 012 2v3a2 2 0 012 2 2 2 0 01-2 2v3a2 2 0 01-2 2h-2"/></svg>',
  wasm: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M9 8l2 8 1-5 1 5 2-8"/></svg>',
  manifest: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v4M16 3v4"/><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 10h6M9 14h6"/></svg>',
  other: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18M7 14h6"/></svg>',
  text: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5V3h14v2"/><path d="M12 3v18M9 21h6"/></svg>',
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function sanitizeName(name) {
  return String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, '_');
}

function hasExtension(name) {
  return /\.[a-z0-9]{1,6}$/i.test(name);
}

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

function mimeExt(mime) {
  return MIME_EXT[(mime || '').toLowerCase()] || '';
}

function filenameFromUrl(url, mimeType) {
  let name = '';
  try {
    const u = new URL(url);
    name = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    if (!name) {
      const m = (u.pathname + u.search).match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
      name = m ? 'resource.' + m[1] : 'resource';
    }
    if (!hasExtension(name)) {
      const ext = mimeExt(mimeType);
      if (ext) name += '.' + ext;
    }
  } catch {
    const m = url.match(/([^/?#]+)(?:[?#]|$)/);
    name = m ? m[1] : 'resource';
  }
  name = sanitizeName(name);
  if (!name || name === '.') name = 'resource';
  if (name.length > 160) name = name.slice(0, 160);
  return name;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

function classifyByUrl(url, mimeType) {
  const m = (mimeType || '').toLowerCase();
  if (m) {
    if (m.includes('svg')) return 'svg';
    if (m.includes('wasm')) return 'wasm';
    if (m.includes('manifest')) return 'manifest';
    if (m.includes('json')) return 'json';
    if (m.startsWith('image/')) return 'image';
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('audio/')) return 'audio';
    if (m.includes('font') || m.includes('woff') || m.includes('font-opentype') || m.includes('ms-fontobject')) return 'font';
    if (m === 'text/css') return 'css';
    if (/javascript|ecmascript|^text\/js/.test(m)) return 'js';
    if (/text\/html|application\/pdf|text\/plain|application\/(x-)?xml|xhtml|text\/csv|rtf/.test(m)) return 'document';
  }
  const ext = getExt(url);
  if (EXT_TYPES[ext]) return EXT_TYPES[ext];
  const m2 = url.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
  if (m2 && EXT_TYPES[m2[1].toLowerCase()]) return EXT_TYPES[m2[1].toLowerCase()];
  return 'other';
}

const STATIC_EXTS = new Set(Object.keys(EXT_TYPES));

// "Smart" API detection. Returns a kind string when the entry is an API call,
// otherwise null:
//   'xhr'   — XHR/fetch of a non-static asset
//   'body'  — request carries a POST body
//   'json'  — response content type is JSON
//   'query' — extension-less GET with a query string
// Static assets (images, scripts, styles, fonts, …) never match — including
// cache-busting GETs like /app.css?v=2 (their MIME type gives them away).
function apiKindOf(entry) {
  const request = entry.request || {};
  const url = request.url || '';
  const mime = entry.response && entry.response.content ? entry.response.content.mimeType : '';
  const rt = entry._resourceType || (entry.response && entry.response._resourceType);

  if (rt === 'XHR' || rt === 'Fetch' || rt === 'xhr' || rt === 'fetch') {
    // fetch('bundle.js') is a static asset, not an API call.
    const pathname = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return '';
      }
    })();
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
  // Extension-less GET with a query string — unless the response MIME says it's
  // a static asset (cache-busting URLs, image resize endpoints without an ext).
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

function isApiRequest(entry) {
  return !!apiKindOf(entry);
}

function classifyEntry(entry) {
  const mime = entry.response && entry.response.content ? entry.response.content.mimeType : '';
  const rt = entry._resourceType || (entry.response && entry.response._resourceType);
  if (isApiRequest(entry)) return 'api';
  if (rt) {
    if (rt === 'Image') return classifyByUrl(entry.request.url, mime);
    if (rt === 'Stylesheet') return 'css';
    if (rt === 'Script') return 'js';
    if (rt === 'Font') return 'font';
    if (rt === 'Document') return 'document';
    if (rt === 'Media') return classifyByUrl(entry.request.url, mime);
    if (rt === 'Manifest') return 'manifest';
    if (rt === 'WebSocket') return 'other';
  }
  return classifyByUrl(entry.request.url, mime);
}

function guessMime(url) {
  const ext = getExt(url);
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', avif: 'image/avif',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
    css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', ts: 'text/javascript',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
    json: 'application/json', pdf: 'application/pdf', html: 'text/html', htm: 'text/html',
    txt: 'text/plain', xml: 'text/xml', csv: 'text/csv', md: 'text/plain', wasm: 'application/wasm',
    webmanifest: 'application/manifest+json',
  };
  return map[ext] || '';
}

function formatBytes(n) {
  if (n === undefined || n === null || isNaN(n) || n < 0) return '—';
  if (n < 1024) return n + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  let v = n;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  const dec = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return v.toFixed(dec) + ' ' + units[i];
}

function isDisplayableUrl(url) {
  return /^(https?:|data:)/.test(url);
}

// Schemes that can never be downloaded/fetched from the panel context.
// The page itself may repeatedly request "chrome-extension://invalid/" (e.g.
// an Ember dev-tools bridge) — we must never ingest or fetch those.
const BLOCKED_SCHEMES = /^(chrome-extension|chrome|chromium|devtools|about|moz-extension|edge|vivaldi|brave|opera|safari-extension):/i;

function isFetchableUrl(url) {
  return /^(https?:|data:|blob:)/.test(url);
}

function isTextType(res) {
  const m = (res.mimeType || '').toLowerCase();
  if (['css', 'js', 'svg', 'json', 'manifest'].includes(res.type)) return true;
  if (/(text\/|application\/(json|xml|javascript|x-javascript|xhtml|manifest))/i.test(m)) return true;
  const ext = getExt(res.url);
  return [
    'json', 'map', 'html', 'htm', 'txt', 'xml', 'svg', 'css', 'js', 'mjs',
    'md', 'csv', 'tsv', 'yml', 'yaml', 'ini', 'log', 'rtf',
  ].includes(ext);
}

function isJsonType(res) {
  const m = (res.mimeType || '').toLowerCase();
  if (m.includes('json')) return true;
  const ext = getExt(res.url);
  return ['json', 'map'].includes(ext);
}

function base64ToUint8(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function toBlob(content, mime) {
  if (content instanceof Blob) return content;
  const opts = mime ? { type: mime } : undefined;
  return new Blob([content], opts);
}

const textDecoder = new TextDecoder('utf-8');
function decodeU8(u8) {
  try {
    return textDecoder.decode(u8);
  } catch {
    return '';
  }
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}

function copyText(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      /* noop */
    }
    ta.remove();
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(fallback);
  } else {
    fallback();
  }
}

/* ============================================================
 * 2. State
 * ============================================================ */

const state = {
  resources: [],
  byUrl: new Map(),
  selected: new Set(),
  activeTab: 'all',
  search: '',
  view: 'list',
  current: null,
  open: [],
  busy: false,
  failed: new Set(),
  contentIndex: new Map(),
  searching: false,
  filters: {
    minSize: '',
    maxSize: '',
    minWidth: '',
    minHeight: '',
    sortBy: 'name',
    sortDir: 'asc',
    method: '',
    reqType: '',
  },
  text: {
    blocks: [],
    tables: new Map(),
    live: true,
    sel: new Set(),
    lastSig: '',
    filters: {
      kind: 'all',      // all | heading | paragraph | list | table | css
      level: 'all',     // all | h1 | h2 | h3 | h4 | h5 | h6
      css: '',          // custom CSS selector
      query: '',        // text filter across captured content
    },
  },
};

let idCounter = 0;
let renderTimer = null;
let searchTimer = null;
let syncPanelTimer = null;

/* ============================================================
 * 3. Resource ingestion
 * ============================================================ */

const API_LIMIT = 500;
let apiCount = 0;

function buildResource(partial, type, mimeType) {
  return {
    id: 'r' + (++idCounter),
    url: partial.url,
    type,
    mimeType,
    size: partial.size,
    status: partial.status,
    method: partial.method,
    source: partial.source || 'network',
    tag: partial.tag,
    title: partial.title,
    alt: partial.alt,
    filename: filenameFromUrl(partial.url, mimeType),
    hostname: hostnameOf(partial.url),
    entry: partial.entry,
    request: partial.request || null,
    resourceType: partial.resourceType || '',
    _apiKind: partial._apiKind || null,
    width: partial.width,
    height: partial.height,
    time: partial.time,
    isNew: true,
    contentPromise: null,
  };
}

function addResource(partial) {
  const url = partial.url;
  if (!url || typeof url !== 'string') return null;
  if (BLOCKED_SCHEMES.test(url)) return null;
  const type = partial.type || classifyByUrl(url, partial.mimeType);
  const mimeType = partial.mimeType || guessMime(url);

  // API calls keep every response — the same endpoint can return different
  // data each time (live tables, dashboards, polls). Bound with a FIFO cap so
  // a chatty app can't grow the list without limit.
  if (type === 'api') {
    if (apiCount >= API_LIMIT) {
      const idx = state.resources.findIndex((r) => r.type === 'api');
      if (idx !== -1) {
        const removed = state.resources.splice(idx, 1)[0];
        apiCount--;
        if (removed) state.failed.delete(removed.id);
      }
    }
    const res = buildResource(partial, type, mimeType);
    state.resources.push(res);
    apiCount++;
    return res;
  }

  const existing = state.byUrl.get(url);
  if (existing) {
    if (partial.entry && !existing.entry) {
      existing.entry = partial.entry;
      existing.source = 'network';
    }
    if (partial.size && !existing.size) existing.size = partial.size;
    if (partial.status && !existing.status) {
      existing.status = partial.status;
      existing.method = partial.method;
    }
    if (partial.mimeType && !existing.mimeType) existing.mimeType = partial.mimeType;
    if (existing.type === 'other' && partial.type && partial.type !== 'other') {
      existing.type = partial.type;
    }
    return existing;
  }
  const res = buildResource(partial, type, mimeType);
  state.resources.push(res);
  state.byUrl.set(url, res);
  return res;
}

/* ============================================================
 * 3a. Content sniffing — reclassify unknown resources
 *
 * Extension-based classification pushes genuinely useful files (JSON feeds,
 * JSONP callbacks, bare text) into "other". We read back a small sample of
 * those resources and promote them to their real category so they get the
 * right preview and beautifier.
 * ============================================================ */

const SNIFF_CONCURRENCY = 4;
let sniffRunning = false;

function sniffBinaryType(content) {
  const b = content instanceof Uint8Array ? content : new Uint8Array(content || []);
  if (b.length < 4) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image'; // PNG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image'; // JPEG
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image'; // GIF
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image'; // WebP
  if (b[0] === 0x00 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d) return 'wasm'; // \0asm
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'document'; // %PDF
  if (b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x46) return 'font'; // wOFF
  if ((b[0] === 0x00 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) ||
      (b[0] === 0x4f && b[1] === 0x54 && b[2] === 0x54 && b[3] === 0x4f)) return 'font'; // TTF/OTF
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
    // `{`/`[` bodies are JSON in the overwhelming majority of cases. Validate
    // when cheap; truncated or huge single-line payloads still get promoted so
    // they receive the JSON viewer.
    try {
      JSON.parse(t.length <= 262144 ? t : t.slice(0, 262144));
    } catch {
      /* fall through — still promote */
    }
    return 'json';
  }
  if (/^[a-zA-Z_$][\w$]*\s*\(/.test(head)) return 'js'; // JSONP callback(…
  if (/^(function\b|const\b|let\b|var\b|class\b|async\b|document\.|window\.|module\.exports|import\b|export\b)/.test(head)) return 'js';
  if (/^@(charset|import|media|supports|font-face|keyframes|namespace)\b/i.test(head)) return 'css';
  return null;
}

function sniffType(content) {
  if (content instanceof Uint8Array || content instanceof ArrayBuffer) return sniffBinaryType(content);
  if (typeof content === 'string') return sniffTextType(content);
  return null;
}

async function sniffOne(res) {
  res._sniffing = true;
  try {
    const content = await getContent(res);
    if (!content) return;
    const detected = sniffType(content);
    if (!detected || detected === res.type) return;
    // "document" is only promoted to clearly distinct kinds — a .txt that
    // happens to start with "function" shouldn't become a JS file.
    if (res.type === 'document' && !['json', 'svg', 'wasm', 'font'].includes(detected)) return;
    // A query-string GET classified as API is demoted to its real category when
    // the bytes say it's a static asset; genuine JSON responses stay in API.
    if (res.type === 'api') {
      if (res._apiKind !== 'query' || detected === 'json') return;
      if (!['image', 'svg', 'js', 'css', 'wasm', 'font', 'document'].includes(detected)) return;
      apiCount = Math.max(0, apiCount - 1);
    }
    res.type = detected;
    if (detected === 'json' && res._beautified === undefined) res._beautified = true;
    scheduleRender();
    syncPanelCounts();
  } catch {
    /* ignore sniff errors */
  } finally {
    res._sniffed = true;
    res._sniffing = false;
  }
}

function sniffResources() {
  if (sniffRunning) return;
  const targets = state.resources.filter(
    (r) =>
      (r.type === 'other' || r.type === 'document' || (r.type === 'api' && r._apiKind === 'query')) &&
      !r._sniffed && !r._sniffing
  );
  if (!targets.length) return;
  sniffRunning = true;
  let i = 0;
  const worker = async () => {
    while (i < targets.length) {
      await sniffOne(targets[i++]);
    }
  };
  Promise.all(Array.from({ length: Math.min(SNIFF_CONCURRENCY, targets.length) }, worker)).then(() => {
    sniffRunning = false;
    render();
  });
}

let sniffTimer = null;
function scheduleSniff() {
  if (sniffTimer) return;
  sniffTimer = setTimeout(() => {
    sniffTimer = null;
    sniffResources();
  }, 700);
}

function fromHarEntry(entry) {
  const response = entry.response || {};
  const content = response.content || {};
  const request = entry.request || {};
  const url = request.url || '';

  const query = [];
  try {
    new URL(url).searchParams.forEach((value, name) => query.push({ name, value }));
  } catch { /* noop */ }

  const postData = request.postData
    ? {
        mimeType: request.postData.mimeType || '',
        text: request.postData.text || '',
        params: request.postData.params || [],
      }
    : null;

  return {
    url,
    method: request.method,
    type: classifyEntry(entry),
    mimeType: content.mimeType || '',
    size: content.size || response._transferSize || undefined,
    status: response.status,
    source: 'network',
    entry,
    time: entry.time,
    resourceType: entry._resourceType || (entry.response && entry.response._resourceType) || '',
    _apiKind: apiKindOf(entry),
    request: {
      query,
      postData,
      time: entry.time,
      status: response.status,
    },
  };
}

function scanDom() {
  const expr = `(function () {
    const out = [];
    const add = (url, tag, extra) => {
      if (!url) return;
      try { url = new URL(url, location.href).href; } catch (e) { return; }
      if (/^(https?:|data:|blob:|file:)/.test(url)) {
        const o = Object.assign({ url: url, tag: tag }, extra || {});
        out.push(o);
      }
    };
    document.querySelectorAll('img').forEach((el) => {
      const u = el.currentSrc || el.src;
      if (u) add(u, 'IMG', {
        alt: el.alt || '',
        title: el.title || '',
        width: el.naturalWidth || undefined,
        height: el.naturalHeight || undefined,
      });
    });
    document.querySelectorAll('img[srcset], source[srcset]').forEach((el) => {
      (el.srcset || '').split(',').forEach((part) => {
        const u = part.trim().split(/\\s+/)[0];
        if (u) add(u, el.tagName === 'IMG' ? 'IMG' : 'SOURCE', {
          alt: el.alt || '',
          title: el.title || '',
          width: el.naturalWidth || undefined,
          height: el.naturalHeight || undefined,
        });
      });
    });
    document.querySelectorAll('video').forEach((el) => {
      const s = el.querySelector('source');
      const u = el.currentSrc || (s && s.src) || '';
      if (u) add(u, 'VIDEO', { title: el.title || '' });
    });
    document.querySelectorAll('video source').forEach((el) => add(el.src, 'VIDEO'));
    document.querySelectorAll('audio').forEach((el) => {
      const s = el.querySelector('source');
      const u = el.currentSrc || (s && s.src) || '';
      if (u) add(u, 'AUDIO', { title: el.title || '' });
    });
    document.querySelectorAll('audio source').forEach((el) => add(el.src, 'AUDIO'));
    document.querySelectorAll('script[src]').forEach((el) => add(el.src, 'SCRIPT'));
    document.querySelectorAll('link[rel~="stylesheet"]').forEach((el) => add(el.href, 'STYLESHEET'));
    document.querySelectorAll('link[rel~="icon"]').forEach((el) => add(el.href, 'ICON'));
    document.querySelectorAll('iframe[src]').forEach((el) => add(el.src, 'IFRAME'));
    document.querySelectorAll('object[data]').forEach((el) => add(el.data, 'OBJECT'));
    document.querySelectorAll('embed[src]').forEach((el) => add(el.src, 'EMBED'));
    document.querySelectorAll('track[src]').forEach((el) => add(el.src, 'TRACK'));
    document.querySelectorAll('meta[property^="og:"][content], meta[property^="twitter:"][content], meta[name^="twitter:"][content]').forEach((el) => {
      const c = el.content || '';
      if (c && /^(https?:)?\\/\\//.test(c)) add(c, 'META');
    });
    return out;
  })()`;

  chrome.devtools.inspectedWindow.eval(expr, {}, (result, info) => {
    if (info && info.isException) {
      setStatusMessage('DOM scan failed: ' + (info.value || 'unknown error'));
      return;
    }
    let added = 0;
    (result || []).forEach((r) => {
      const res = addResource({
        url: r.url,
        source: 'dom',
        tag: r.tag,
        title: r.title,
        alt: r.alt,
        width: r.width,
        height: r.height,
      });
      if (res && res.source === 'dom') added++;
    });
    render();
    syncPanelCounts();
    toast(`Page scan complete: ${added} new resources`, 'success');
  });
}

/* ============================================================
 * 3b. CSS resource discovery (url() references inside stylesheets)
 * ============================================================ */

const CSS_URL_RE = /url\(\s*(?:'([^']*)'|"([^"]*)"|([^)'"]+))\s*\)/g;
// @import rules appear in two flavors — with url(...) and with a bare string —
// e.g. @import url("theme.css");  /  @import "fonts/roboto.css";
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*(?:'([^']*)'|"([^"]*)"|([^)'"]+))\s*\)|'([^']*)'|"([^"]*)")\s*[^;]*;/g;

async function scanCssResources() {
  let added = 0;
  // Chain through @imports: a stylesheet pulled in by another stylesheet is
  // added to the list mid-scan, so keep scanning until nothing new appears.
  for (let pass = 0; pass < 5; pass++) {
    const cssList = state.resources.filter((r) => r.type === 'css' && !r._cssScanned);
    if (!cssList.length) break;
    for (const css of cssList) {
      css._cssScanned = true;
      const content = await getContent(css).catch(() => null);
      if (content === null || content === undefined || content === '') continue;
      const text = contentToText(content);
      const refs = [];

      CSS_URL_RE.lastIndex = 0;
      let m;
      while ((m = CSS_URL_RE.exec(text)) !== null) {
        const ref = (m[1] || m[2] || m[3] || '').trim();
        if (ref && !ref.startsWith('#') && !ref.startsWith('data:')) refs.push(ref);
      }

      CSS_IMPORT_RE.lastIndex = 0;
      while ((m = CSS_IMPORT_RE.exec(text)) !== null) {
        const ref = (m[1] || m[2] || m[3] || m[4] || m[5] || '').trim();
        if (ref && !ref.startsWith('#') && !ref.startsWith('data:')) refs.push(ref);
      }

      for (const ref of refs) {
        let abs;
        try {
          abs = new URL(ref, css.url).href;
        } catch {
          continue;
        }
        if (!/^(https?:|blob:|data:)/.test(abs)) continue;
        if (addResource({ url: abs, source: 'css', tag: 'CSS-URL' })) added++;
      }
    }
  }
  if (added) {
    setStatusMessage(`Found ${added} resource(s) referenced from CSS`);
    render();
    syncPanelCounts();
  }
}

/* ============================================================
 * 4. Filtering & search
 * ============================================================ */

// Turn a search string into a matcher. If the query looks like "/pattern/i"
// it's compiled as a regular expression; otherwise it's a case-insensitive
// substring match.
function compileSearch(raw) {
  const m = raw.match(/^\/(.*)\/([gimsuy]*)$/);
  if (m) {
    try {
      const flags = m[2].includes('i') ? 'i' : '';
      const re = new RegExp(m[1], flags);
      return (s) => re.test(s);
    } catch {
      /* invalid regex — fall through to literal search */
    }
  }
  const lower = raw.toLowerCase();
  return (s) => s.toLowerCase().includes(lower);
}

function isRegexSearch() {
  return /^\/.*\/[gimsuy]*$/.test(state.search.trim());
}

function highlightTerm() {
  return isRegexSearch() ? '' : state.search.trim().toLowerCase();
}

function matchesSearch(res, matcher) {
  const hay = [
    res.filename,
    res.url,
    res.mimeType,
    res.tag || '',
    res.title || '',
    res.alt || '',
    TYPES[res.type].label,
  ].join(' ');
  if (matcher(hay)) return true;
  const content = state.contentIndex.get(res.url);
  return !!content && matcher(content);
}

const CONTENT_INDEX_CAP = 400000;
let contentScanRun = null;

// Fetch file bodies for text-like resources (debounced from the search box)
// and index their content so searches can match inside files, not only names.
async function scanContentForSearch() {
  if (contentScanRun) return contentScanRun;
  const targets = state.resources.filter(
    (r) => isTextType(r) && !state.contentIndex.has(r.url)
  );
  if (!targets.length) {
    state.searching = false;
    return null;
  }
  state.searching = true;
  setStatusMessage('Searching file contents…');
  let i = 0;
  const worker = async () => {
    while (i < targets.length) {
      const r = targets[i++];
      try {
        const content = await getContent(r);
        if (content !== null && content !== undefined && content !== '') {
          const t = contentToText(content).toLowerCase().slice(0, CONTENT_INDEX_CAP);
          state.contentIndex.set(r.url, t.toLowerCase().slice(0, CONTENT_INDEX_CAP));
        } else {
          state.contentIndex.set(r.url, '');
        }
      } catch {
        state.contentIndex.set(r.url, '');
      }
    }
  };
  const run = Promise.all(Array.from({ length: 4 }, worker)).then(() => {
    state.searching = false;
    contentScanRun = null;
    setStatusMessage('');
  });
  contentScanRun = run;
  return run;
}

function hasActiveFilters() {
  const f = state.filters;
  return !!(
    f.minSize || f.maxSize || f.minWidth || f.minHeight ||
    f.sortBy !== 'name' || f.sortDir !== 'asc' ||
    f.method || f.reqType
  );
}

function filteredResources() {
  const raw = state.search.trim();
  const matcher = raw ? compileSearch(raw) : null;
  let list = state.resources;
  if (state.activeTab !== 'all') list = list.filter((r) => r.type === state.activeTab);
  if (matcher) list = list.filter((r) => matchesSearch(r, matcher));

  // Category filter bar
  const f = state.filters;
  const minSize = parseFloat(f.minSize);
  const maxSize = parseFloat(f.maxSize);
  if (minSize) list = list.filter((r) => (r.size || 0) >= minSize * 1024);
  if (maxSize) list = list.filter((r) => (r.size || 0) <= maxSize * 1024);
  const minW = parseFloat(f.minWidth);
  const minH = parseFloat(f.minHeight);
  // Resources without a known size are kept until they can be measured.
  if (minW) list = list.filter((r) => !r.width || r.width >= minW);
  if (minH) list = list.filter((r) => !r.height || r.height >= minH);
  if (f.method) {
    const method = f.method.toUpperCase();
    list = list.filter((r) => (r.method || 'GET').toUpperCase() === method);
  }
  if (f.reqType) {
    list = list.filter((r) => (r.resourceType || '').toLowerCase() === f.reqType.toLowerCase());
  }

  const dir = f.sortDir === 'desc' ? -1 : 1;
  list = [...list].sort((a, b) => {
    let va;
    let vb;
    if (f.sortBy === 'size') {
      va = a.size || 0;
      vb = b.size || 0;
    } else if (f.sortBy === 'type') {
      va = a.type;
      vb = b.type;
    } else if (f.sortBy === 'time') {
      va = a.time || 0;
      vb = b.time || 0;
    } else {
      va = a.filename.toLowerCase();
      vb = b.filename.toLowerCase();
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
  return list;
}

/* ============================================================
 * 5. Rendering
 * ============================================================ */

/* ============================================================
 * 5b. Text & table capture (live page content)
 *
 * The "Text" category is not a resource list: it captures the live page's
 * headings, paragraphs, custom-selector matches and tables. Tables keep a
 * bounded snapshot history so a SPA that re-renders the same table every few
 * seconds can be exported without losing any intermediate state. Capture only
 * runs while the Text tab is open, polling the inspected page ~every 1.5s.
 * ============================================================ */

let textPollTimer = null;
let textIdCounter = 0;
let textPolling = false;

function nextTextId() {
  return 'tx' + (++textIdCounter);
}

function evalText(expr) {
  return new Promise((resolve) => {
    try {
      chrome.devtools.inspectedWindow.eval(expr, {}, (result, info) => {
        if (info && info.isException) resolve(null);
        else resolve(result);
      });
    } catch {
      resolve(null);
    }
  });
}

function textMetaExpr(cssSel) {
  // Walks the live page in DOM order and returns a flat, ordered list of
  // "blocks". Every element that carries direct text is captured with its tag
  // name (div, span, a, button, h1..h6, p, li, …) so the user can filter by
  // whatever element type the page actually contains. Nested duplicates are
  // skipped: when a parent already holds text, its children are rejected.
  return '(function () {' +
    'const out = [];' +
    'function hasDirectText(el) {' +
    '  for (let i = 0; i < el.childNodes.length; i++) {' +
    "    if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent.trim()) return true;" +
    '  }' +
    '  return false;' +
    '}' +
    'function sigFor(rows) {' +
    "  return JSON.stringify(rows[0] || []) + '|' + Math.max.apply(null, rows.map(function (r) { return r.length; }).concat(0));" +
    '}' +
    'function cellsOf(tr) {' +
    '  const cells = [];' +
    '  tr.querySelectorAll("th, td, [role=cell], [role=columnheader], [role=rowheader]").forEach(function (td) {' +
    "    let t = (td.innerText || '').trim();" +
    "    if (t.length > 300) t = t.slice(0, 300) + '…';" +
    '    cells.push(t);' +
    '  });' +
    '  return cells;' +
    '}' +
    'function capture(el) {' +
    '  const tag = el.tagName;' +
    '  if (/^H[1-6]$/.test(tag)) {' +
    "    const t = (el.innerText || el.textContent || '').trim();" +
    '    if (t) out.push({ kind: tag.toLowerCase(), text: t.slice(0, 1000) });' +
    '  } else if (tag === "TABLE" || (el.getAttribute && el.getAttribute("role") === "table")) {' +
    '    const trs = el.querySelectorAll("tr, [role=row]");' +
    '    const preview = [];' +
    '    for (let j = 0; j < Math.min(trs.length, 3); j++) {' +
    '      const c = cellsOf(trs[j]);' +
    '      if (c.length) preview.push(c);' +
    '    }' +
    '    if (preview.length) out.push({ kind: "table", rowCount: trs.length, preview: preview, sig: sigFor(preview) });' +
    '  } else {' +
    "    const t = (el.innerText || el.textContent || '').trim();" +
    '    if (t) out.push({ kind: tag.toLowerCase(), text: t.slice(0, 3000) });' +
    '  }' +
    '}' +
    'const F = NodeFilter;' +
    'const walker = document.createTreeWalker(document.body, F.SHOW_ELEMENT, {' +
    '  acceptNode: function (el) {' +
    '    let p = el.parentElement;' +
    '    while (p) {' +
    '      if (p.tagName === "TABLE" || (p.getAttribute && p.getAttribute("role") === "table")) return F.FILTER_REJECT;' +
    '      if (hasDirectText(p)) return F.FILTER_REJECT;' +
    '      p = p.parentElement;' +
    '    }' +
    '    if (el.tagName === "TABLE" || (el.getAttribute && el.getAttribute("role") === "table")) return F.FILTER_ACCEPT;' +
    '    if (hasDirectText(el)) return F.FILTER_ACCEPT;' +
    '    return F.FILTER_SKIP;' +
    '  }' +
    '});' +
    'let node;' +
    'while ((node = walker.nextNode())) capture(node);' +
    'const cssSel = ' + JSON.stringify(cssSel) + ';' +
    'if (cssSel) {' +
    '  try {' +
    '    document.querySelectorAll(cssSel).forEach(function (el) {' +
    "      const t = (el.innerText || el.textContent || '').trim();" +
    '      if (t) out.push({ kind: "css", selector: cssSel, text: t.slice(0, 3000) });' +
    '    });' +
    '  } catch (e) {}' +
    '}' +
    'return out;' +
    '})()';
}

function tableFullExpr(sig) {
  // Locates the current page table whose header signature matches `sig` and
  // returns every row (up to 2000). Used only when a table's content changed.
  return '(function () {' +
    'const tables = document.querySelectorAll("table, [role=table]");' +
    'let target = null;' +
    'function sigFor(rows) {' +
    "  return JSON.stringify(rows[0] || []) + '|' + Math.max.apply(null, rows.map(function (r) { return r.length; }).concat(0));" +
    '}' +
    'tables.forEach(function (el) {' +
    '  if (target) return;' +
    '  const trs = el.querySelectorAll("tr, [role=row]");' +
    '  const preview = [];' +
    '  for (let j = 0; j < Math.min(trs.length, 3); j++) {' +
    '    const cells = [];' +
    '    trs[j].querySelectorAll("th, td, [role=cell], [role=columnheader], [role=rowheader]").forEach(function (td) {' +
    "      cells.push((td.innerText || '').trim());" +
    '    });' +
    '    if (cells.length) preview.push(cells);' +
    '  }' +
    "  if (preview.length && sigFor(preview) === " + JSON.stringify(sig) + ') target = el;' +
    '});' +
    'if (!target) return null;' +
    'const rows = [];' +
    'const trs = target.querySelectorAll("tr, [role=row]");' +
    'for (let j = 0; j < Math.min(trs.length, 2000); j++) {' +
    '  const cells = [];' +
    '  trs[j].querySelectorAll("th, td, [role=cell], [role=columnheader], [role=rowheader]").forEach(function (td) {' +
    "    let t = (td.innerText || '').trim();" +
    "    if (t.length > 300) t = t.slice(0, 300) + '…';" +
    '    cells.push(t);' +
    '  });' +
    '  if (cells.length) rows.push(cells);' +
    '}' +
    'return rows;' +
    '})()';
}

async function pollTextOnce(silent) {
  if (textPolling) return;
  textPolling = true;
  try {
    const sel = state.text.filters.css.trim();
    const blocks = await evalText(textMetaExpr(sel));
    if (!blocks || !blocks.length) return;
    const now = Date.now();

    // Preserve the user's export selection across poll cycles by content key.
    const selKeys = new Set();
    for (const b of state.text.blocks) if (state.text.sel.has(b.id)) selKeys.add(b.key);

    const newBlocks = [];
    for (const b of blocks) {
      if (b.kind === 'table') {
        const key = 't\u0000' + b.sig;
        const hash = b.rowCount + '|' + JSON.stringify(b.preview);
        let hist = state.text.tables.get(b.sig);
        if (!hist) {
          hist = { snapshots: [], expanded: false };
          state.text.tables.set(b.sig, hist);
        }
        const last = hist.snapshots[hist.snapshots.length - 1];
        if (!last || last.hash !== hash) {
          const rows = await evalText(tableFullExpr(b.sig));
          if (rows) {
            hist.snapshots.push({ ts: now, hash, rows });
            if (hist.snapshots.length > 20) hist.snapshots.shift();
          }
        }
        const snap = hist.snapshots[hist.snapshots.length - 1];
        const id = nextTextId();
        if (selKeys.has(key)) state.text.sel.add(id);
        newBlocks.push({
          id, key, kind: 'table', sig: b.sig,
          rowCount: b.rowCount,
          rows: snap ? snap.rows : [],
          hist,
          firstSeen: hist.snapshots.length ? hist.snapshots[0].ts : now,
          ts: now,
        });
      } else {
        const key = (b.kind === 'css' ? 'c\u0000' + b.selector + '\u0000' : b.kind + '\u0000') + b.text;
        const nb = { kind: b.kind, text: b.text };
        if (b.kind === 'css') nb.selector = b.selector;
        const id = nextTextId();
        if (selKeys.has(key)) state.text.sel.add(id);
        newBlocks.push({ id, key, ts: now, ...nb });
      }
    }

    // Drop stale selection ids (blocks regenerated every poll).
    const newIds = new Set(newBlocks.map((b) => b.id));
    for (const id of [...state.text.sel]) if (!newIds.has(id)) state.text.sel.delete(id);

    // Skip re-rendering when the page content is unchanged, so the stream is
    // not rebuilt every 1.5s for idle pages.
    const sig = newBlocks
      .map((b) => b.key + (b.kind === 'table' ? '#' + b.rowCount + '|' + JSON.stringify(b.rows.slice(0, 3)) : ''))
      .join('\u0001');
    state.text.blocks = newBlocks;

    // Bound the table-history map so long sessions can't grow without limit.
    if (state.text.tables.size > 300) {
      const keys = [...state.text.tables.keys()];
      for (const k of keys.slice(0, state.text.tables.size - 300)) state.text.tables.delete(k);
    }

    if (sig !== state.text.lastSig) {
      state.text.lastSig = sig;
      // In background mode we only refresh the badge counts, never the panel
      // layout, so a category that is not currently open stays cheap.
      if (silent) renderTabs();
      else render();
    }
  } finally {
    textPolling = false;
  }
}

function ensureTextPoll() {
  if (textPollTimer || textPolling) return;
  const tick = () => {
    textPollTimer = null;
    if (state.activeTab !== 'text') return;
    pollTextOnce()
      .catch(() => { /* page context may be unavailable */ })
      .then(() => {
        if (state.activeTab === 'text' && state.text.live) {
          textPollTimer = setTimeout(tick, 1500);
        }
      });
  };
  tick();
}

function stopTextPoll() {
  if (textPollTimer) {
    clearTimeout(textPollTimer);
    textPollTimer = null;
  }
}

// A slower background poll that runs regardless of the active category so the
// Text tab badge shows a real count before the tab is even opened. It updates
// only the tab counts (silent mode) and never touches the current layout.
let bgTextTimer = null;

function ensureBgTextPoll() {
  if (bgTextTimer || textPolling) return;
  const tick = () => {
    bgTextTimer = null;
    if (state.activeTab === 'text' || !state.text.live) return;
    pollTextOnce(true)
      .catch(() => { /* page context may be unavailable */ })
      .then(() => {
        if (state.activeTab !== 'text' && state.text.live) {
          bgTextTimer = setTimeout(tick, 4000);
        }
      });
  };
  tick();
}

function stopBgTextPoll() {
  if (bgTextTimer) {
    clearTimeout(bgTextTimer);
    bgTextTimer = null;
  }
}

function filteredTextBlocks() {
  const f = state.text.filters;
  const q = f.query.trim().toLowerCase();
  return state.text.blocks.filter((b) => {
    if (f.kind === 'heading') {
      if (!/^h[1-6]$/.test(b.kind)) return false;
      if (f.level !== 'all' && b.kind !== f.level) return false;
    } else if (f.kind !== 'all' && b.kind !== f.kind) {
      return false;
    }
    if (q) {
      const hay = (b.kind === 'table'
        ? b.rows.map((r) => r.join(' ')).join(' ')
        : b.text
      ).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + 's ago';
  const m = Math.round(s / 60);
  if (m < 60) return m + 'm ago';
  return new Date(ts).toLocaleTimeString();
}

// Keep the "Show" dropdown in sync with the captured blocks: static options
// for the built-in groups, plus one option per element type actually found on
// the page (div, span, a, button, section, …) so users can filter by whatever
// the page really contains.
function syncTextKindOptions() {
  const kindSel = document.getElementById('tf-kind');
  if (!kindSel) return;
  const present = new Set();
  for (const b of state.text.blocks) {
    if (b.kind === 'table' || b.kind === 'css' || /^h[1-6]$/.test(b.kind)) continue;
    present.add(b.kind);
  }
  const special = new Set(['all', 'heading', 'paragraph', 'list', 'table', 'css']);
  const existing = new Set([...kindSel.options].map((o) => o.value));
  for (const k of [...present].sort()) {
    if (!existing.has(k) && !special.has(k)) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k.toUpperCase();
      kindSel.appendChild(opt);
    }
  }
}

function renderTextView() {
  const liveBtn = document.getElementById('tf-live');
  if (liveBtn) {
    liveBtn.classList.toggle('btn--primary', state.text.live);
    liveBtn.textContent = state.text.live ? 'Live on' : 'Live off';
  }
  const kindSel = document.getElementById('tf-kind');
  if (kindSel && kindSel.value !== state.text.filters.kind) kindSel.value = state.text.filters.kind;
  const levelSel = document.getElementById('tf-level');
  if (levelSel) {
    levelSel.hidden = state.text.filters.kind !== 'all' && state.text.filters.kind !== 'heading';
    if (levelSel.value !== state.text.filters.level) levelSel.value = state.text.filters.level;
  }
  syncTextKindOptions();
  const stream = document.getElementById('text-stream');
  if (!stream) return;
  stream.innerHTML = '';
  const blocks = filteredTextBlocks();

  if (!state.text.blocks.length) {
    const empty = document.createElement('div');
    empty.className = 'text-empty';
    empty.innerHTML =
      '<svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5V3h14v2M12 3v18M9 21h6"/></svg>' +
      '<p><b>Nothing captured yet.</b> Live capture is running — the whole page will appear here as readable text. Press <em>Scan now</em> or wait a moment for the first snapshot.</p>';
    stream.appendChild(empty);
    return;
  }
  if (!blocks.length) {
    const empty = document.createElement('div');
    empty.className = 'text-empty';
    empty.innerHTML = '<p>Nothing matches the current filters.</p>';
    stream.appendChild(empty);
    return;
  }

  const summary = document.createElement('div');
  summary.className = 'text-summary';
  const kinds = [
    ['heading', 'headings'],
    ['p', 'paragraphs'],
    ['li', 'list items'],
    ['table', 'tables'],
    ['css', 'selector matches'],
  ];
  for (const [kind, label] of kinds) {
    const n = kind === 'heading'
      ? state.text.blocks.filter((b) => /^h[1-6]$/.test(b.kind)).length
      : state.text.blocks.filter((b) => b.kind === kind).length;
    if (!n && state.text.filters.kind !== kind) continue;
    const chip = document.createElement('span');
    chip.className = 'text-summary__chip' + (state.text.filters.kind === kind ? ' text-summary__chip--active' : '');
    chip.textContent = n + ' ' + label;
    summary.appendChild(chip);
  }
  stream.appendChild(summary);

  for (const b of blocks) stream.appendChild(renderTextBlock(b));
}

function blockCheckbox(b, container) {
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'txt-block__check';
  check.checked = state.text.sel.has(b.id);
  check.title = 'Include in exports';
  check.addEventListener('click', (e) => e.stopPropagation());
  check.addEventListener('change', () => {
    if (check.checked) state.text.sel.add(b.id);
    else state.text.sel.delete(b.id);
    container.classList.toggle('txt-block--sel', check.checked);
  });
  return check;
}

function renderTextBlock(b) {
  const el = document.createElement('div');
  const isHeading = /^h[1-6]$/.test(b.kind);
  const isTable = b.kind === 'table';
  el.className = 'txt-block' +
    (isTable ? ' txt-block--table' : '') +
    (isHeading ? ' txt-block--heading txt-block--h' + b.kind[1] : '') +
    (b.kind === 'p' ? ' txt-block--paragraph' : '') +
    (b.kind === 'li' ? ' txt-block--list' : '') +
    (b.kind === 'css' ? ' txt-block--css' : '') +
    (state.text.sel.has(b.id) ? ' txt-block--sel' : '');
  el.dataset.id = b.id;

  if (isTable) {
    renderTextTable(el, b);
  } else {
    const check = blockCheckbox(b, el);
    const tag = document.createElement('span');
    tag.className = 'txt-block__tag';
    if (isHeading) tag.textContent = b.kind.toUpperCase();
    else if (b.kind === 'p') tag.textContent = 'P';
    else if (b.kind === 'li') tag.textContent = 'LI';
    else if (b.kind === 'css') tag.textContent = 'CSS';
    else tag.textContent = b.kind.toUpperCase();
    const text = document.createElement('span');
    text.className = 'txt-block__text';
    text.textContent = b.text;
    el.appendChild(check);
    el.appendChild(tag);
    el.appendChild(text);
  }
  return el;
}

function renderTextTable(el, b) {
  const head = document.createElement('div');
  head.className = 'txt-table__head';
  head.appendChild(blockCheckbox(b, el));

  const tag = document.createElement('span');
  tag.className = 'txt-block__tag txt-block__tag--table';
  tag.textContent = 'TBL';
  head.appendChild(tag);

  const title = document.createElement('span');
  title.className = 'txt-table__title';
  title.textContent = 'Table — ' + b.rowCount + ' row' + (b.rowCount === 1 ? '' : 's');
  head.appendChild(title);

  // History summary, right next to the title (not pushed to the far edge),
  // so it can never be missed. Shows what an export will actually contain.
  const unique = dedupeRows(b.hist.snapshots.flatMap((s) => s.rows)).length;
  const meta = document.createElement('span');
  meta.className = 'txt-table__meta';
  const parts = [
    b.hist.snapshots.length + ' snapshot' + (b.hist.snapshots.length === 1 ? '' : 's'),
    unique + ' unique row' + (unique === 1 ? '' : 's'),
    'updated ' + timeAgo(b.ts),
  ];
  if (b.hist.snapshots.length > 1) parts.push('since ' + timeAgo(b.firstSeen));
  meta.textContent = parts.join(' · ');
  head.appendChild(meta);

  if (b.hist.snapshots.length > 1) {
    const histBtn = document.createElement('button');
    histBtn.className = 'btn btn--sm txt-table__history';
    histBtn.textContent = b.hist.expanded ? 'Hide history' : 'History (' + (b.hist.snapshots.length - 1) + ')';
    histBtn.title = 'Browse earlier snapshots of this table';
    histBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      b.hist.expanded = !b.hist.expanded;
      renderTextView();
    });
    head.appendChild(histBtn);
  }
  el.appendChild(head);

  const wrap = document.createElement('div');
  wrap.className = 'txt-table__wrap';
  const tbl = document.createElement('table');
  tbl.className = 'txt-table';
  if (b.rows.length) {
    const maxCols = Math.max(...b.rows.map((r) => r.length));
    for (const row of b.rows) {
      const tr = document.createElement('tr');
      for (let c = 0; c < maxCols; c++) {
        const td = document.createElement('td');
        td.textContent = row[c] || '';
        tr.appendChild(td);
      }
      tbl.appendChild(tr);
    }
  } else {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.textContent = 'No rows captured yet.';
    tr.appendChild(td);
    tbl.appendChild(tr);
  }
  wrap.appendChild(tbl);
  el.appendChild(wrap);

  if (b.hist.expanded) {
    for (let s = b.hist.snapshots.length - 2; s >= 0; s--) {
      const snap = b.hist.snapshots[s];
      const st = document.createElement('div');
      st.className = 'txt-table__snap-title';
      st.textContent = 'Snapshot ' + (s + 1) + ' — ' + timeAgo(snap.ts) + ' (' + snap.rows.length + ' rows)';
      el.appendChild(st);
      if (snap.rows.length) {
        const sw = document.createElement('div');
        sw.className = 'txt-table__wrap';
        const stbl = document.createElement('table');
        stbl.className = 'txt-table txt-table--old';
        const maxCols = Math.max(...snap.rows.map((r) => r.length));
        for (const row of snap.rows) {
          const tr = document.createElement('tr');
          for (let c = 0; c < maxCols; c++) {
            const td = document.createElement('td');
            td.textContent = row[c] || '';
            tr.appendChild(td);
          }
          stbl.appendChild(tr);
        }
        sw.appendChild(stbl);
        el.appendChild(sw);
      }
    }
  }
}

/* ---------- Text exports ---------- */

function dedupeRows(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const k = JSON.stringify(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function csvEscape(v) {
  const s = String(v === null || v === undefined ? '' : v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Selected blocks win; when nothing is selected, everything visible after the
// filter bar is exported.
function exportTextSelection() {
  const sel = state.text.sel;
  let blocks = filteredTextBlocks();
  if (sel.size) blocks = blocks.filter((b) => sel.has(b.id));
  return blocks;
}

// The tables to export: visible (and selected, if any) tables with their full
// snapshot history flattened and deduplicated row-by-row.
function exportTableItems() {
  const sel = state.text.sel;
  let blocks = filteredTextBlocks().filter((b) => b.kind === 'table');
  if (sel.size) blocks = blocks.filter((b) => sel.has(b.id));
  const seen = new Set();
  const out = [];
  for (const b of blocks) {
    if (seen.has(b.sig)) continue;
    seen.add(b.sig);
    const hist = state.text.tables.get(b.sig);
    if (!hist) continue;
    const rows = dedupeRows(hist.snapshots.flatMap((s) => s.rows));
    if (rows.length) out.push({ rows });
  }
  return out;
}

function exportTextMarkdown() {
  const blocks = exportTextSelection().filter((b) => b.kind !== 'table');
  if (!blocks.length) {
    toast('Nothing to export');
    return;
  }
  const lines = [];
  for (const b of blocks) {
    if (/^h[1-6]$/.test(b.kind)) lines.push('#'.repeat(+b.kind[1]) + ' ' + b.text);
    else if (b.kind === 'li') lines.push('- ' + b.text);
    else if (b.kind === 'css') lines.push('[' + b.selector + '] ' + b.text);
    else lines.push(b.text);
  }
  const blob = new Blob([lines.join('\n\n')], { type: 'text/markdown' });
  saveBlob(blob, 'text/page-content.md');
  toast('Exported ' + lines.length + ' text block' + (lines.length === 1 ? '' : 's'));
}

async function exportTablesAs(format) {
  const tables = exportTableItems();
  if (!tables.length) {
    toast('No table data captured');
    return;
  }
  const entries = [];
  for (let i = 0; i < tables.length; i++) {
    const name = 'Table ' + (i + 1);
    if (format === 'csv') {
      entries.push({ name: 'text/table-' + (i + 1) + '.csv', data: tables[i].rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') });
    } else {
      let html = '<!doctype html>\n<meta charset="utf-8">\n<title>' + escapeHtml(name) + '</title>\n' +
        '<h2>' + escapeHtml(name) + '</h2>\n' +
        '<p>' + tables[i].rows.length + ' unique row' + (tables[i].rows.length === 1 ? '' : 's') + '</p>\n' +
        '<table border="1" cellpadding="5" cellspacing="0">\n' +
        tables[i].rows.map((r) => '<tr>' + r.map((c) => '<td>' + escapeHtml(c) + '</td>').join('') + '</tr>').join('\n') +
        '\n</table>\n';
      entries.push({ name: 'text/table-' + (i + 1) + '.html', data: html });
    }
  }
  const zip = await SourceDownloadZip.createZip(entries);
  saveBlob(zip, format === 'csv' ? 'text/tables.csv.zip' : 'text/tables.html.zip');
  toast('Exported ' + entries.length + ' table' + (entries.length === 1 ? '' : 's') + ' as ' + format.toUpperCase());
}

async function exportTextXlsx() {
  const tables = exportTableItems();
  if (!tables.length) {
    toast('No table data captured');
    return;
  }
  const sheets = tables.map((t, i) => ({ name: ('Table ' + (i + 1)).slice(0, 31), rows: t.rows }));
  const blob = await SourceDownloadXlsx.build(sheets);
  saveBlob(blob, 'text/tables.xlsx');
  toast('Exported ' + sheets.length + ' sheet' + (sheets.length === 1 ? '' : 's') + ' as XLSX');
}

function render() {
  renderTabs();
  const isText = state.activeTab === 'text';
  document.body.classList.toggle('text-mode', isText);
  const filterbar = document.getElementById('filterbar');
  const listEl = document.getElementById('list');
  const empty = document.getElementById('empty-state');
  const textView = document.getElementById('text-view');
  if (filterbar) filterbar.hidden = isText;
  if (listEl) listEl.hidden = isText;
  if (empty) empty.hidden = isText;
  if (textView) textView.hidden = !isText;
  const toolbarSearch = document.getElementById('toolbar-search');
  if (toolbarSearch) toolbarSearch.hidden = isText;
  for (const id of ['btn-download-selected', 'btn-download-view', 'btn-download-all', 'btn-download-selected-count', 'view-grid', 'view-list']) {
    const el = document.getElementById(id);
    if (el) el.hidden = isText;
  }
  if (isText) {
    stopTextPoll();
    stopBgTextPoll();
    renderTextView();
    ensureTextPoll();
  } else {
    stopTextPoll();
    renderList();
    renderFilterBar();
    renderStatus();
    ensureBgTextPoll();
  }
  for (const r of state.resources) r.isNew = false;
}

// Sync the filter bar controls with the current state, and only show the
// pixel-dimension inputs for categories where they make sense.
function renderFilterBar() {
  const f = state.filters;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el && el.value !== String(v)) el.value = String(v);
  };
  set('f-min-size', f.minSize);
  set('f-max-size', f.maxSize);
  set('f-min-width', f.minWidth);
  set('f-min-height', f.minHeight);
  const sort = document.getElementById('f-sort');
  if (sort && sort.value !== f.sortBy) sort.value = f.sortBy;
  const dirBtn = document.getElementById('f-sort-dir');
  if (dirBtn) dirBtn.textContent = f.sortDir === 'asc' ? '↑' : '↓';
  document.getElementById('f-dims').hidden = !['image', 'svg', 'video'].includes(state.activeTab);
  const isApi = state.activeTab === 'api';
  document.getElementById('f-method').hidden = !isApi;
  document.getElementById('f-type').hidden = !isApi;
  const setSel = (id, v) => {
    const el = document.getElementById(id);
    if (el && el.value !== v) el.value = v;
  };
  setSel('f-method', f.method);
  setSel('f-type', f.reqType);
}

// Lazily measure image/SVG dimensions from their captured bytes so the
// min-width / min-height filters can work for network resources too. Only
// triggered while those filters are in use, bounded by a small concurrency.
async function decodeImageSizes() {
  const targets = state.resources.filter(
    (r) =>
      (r.type === 'image' || r.type === 'svg') &&
      (r.width === undefined || r.height === undefined) &&
      !r._decoding
  );
  if (!targets.length || !window.createImageBitmap) return;
  const CONC = 3;
  let i = 0;
  const worker = async () => {
    while (i < targets.length) {
      const r = targets[i++];
      r._decoding = true;
      try {
        const content = await getContent(r);
        if (!content) continue;
        const blob = toBlob(content, r.mimeType || (r.type === 'svg' ? 'image/svg+xml' : undefined));
        const bmp = await createImageBitmap(blob);
        r.width = bmp.width;
        r.height = bmp.height;
        bmp.close();
      } catch {
        r.width = 0;
        r.height = 0;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, targets.length) }, worker));
  render();
  syncPanelCounts();
}

function scheduleRender() {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    render();
    syncPanelCounts();
  }, 100);
}

// The panel sees more resources than the content script (it also listens to
// live network requests), so when DevTools is open we push its own per-category
// counts to the background worker so the toolbar badge stays accurate.
function computePanelCounts() {
  const counts = { all: 0, api: 0, image: 0, svg: 0, video: 0, audio: 0, css: 0, js: 0, font: 0, document: 0, json: 0, wasm: 0, manifest: 0, other: 0 };
  for (const r of state.resources) {
    if (counts[r.type] !== undefined) counts[r.type]++;
  }
  counts.all = state.resources.length;
  return counts;
}

function syncPanelCounts() {
  if (syncPanelTimer) return;
  syncPanelTimer = setTimeout(() => {
    syncPanelTimer = null;
    try {
      chrome.runtime.sendMessage({
        type: 'panelCounts',
        tabId: chrome.devtools.inspectedWindow.tabId,
        counts: computePanelCounts(),
      });
    } catch {
      /* devtools context may be torn down */
    }
  }, 250);
}

function renderTabs() {
  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = '';
  const counts = {};
  for (const r of state.resources) counts[r.type] = (counts[r.type] || 0) + 1;
  for (const key of Object.keys(TYPES)) {
    const t = TYPES[key];
    const tab = document.createElement('button');
    tab.className = 'vtab' + (key === state.activeTab ? ' vtab--active' : '');
    tab.dataset.tab = key;
    tab.title = t.label;
    tab.innerHTML =
      '<span class="vtab__icon">' + (ICONS[key] || ICONS.other) + '</span>' +
      '<span class="vtab__label">' + t.label + '</span>' +
      '<span class="vtab__count">' + (key === 'all' ? state.resources.length : key === 'text' ? state.text.blocks.length : counts[key] || 0) + '</span>';
    tab.addEventListener('click', () => {
      state.activeTab = key;
      // A category switch must always start fresh: reset every resource filter
      // and the search box so a leftover filter (e.g. POST from the API tab)
      // can never silently empty another category.
      state.filters = { minSize: '', maxSize: '', minWidth: '', minHeight: '', sortBy: 'name', sortDir: 'asc', method: '', reqType: '' };
      state.search = '';
      const searchInput = document.getElementById('search-input');
      if (searchInput) searchInput.value = '';
      const searchClear = document.getElementById('search-clear');
      if (searchClear) searchClear.hidden = true;
      panelPrefs.activeTab = key;
      savePrefs();
      render();
    });
    tabsEl.appendChild(tab);
  }
}

function highlight(text, q) {
  if (!q) return document.createTextNode(text);
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return document.createTextNode(text);
  const frag = document.createDocumentFragment();
  frag.appendChild(document.createTextNode(text.slice(0, idx)));
  const mark = document.createElement('mark');
  mark.className = 'hl';
  mark.textContent = text.slice(idx, idx + q.length);
  frag.appendChild(mark);
  frag.appendChild(document.createTextNode(text.slice(idx + q.length)));
  return frag;
}

const METHOD_CHIP_CLASSES = {
  get: 'get', post: 'post', put: 'put', patch: 'patch',
  delete: 'delete', head: 'head', options: 'options',
};

function methodChip(res) {
  if (res.type !== 'api') return '';
  const m = (res.method || 'GET').toUpperCase();
  const cls = METHOD_CHIP_CLASSES[m.toLowerCase()] || 'other';
  return '<span class="method-chip method-chip--' + cls + '">' + m + '</span>';
}

function renderCard(res) {
  const card = document.createElement('div');
  card.className =
    'card' +
    (state.selected.has(res.id) ? ' card--selected' : '') +
    (state.current && state.current.id === res.id ? ' card--active' : '');
  card.dataset.id = res.id;
  if (res.isNew) card.classList.add('card--new');

  const thumb = document.createElement('div');
  thumb.className = 'card__thumb';
  if (res.type === 'image' && isDisplayableUrl(res.url)) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = res.url;
    img.alt = '';
    thumb.appendChild(img);
  } else {
    thumb.innerHTML = ICONS[res.type] || ICONS.other;
  }

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'card__check';
  check.checked = state.selected.has(res.id);
  check.title = 'Toggle selection for batch download';
  check.addEventListener('click', (e) => e.stopPropagation());
  check.addEventListener('change', () => toggleSelect(res.id, check.checked));

  const info = document.createElement('div');
  info.className = 'card__info';
  const name = document.createElement('div');
  name.className = 'card__name';
  name.title = res.filename;
  name.appendChild(highlight(res.filename, highlightTerm()));
  const meta = document.createElement('div');
  meta.className = 'card__meta';
  const parts = [];
  if (res.type === 'api') parts.push(methodChip(res));
  parts.push(TYPES[res.type].label);
  if (res.size) parts.push(formatBytes(res.size));
  const extra = res.alt || res.title;
  if (extra) parts.push('<span class="meta-alt">' + escapeHtml(extra).slice(0, 90) + '</span>');
  meta.innerHTML = parts.join(' <span class="sep">·</span> ');
  info.appendChild(name);
  info.appendChild(meta);

  const dl = document.createElement('button');
  dl.className = 'card__download';
  dl.title = 'Download file';
  dl.innerHTML = ICONS.download;
  dl.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadSingle(res);
  });

  if (state.failed.has(res.id)) {
    const warn = document.createElement('button');
    warn.className = 'card__warn';
    warn.title = 'Previous download failed — click to retry';
    warn.textContent = '!';
    warn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadSingle(res);
    });
    card.appendChild(warn);
  }

  card.addEventListener('click', () => openResource(res));
  card.addEventListener('contextmenu', (e) => openContextMenu(e, res));

  card.appendChild(check);
  card.appendChild(thumb);
  card.appendChild(info);
  card.appendChild(dl);
  return card;
}

function renderTile(res) {
  const tile = document.createElement('div');
  tile.className =
    'tile' +
    (state.selected.has(res.id) ? ' tile--selected' : '') +
    (state.current && state.current.id === res.id ? ' tile--active' : '');
  tile.dataset.id = res.id;
  tile.title = res.filename + (res.size ? ' · ' + formatBytes(res.size) : '');
  if (res.isNew) tile.classList.add('tile--new');

  if (res.type === 'image' && isDisplayableUrl(res.url)) {
    const img = document.createElement('img');
    img.className = 'tile__thumb';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = res.url;
    img.alt = '';
    tile.appendChild(img);
  } else {
    const iconWrap = document.createElement('div');
    iconWrap.className = 'tile__icon';
    iconWrap.innerHTML = ICONS[res.type] || ICONS.other;
    tile.appendChild(iconWrap);
  }

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'tile__check';
  check.checked = state.selected.has(res.id);
  check.title = 'Toggle selection for batch download';
  check.addEventListener('click', (e) => e.stopPropagation());
  check.addEventListener('change', () => toggleSelect(res.id, check.checked));
  tile.appendChild(check);

  const dl = document.createElement('button');
  dl.className = 'tile__dl';
  dl.title = 'Download file';
  dl.innerHTML = ICONS.download;
  dl.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadSingle(res);
  });
  tile.appendChild(dl);

  if (res.type === 'api') {
    const chip = document.createElement('span');
    chip.className = 'tile__method';
    chip.innerHTML = methodChip(res);
    tile.appendChild(chip);
  }

  if (state.failed.has(res.id)) {
    const warn = document.createElement('button');
    warn.className = 'tile__warn';
    warn.title = 'Previous download failed — click to retry';
    warn.textContent = '!';
    warn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadSingle(res);
    });
    tile.appendChild(warn);
  }

  const hint = document.createElement('div');
  hint.className = 'tile__hint';
  hint.textContent = res.filename + (res.size ? ' · ' + formatBytes(res.size) : '');
  tile.appendChild(hint);

  tile.addEventListener('click', () => openResource(res));
  tile.addEventListener('contextmenu', (e) => openContextMenu(e, res));
  return tile;
}

function renderList() {
  const listEl = document.getElementById('list');
  listEl.className = state.view === 'grid' ? 'list list--grid' : 'list list--list';
  listEl.innerHTML = '';
  const filtered = filteredResources();

  const empty = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-title');
  const emptySub = document.getElementById('empty-subtitle');
  if (filtered.length === 0) {
    empty.hidden = false;
    if (state.search.trim()) {
      emptyTitle.textContent = 'No matches for "' + state.search.trim() + '"';
      emptySub.textContent = 'Try a different search term, or switch to another category.';
    } else if (hasActiveFilters()) {
      emptyTitle.textContent = 'No resources match the current filters';
      emptySub.textContent = 'Loosen the size or dimension filters above, or press Clear.';
    } else {
      emptyTitle.textContent = 'No resources found';
      emptySub.textContent =
        'Reload the page while this panel is open to capture network requests, ' +
        'or click Refresh to scan the current DOM.';
    }
    return;
  }
  empty.hidden = true;

  const renderOne = state.view === 'grid' ? renderTile : renderCard;

  if (state.activeTab === 'all') {
    for (const key of Object.keys(TYPES)) {
      if (key === 'all') continue;
      const group = filtered.filter((r) => r.type === key);
      if (!group.length) continue;
      const header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML =
        '<span>' + TYPES[key].label + '</span>' +
        '<span class="group-header__line"></span>' +
        '<span class="group-header__count">' + group.length + '</span>';
      listEl.appendChild(header);
      for (const r of group) listEl.appendChild(renderOne(r));
    }
  } else {
    for (const r of filtered) listEl.appendChild(renderOne(r));
  }
}

function renderStatus() {
  const total = state.resources.length;
  document.getElementById('status-resources').textContent =
    total + ' resource' + (total === 1 ? '' : 's');

  const sel = state.selected.size;
  const selEl = document.getElementById('status-selected');
  selEl.hidden = sel === 0;
  if (sel) selEl.textContent = sel + ' selected';

  let size = 0;
  for (const r of state.resources) if (r.size) size += r.size;
  document.getElementById('status-size').textContent = size ? '≈ ' + formatBytes(size) : '';

  const badge = document.getElementById('btn-download-selected-count');
  badge.hidden = sel === 0;
  badge.textContent = sel;
  document.getElementById('btn-download-selected').disabled = state.busy || sel === 0;
  document.getElementById('btn-download-all').disabled = state.busy;

  // "Download View" becomes "Download Filtered (N)" while any category filter
  // (size / dimensions / sort) is active — it always downloads exactly what
  // is visible in the list.
  const btnView = document.getElementById('btn-download-view');
  const filteredCount = filteredResources().length;
  btnView.disabled = state.busy || filteredCount === 0;
  const label = btnView.querySelector('span');
  if (label) label.textContent = hasActiveFilters()
    ? ' Download Filtered (' + filteredCount + ')'
    : ' Download View';
}

/* ============================================================
 * 6. Selection
 * ============================================================ */

function toggleSelect(id, on) {
  if (on) state.selected.add(id);
  else state.selected.delete(id);
  try {
    const el = document.querySelector('[data-id="' + id + '"].card, [data-id="' + id + '"].tile');
    if (el) {
      el.classList.toggle('card--selected', on);
      el.classList.toggle('tile--selected', on);
      const cb = el.querySelector('.card__check, .tile__check');
      if (cb) cb.checked = on;
    }
  } catch {
    /* noop */
  }
  renderStatus();
}

/* ============================================================
 * 7. Inspector
 * ============================================================ */

/* ============================================================
 * 7b. Text content preview (pretty JSON + find-in-content)
 * ============================================================ */

let contentFind = { term: '', matches: [], index: -1 };

/* ---------- Syntax highlighting ---------- */

const SYNTAX = {
  js: {
    re: /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*")|('(?:[^'\\\n]|\\.)*')|(`(?:[^`\\]|\\.)*`)|(\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|class|new|extends|super|import|export|from|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|null|undefined|true|false|static|get|set|yield|void|delete)\b)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
    cls(m) {
      if (m[1] !== undefined || m[2] !== undefined) return 's-com';
      if (m[3] !== undefined || m[4] !== undefined || m[5] !== undefined) return 's-str';
      if (m[6] !== undefined) return 's-key';
      return 's-num';
    },
  },
  css: {
    re: /(\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*")|('(?:[^'\\\n]|\\.)*')|(#[0-9a-fA-F]{3,8}\b)|([-+]?\d*\.?\d+(?:[a-z%]+)?\b)|(@[\w-]+\b)|(\.[a-zA-Z_][\w-]*)|(\#[a-zA-Z_][\w-]*)|(url\([^)]*\))/g,
    cls(m) {
      if (m[1] !== undefined) return 's-com';
      if (m[2] !== undefined || m[3] !== undefined) return 's-str';
      if (m[4] !== undefined) return 's-hex';
      if (m[5] !== undefined) return 's-num';
      if (m[6] !== undefined) return 's-at';
      if (m[7] !== undefined) return 's-cls';
      if (m[8] !== undefined) return 's-id';
      return 's-url';
    },
  },
  json: {
    re: /("(?:[^"\\]|\\.)*")(\s*:)?|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|\b(true|false)\b|\b(null)\b/g,
    cls(m) {
      if (m[1] !== undefined) return m[2] !== undefined && m[2].trim() ? 's-key' : 's-str';
      if (m[3] !== undefined) return 's-num';
      if (m[4] !== undefined) return 's-bool';
      return 's-null';
    },
  },
  markup: {
    re: /(<!--[\s\S]*?-->)|("[^"]*")|('[^']*')|(<\/?[a-zA-Z][\w:.-]*)|(\/?>)/g,
    cls(m) {
      if (m[1] !== undefined) return 's-com';
      if (m[2] !== undefined || m[3] !== undefined) return 's-str';
      return 's-tag';
    },
  },
};

function languageFor(res) {
  if (res.type === 'js') return 'js';
  if (res.type === 'css') return 'css';
  if (res.type === 'json' || res.type === 'manifest') return 'json';
  if (res.type === 'svg') return 'markup';
  const ext = getExt(res.url);
  if (['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx'].includes(ext)) return 'js';
  if (ext === 'css') return 'css';
  if (['json', 'map'].includes(ext)) return 'json';
  if (['html', 'htm', 'xml', 'svg'].includes(ext)) return 'markup';
  return 'text';
}

function highlightCode(text, lang) {
  const rule = SYNTAX[lang];
  if (!rule) return escapeHtmlText(text);
  let html = '';
  let last = 0;
  for (const m of text.matchAll(rule.re)) {
    if (m.index > last) html += escapeHtmlText(text.slice(last, m.index));
    const cls = rule.cls(m);
    html += '<span class="' + cls + '">' + escapeHtmlText(m[0]) + '</span>';
    last = m.index + m[0].length;
  }
  html += escapeHtmlText(text.slice(last));
  return html;
}

function beautifyText(res, text) {
  const b = window.SourceDownloadBeautify;
  if (!b) return text;
  try {
    const type = res.type;
    if (type === 'json' || type === 'manifest' || isJsonType(res)) return b.json(text);
    if (type === 'css') return b.css(text);
    if (type === 'js') return b.js(text);
    if (type === 'svg' || type === 'xml' || type === 'document') return b.html(text);
  } catch {
    /* beautification failed — keep the original text */
  }
  return text;
}

function escapeHtmlText(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function findMatches(text, term) {
  const matches = [];
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  if (!t) return matches;
  let idx = 0;
  // Cap at 500 matches so the DOM never explodes.
  while (matches.length < 500 && (idx = lower.indexOf(t, idx)) !== -1) {
    matches.push([idx, t.length]);
    idx += t.length;
  }
  return matches;
}

function buildContentHtml(text, term, lang) {
  const matches = findMatches(text, term);
  const esc = escapeHtmlText;
  if (!matches.length) return highlightCode(text, lang);
  let html = '';
  let pos = 0;
  for (const [start, len] of matches) {
    if (start > pos) html += highlightCode(text.slice(pos, start), lang);
    html += '<mark class="hl" data-match>' + esc(text.slice(start, start + len)) + '</mark>';
    pos = start + len;
  }
  if (pos < text.length) html += highlightCode(text.slice(pos), lang);
  return html;
}

const MAX_CODE_ROWS = 20000;

function renderCodeRows(body, text, term, lang) {
  const lines = text.split('\n');
  const max = Math.min(lines.length, MAX_CODE_ROWS);
  body.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let i = 0; i < max; i++) {
    const row = document.createElement('div');
    row.className = 'code-row';
    const ln = document.createElement('span');
    ln.className = 'code-ln';
    ln.textContent = i + 1;
    const line = document.createElement('code');
    line.className = 'code-line';
    line.innerHTML = buildContentHtml(lines[i], term, lang);
    row.appendChild(ln);
    row.appendChild(line);
    frag.appendChild(row);
  }
  if (lines.length > max) {
    const row = document.createElement('div');
    row.className = 'code-row code-row--note';
    row.innerHTML =
      '<span class="code-ln"></span>' +
      '<code class="code-line">… ' + (lines.length - max) + ' more lines omitted</code>';
    frag.appendChild(row);
  }
  body.appendChild(frag);
}

function setupContentSearch(scroller, body, text, lang, opts) {
  const bar = document.createElement('div');
  bar.className = 'content-find';
  bar.innerHTML =
    '<input type="text" class="content-find__input" placeholder="Find in content…" spellcheck="false">' +
    '<span class="content-find__count">0/0</span>' +
    '<button class="content-find__btn" data-dir="-1" title="Previous match">▲</button>' +
    '<button class="content-find__btn" data-dir="1" title="Next match">▼</button>' +
    (opts
      ? '<button class="content-find__beautify" title="' + (opts.beautified ? 'Show original (unformatted) content' : 'Format / beautify this content') + '">' + (opts.beautified ? 'Raw' : 'Beautify') + '</button>'
      : '') +
    '<button class="content-find__close" title="Close">✕</button>';
  const input = bar.querySelector('input');
  const count = bar.querySelector('.content-find__count');

  const marksOf = () => body.querySelectorAll('mark[data-match]');

  const apply = () => {
    contentFind.term = input.value.trim();
    contentFind.matches = findMatches(text, contentFind.term);
    contentFind.index = contentFind.matches.length ? 0 : -1;
    renderCodeRows(body, text, contentFind.term, lang);
    count.textContent = contentFind.matches.length
      ? (contentFind.index + 1) + '/' + contentFind.matches.length
      : '0/0';
    const marks = marksOf();
    marks.forEach((m, i) => {
      m.classList.toggle('hl--active', i === contentFind.index);
    });
    if (contentFind.matches.length && contentFind.index !== -1 && marks.length) {
      marks[contentFind.index].scrollIntoView({ block: 'center' });
    }
  };

  const step = (dir) => {
    if (!contentFind.matches.length) return;
    contentFind.index = (contentFind.index + dir + contentFind.matches.length) % contentFind.matches.length;
    const marks = marksOf();
    marks.forEach((m, i) => m.classList.toggle('hl--active', i === contentFind.index));
    if (marks[contentFind.index]) marks[contentFind.index].scrollIntoView({ block: 'center' });
    count.textContent = (contentFind.index + 1) + '/' + contentFind.matches.length;
  };

  input.addEventListener('input', apply);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    }
    if (e.key === 'Escape') {
      bar.remove();
      scroller.focus();
    }
  });
  bar.querySelector('[data-dir="-1"]').addEventListener('click', () => step(-1));
  bar.querySelector('[data-dir="1"]').addEventListener('click', () => step(1));
  bar.querySelector('.content-find__close').addEventListener('click', () => {
    contentFind = { term: '', matches: [], index: -1 };
    renderCodeRows(body, text, '', lang);
    bar.remove();
  });
  if (opts) {
    bar.querySelector('.content-find__beautify').addEventListener('click', opts.toggle);
  }

  // Render immediately so code is colorized before the user types anything.
  apply();

  return bar;
}

function renderTextPreview(res, container) {
  const text = res._text || '';
  const pv = container || document.getElementById('inspector-preview');
  pv.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'content-preview';
  const scroller = document.createElement('div');
  scroller.className = 'code-scroll';
  scroller.tabIndex = 0;
  const body = document.createElement('div');
  body.className = 'code-lines';
  scroller.appendChild(body);
  wrap.appendChild(scroller);
  pv.appendChild(wrap);

  const lang = languageFor(res);
  const shown = res._beautified ? beautifyText(res, text) : text;

  const opts = {
    beautified: !!res._beautified,
    toggle: () => {
      res._beautified = !res._beautified;
      renderTextPreview(res, pv === document.getElementById('inspector-preview') ? undefined : pv);
    },
  };
  const bar = setupContentSearch(scroller, body, shown, lang, opts);
  wrap.insertBefore(bar, scroller);
}

/* ---------- API request viewer ---------- */

function formatMs(ms) {
  if (ms === undefined || ms === null || isNaN(ms)) return '';
  if (ms < 1) return '<1 ms';
  if (ms < 1000) return Math.round(ms) + ' ms';
  return (ms / 1000).toFixed(2) + ' s';
}

// Compact "what went out" summary for API resources, rendered in the right
// side panel of the split view: method, status, duration, full URL, query
// parameters and request body.
function renderRequestPreview(res) {
  const req = res.request;
  if (!req) return null;
  const box = document.createElement('div');
  box.className = 'request-preview';
  const method = (res.method || 'GET').toUpperCase();
  let html =
    '<div class="request-preview__head">' +
    '<span class="request-preview__method request-preview__method--' + method.toLowerCase() + '">' + method + '</span>' +
    (res.status ? '<span class="request-preview__status">HTTP ' + res.status + '</span>' : '') +
    (req.time !== undefined ? '<span class="request-preview__time">' + formatMs(req.time) + '</span>' : '') +
    '</div>';
  html +=
    '<div class="request-preview__url" title="' + escapeHtml(res.url) + '">' + escapeHtml(res.url) + '</div>';

  if (req.query && req.query.length) {
    html +=
      '<div class="request-preview__section">' +
      '<div class="request-preview__label">Query parameters</div>' +
      '<table class="request-preview__table"><tbody>';
    for (const p of req.query) {
      html += '<tr><td class="request-preview__key">' + escapeHtml(p.name) + '</td><td>' + escapeHtml(p.value) + '</td></tr>';
    }
    html += '</tbody></table></div>';
  }

  if (req.postData) {
    const pdText = req.postData.text ||
      (req.postData.params || []).map((p) => p.name + '=' + p.value).join('&');
    if (pdText) {
      const clipped = pdText.length > 20000 ? pdText.slice(0, 20000) + '…' : pdText;
      html +=
        '<div class="request-preview__section">' +
        '<div class="request-preview__label">Request body</div>' +
        '<pre class="request-preview__body">' + escapeHtml(clipped) + '</pre></div>';
    }
  }
  box.innerHTML = html;
  return box;
}

// API resources use a split view: response content on the left, request
// details (method / status / query / body) pinned on the right — so a narrow
// DevTools window still shows both at once.
function renderApiPreview(res) {
  const pv = document.getElementById('inspector-preview');
  pv.innerHTML = '';
  pv.classList.add('inspector__preview--column');
  releasePreviewUrls();

  const split = document.createElement('div');
  split.className = 'api-split';

  const main = document.createElement('div');
  main.className = 'api-split__main';

  const side = document.createElement('div');
  side.className = 'api-split__side';
  const reqBox = renderRequestPreview(res);
  if (reqBox) side.appendChild(reqBox);
  if (!side.childElementCount) side.style.display = 'none';

  if (!isTextType(res)) {
    main.innerHTML =
      '<div class="preview-fallback">' +
      (ICONS[res.type] || ICONS.other) +
      '<span>Binary response — download to view it</span></div>';
  } else {
    const pre = document.createElement('pre');
    pre.textContent = 'Loading response…';
    main.appendChild(pre);
    getContent(res).then((content) => {
      if (!state.current || state.current.id !== res.id) return;
      if (content === null || content === undefined || content === '') {
        pre.textContent = 'No response preview — the content could not be retrieved.';
        return;
      }
      let text = contentToText(content);
      if (text.length > 300000) text = text.slice(0, 300000) + '\n\n… (content truncated)';
      res._text = text;
      if (isJsonType(res) && res._beautified === undefined) res._beautified = true;
      renderTextPreview(res, main);
    });
  }

  split.appendChild(main);
  split.appendChild(side);
  pv.appendChild(split);
}

/* ---------- Font viewer ---------- */

function fontFormatOf(res) {
  const map = {
    woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype',
    eot: 'embedded-opentype',
  };
  return map[getExt(res.url)] || '';
}

function fontMimeOf(res) {
  const m = (res.mimeType || '').toLowerCase();
  if (m && (m.includes('font') || m.includes('ms-fontobject'))) return m;
  const map = {
    woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf',
    otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
  };
  return map[getExt(res.url)] || 'font/woff2';
}

function renderFontPreview(res) {
  const pv = document.getElementById('inspector-preview');
  pv.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'font-preview';
  wrap.innerHTML = '<div class="font-preview__status">Loading font…</div>';
  pv.appendChild(wrap);

  getContent(res).then((content) => {
    if (!state.current || state.current.id !== res.id) return;
    if (!content || (typeof content === 'string' && !content.trim())) {
      wrap.innerHTML = '<div class="font-preview__status">Font content could not be retrieved.</div>';
      return;
    }
    const blob = toBlob(content, fontMimeOf(res));
    const url = URL.createObjectURL(blob);
    previewObjectUrls.push(url);
    const fam = 'sd-font-' + String(res.id).replace(/[^a-zA-Z0-9]/g, '');
    const fmt = fontFormatOf(res);
    const style = document.createElement('style');
    style.textContent =
      "@font-face{font-family:'" + fam + "';src:url('" + url + "') format('" + fmt + "');font-display:block;}";
    document.head.appendChild(style);

    wrap.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'font-preview__head';
    head.innerHTML =
      '<strong>' + escapeHtml(res.filename) + '</strong>' +
      '<span>' + escapeHtml(fmt || res.mimeType || 'font') + (res.size ? ' · ' + escapeHtml(formatBytes(res.size)) : '') + '</span>';
    wrap.appendChild(head);

    const samples = [
      { text: 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz', size: 30 },
      { text: '0123456789 .,;:!?()[]{}@#$%&*+=-_', size: 18 },
      { text: 'The quick brown fox jumps over the lazy dog', size: 15 },
      { text: 'The quick brown fox jumps over the lazy dog', size: 13 },
      { text: 'SOURCE DOWNLOAD — FONT PREVIEW', size: 20 },
    ];
    for (const s of samples) {
      const line = document.createElement('div');
      line.className = 'font-preview__sample';
      line.style.fontFamily = "'" + fam + "', monospace";
      line.style.fontSize = s.size + 'px';
      line.textContent = s.text;
      wrap.appendChild(line);
    }
    try {
      document.fonts.load("16px '" + fam + "'");
    } catch {
      /* font loading API unavailable — preview still renders */
    }
  });
}

/* ---------- SVG viewer ---------- */

// Best-effort intrinsic size from the SVG markup so the preview never
// collapses to 0×0 when the file has no explicit width/height.
function svgIntrinsicSize(svgText) {
  const read = (attr) => {
    const m = svgText.match(new RegExp(attr + '\\s*=\\s*["\']([^"\']+)["\']', 'i'));
    return m ? parseFloat(m[1]) : null;
  };
  let width = read('width');
  let height = read('height');
  const vb = svgText.match(/viewBox\s*=\s*["']\s*([\d.,\s-]+)["']/i);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(parseFloat);
    if (p.length === 4 && !isNaN(p[2]) && !isNaN(p[3])) {
      if (!width) width = p[2];
      if (!height) height = p[3];
    }
  }
  return {
    width: width && width > 0 ? width : null,
    height: height && height > 0 ? height : null,
  };
}

function renderSvgPreview(res) {
  const pv = document.getElementById('inspector-preview');
  pv.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'svg-preview';
  wrap.innerHTML = '<div class="font-preview__status">Loading SVG…</div>';
  pv.appendChild(wrap);

  getContent(res).then((content) => {
    if (!state.current || state.current.id !== res.id) return;
    if (!content || (typeof content === 'string' && !content.trim())) {
      wrap.innerHTML = '<div class="font-preview__status">SVG content could not be retrieved.</div>';
      return;
    }
    const text = contentToText(content);
    res._text = text;
    wrap.innerHTML = '';

    const img = document.createElement('img');
    img.alt = '';
    img.className = 'svg-preview__img';
    img.title = 'Click to enlarge';

    const size = svgIntrinsicSize(text);
    if (size.width) img.width = size.width;
    if (size.height) img.height = size.height;

    // The blob must carry the image/svg+xml type, otherwise Chrome refuses to
    // render it inside an <img> (it works when downloaded only because the
    // .svg extension tells the OS how to open it).
    const blobUrl = URL.createObjectURL(toBlob(content, res.mimeType || 'image/svg+xml'));
    previewObjectUrls.push(blobUrl);
    let src = blobUrl;
    img.src = blobUrl;

    // Safety net: if the blob still fails, fall back to an inline data URL.
    img.addEventListener('error', () => {
      try {
        src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
        img.src = src;
      } catch {
        /* noop */
      }
    });

    wrap.appendChild(img);

    img.addEventListener('click', () => {
      openLightbox();
      const big = document.getElementById('lightbox-content');
      big.innerHTML = '';
      const bigImg = document.createElement('img');
      bigImg.alt = '';
      big.appendChild(bigImg);
      bigImg.src = src;
    });

    const actions = document.createElement('div');
    actions.className = 'svg-preview__actions';
    const srcBtn = document.createElement('button');
    srcBtn.className = 'btn btn--sm';
    srcBtn.textContent = 'View source';
    srcBtn.title = 'Show the SVG markup with syntax highlighting';
    srcBtn.addEventListener('click', () => renderTextPreview(res));
    actions.appendChild(srcBtn);
    wrap.appendChild(actions);
  });
}

function setInspectorMeta(id, value, isUrl) {
  const el = document.getElementById(id);
  if (isUrl) {
    el.href = /^(https?:|data:|blob:|file:)/i.test(value) ? value : '#';
    el.textContent = value;
  } else {
    el.textContent = value;
  }
}

/* ============================================================
 * 7. Inspector (multi-file tabs, Sources-style)
 * ============================================================ */

function contentToText(content) {
  if (content instanceof Uint8Array) return decodeU8(content);
  if (content instanceof ArrayBuffer) return decodeU8(new Uint8Array(content));
  if (typeof content === 'string') return content;
  return String(content);
}

function resourceById(id) {
  return state.resources.find((r) => r.id === id) || null;
}

function updateActiveHighlight() {
  const activeId = state.current ? state.current.id : null;
  document.querySelectorAll('.card, .tile').forEach((el) => {
    const isActive = el.dataset.id === activeId;
    el.classList.toggle('card--active', isActive);
    el.classList.toggle('tile--active', isActive);
  });
}

function openResource(res) {
  const idx = state.open.indexOf(res.id);
  if (idx !== -1) state.open.splice(idx, 1);
  state.open.unshift(res.id);
  state.current = res;
  renderInspector();
  updateActiveHighlight();
}

function closeResource(id) {
  const idx = state.open.indexOf(id);
  if (idx === -1) return;
  state.open.splice(idx, 1);
  if (state.current && state.current.id === id) {
    const nextId = state.open[idx] || state.open[idx - 1] || null;
    state.current = nextId ? resourceById(nextId) : null;
  }
  renderInspector();
  updateActiveHighlight();
}

function closeInspector() {
  state.current = null;
  state.open = [];
  releasePreviewUrls();
  const inspector = document.getElementById('inspector');
  inspector.hidden = true;
  document.getElementById('inspector-tabs').hidden = true;
  document.getElementById('inspector-empty').hidden = false;
  document.getElementById('inspector-body').hidden = true;
  render();
}

function renderInspector() {
  const inspector = document.getElementById('inspector');
  inspector.hidden = false;
  renderInspectorTabs();
  if (!state.current) {
    document.getElementById('inspector-empty').hidden = false;
    document.getElementById('inspector-body').hidden = true;
    return;
  }
  document.getElementById('inspector-empty').hidden = true;
  document.getElementById('inspector-body').hidden = false;
  renderActiveResource();
}

function renderInspectorTabs() {
  const tabsEl = document.getElementById('inspector-tabs');
  tabsEl.innerHTML = '';
  tabsEl.hidden = state.open.length === 0;

  if (state.open.length > 1) {
    const closeAll = document.createElement('button');
    closeAll.className = 'itab-closeall';
    closeAll.title = 'Close all open tabs';
    closeAll.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M3 3l10 10M13 3L3 13"/></svg>' +
      '<span>Close all</span>';
    closeAll.addEventListener('click', () => closeInspector());
    tabsEl.appendChild(closeAll);
  }

  for (const id of state.open) {
    const r = resourceById(id);
    if (!r) continue;
    const active = state.current && state.current.id === r.id;
    const tab = document.createElement('button');
    tab.className = 'itab' + (active ? ' itab--active' : '');
    tab.title = r.filename;
    tab.innerHTML =
      '<span class="itab__dot" style="background:' + TYPE_DOT_COLORS[r.type] + '"></span>' +
      '<span class="itab__name">' + escapeHtml(r.filename) + '</span>' +
      '<span class="itab__close">×</span>';
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.classList.contains('itab__close')) {
        closeResource(r.id);
      } else {
        state.current = r;
        renderInspector();
      }
    });
    tabsEl.appendChild(tab);
  }
}

function renderActiveResource() {
  const res = state.current;
  document.getElementById('inspector-title').textContent = res.filename;

  const pv = document.getElementById('inspector-preview');
  pv.innerHTML = '';
  pv.classList.remove('inspector__preview--column');
  releasePreviewUrls();
  if (res.type === 'image' && isDisplayableUrl(res.url)) {
    const img = document.createElement('img');
    img.alt = '';
    img.className = 'media-preview';
    img.title = 'Click to enlarge';
    pv.appendChild(img);
    img.addEventListener('click', () => {
      openLightbox();
      const big = document.getElementById('lightbox-content');
      big.innerHTML = '';
      const bigImg = document.createElement('img');
      bigImg.alt = '';
      big.appendChild(bigImg);
      getPreviewUrl(res).then((u) => {
        if (bigImg.isConnected) bigImg.src = u;
      });
    });
    setupMediaPreview(img, res);
  } else if (res.type === 'video') {
    if (isUnplayableVideo(res)) {
      renderUnplayableVideo(res);
    } else {
      const video = document.createElement('video');
      video.controls = true;
      video.className = 'media-preview';
      video.title = 'Click to enlarge';
      if (res.mimeType) video.type = res.mimeType;
      pv.appendChild(video);
      video.addEventListener('click', () => {
        openLightbox();
        const big = document.getElementById('lightbox-content');
        big.innerHTML = '';
        const bigVideo = document.createElement('video');
        bigVideo.controls = true;
        if (res.mimeType) bigVideo.type = res.mimeType;
        big.appendChild(bigVideo);
        getPreviewUrl(res).then((u) => {
          if (bigVideo.isConnected) bigVideo.src = u;
        });
        bigVideo.addEventListener('error', () => {
          if (!bigVideo.isConnected) return;
          big.innerHTML =
            '<div class="media-fallback media-fallback--lightbox">' +
            '<p>This video cannot be played in the browser.</p>' +
            '<p class="media-fallback__note">Download the file and open it with VLC or another media player.</p>' +
            '</div>';
        });
      });
      setupMediaPreview(video, res, () => renderUnplayableVideo(res));
    }
  } else if (res.type === 'audio') {
    const audio = document.createElement('audio');
    audio.controls = true;
    if (res.mimeType) audio.type = res.mimeType;
    pv.appendChild(audio);
    setupMediaPreview(audio, res);
  } else if (res.type === 'svg') {
    renderSvgPreview(res);
  } else if (res.type === 'font') {
    renderFontPreview(res);
  } else if (res.type === 'api') {
    renderApiPreview(res);
  } else if (isTextType(res)) {
    const pre = document.createElement('pre');
    pre.textContent = 'Loading content…';
    pv.appendChild(pre);
    getContent(res).then((content) => {
      if (!state.current || state.current.id !== res.id) return;
      if (content === null || content === undefined || content === '') {
        pre.textContent = 'No preview available — the content could not be retrieved.';
        return;
      }
      let text = contentToText(content);
      if (text.length > 300000) text = text.slice(0, 300000) + '\n\n… (content truncated)';
      res._text = text;
      if (isJsonType(res) && res._beautified === undefined) res._beautified = true;
      renderTextPreview(res);
    });
  } else {
    pv.innerHTML =
      '<div class="preview-fallback">' +
      (ICONS[res.type] || ICONS.other) +
      '<span>No preview for this resource type</span></div>';
  }

  setInspectorMeta('meta-url', res.url, true);
  setInspectorMeta('meta-type', '', false);
  document.getElementById('meta-type').innerHTML =
    '<span class="meta-chip meta-chip--' + res.type + '">' + TYPES[res.type].label + '</span>';
  setInspectorMeta('meta-mime', res.mimeType || '—', false);
  setInspectorMeta('meta-size', res.size ? formatBytes(res.size) : '—', false);
  setInspectorMeta(
    'meta-http',
    (res.method || '—') + ' ' + (res.status || '—'),
    false
  );
  const sourceLabel =
    res.source === 'dom' ? 'DOM' :
    res.source === 'css' ? 'CSS' :
    'Network';
  setInspectorMeta('meta-source', sourceLabel, false);

  const titleRow = document.getElementById('meta-title-row');
  titleRow.hidden = !res.title;
  if (res.title) setInspectorMeta('meta-title', res.title, false);
  const altRow = document.getElementById('meta-alt-row');
  altRow.hidden = !res.alt;
  if (res.alt) setInspectorMeta('meta-alt', res.alt, false);
}

function closeActiveResource() {
  if (state.current) closeResource(state.current.id);
}

let inspectorDetailsOpen = false;
function toggleInspectorDetails() {
  inspectorDetailsOpen = !inspectorDetailsOpen;
  document.getElementById('inspector-meta-wrap').hidden = !inspectorDetailsOpen;
  document.getElementById('inspector-details').classList.toggle('inspector__details-btn--open', inspectorDetailsOpen);
}

/* ============================================================
 * 7c. Lightbox (enlarge media previews)
 * ============================================================ */

const lightbox = {
  scale: 1,
  tx: 0,
  ty: 0,
};

function lightboxApply() {
  const content = document.getElementById('lightbox-content');
  content.style.transform =
    'translate(' + lightbox.tx + 'px, ' + lightbox.ty + 'px) scale(' + lightbox.scale + ')';
  document.getElementById('lightbox-zoom-label').textContent = Math.round(lightbox.scale * 100) + '%';
  const stage = document.getElementById('lightbox-stage');
  stage.classList.toggle('lightbox--zoomed', lightbox.scale > 1);
}

function lightboxReset() {
  lightbox.scale = 1;
  lightbox.tx = 0;
  lightbox.ty = 0;
  lightboxApply();
}

function openLightbox() {
  document.getElementById('lightbox').hidden = false;
  lightboxReset();
}

function closeLightbox() {
  const content = document.getElementById('lightbox-content');
  content.innerHTML = '';
  for (const v of content.querySelectorAll('video')) v.pause();
  document.getElementById('lightbox').hidden = true;
  lightboxReset();
}

/* ---------- User guide ---------- */
function openGuide() {
  document.getElementById('guide').hidden = false;
  const input = document.getElementById('guide-search');
  input.value = '';
  filterGuide('');
  input.focus();
}

function closeGuide() {
  document.getElementById('guide').hidden = true;
}

function filterGuide(query) {
  const q = (query || '').trim().toLowerCase();
  const body = document.getElementById('guide-body');
  const sections = body.querySelectorAll('.guide__sec');
  let visible = 0;
  for (const sec of sections) {
    const match = !q || (sec.dataset.key || '').includes(q) ||
      sec.textContent.toLowerCase().includes(q);
    sec.classList.toggle('guide__sec--hidden', !match);
    if (match) visible++;
  }
  document.getElementById('guide-empty').classList.toggle('guide__empty--show', visible === 0);
}

function setupGuide() {
  document.getElementById('btn-guide').addEventListener('click', openGuide);
  document.getElementById('guide-close').addEventListener('click', closeGuide);
  document.getElementById('guide-backdrop').addEventListener('click', closeGuide);
  document.getElementById('guide-search').addEventListener('input', (e) => {
    filterGuide(e.target.value);
  });
  const hintLink = document.getElementById('text-hint-guide');
  if (hintLink) hintLink.addEventListener('click', (e) => {
    e.preventDefault();
    openGuide();
    const input = document.getElementById('guide-search');
    input.value = 'Text';
    filterGuide('Text');
  });

  if (!panelPrefs.guideSeen) {
    panelPrefs.guideSeen = true;
    savePrefs();
    setTimeout(openGuide, 400);
  }
}

function setupLightbox() {
  const stage = document.getElementById('lightbox-stage');
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const px = e.clientX - rect.left - rect.width / 2;
    const py = e.clientY - rect.top - rect.height / 2;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const next = Math.min(Math.max(lightbox.scale * factor, 0.1), 20);
    const k = next / lightbox.scale;
    lightbox.tx = px * (1 - k) + lightbox.tx * k;
    lightbox.ty = py * (1 - k) + lightbox.ty * k;
    lightbox.scale = next;
    lightboxApply();
  }, { passive: false });

  let dragging = false;
  let dragMoved = false;
  let sx = 0;
  let sy = 0;
  let stx = 0;
  let sty = 0;
  stage.addEventListener('mousedown', (e) => {
    if (e.target.closest('.lightbox__toolbar')) return;
    if (e.button !== 0) return;
    dragging = true;
    dragMoved = false;
    sx = e.clientX;
    sy = e.clientY;
    stx = lightbox.tx;
    sty = lightbox.ty;
    stage.classList.add('lightbox--dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) dragMoved = true;
    lightbox.tx = stx + (e.clientX - sx);
    lightbox.ty = sty + (e.clientY - sy);
    lightboxApply();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    stage.classList.remove('lightbox--dragging');
  });

  // Clicking the empty backdrop closes the lightbox (a drag that moved is not a click).
  stage.addEventListener('click', (e) => {
    if (dragMoved) return;
    if (e.target === stage) closeLightbox();
  });

  stage.addEventListener('dblclick', (e) => {
    if (e.target.closest('.lightbox__toolbar')) return;
    if (lightbox.scale > 1) lightboxReset();
    else {
      lightbox.scale = 2;
      lightboxApply();
    }
  });

  document.getElementById('lightbox-zoom-in').addEventListener('click', () => {
    lightbox.scale = Math.min(lightbox.scale * 1.4, 20);
    lightboxApply();
  });
  document.getElementById('lightbox-zoom-out').addEventListener('click', () => {
    lightbox.scale = Math.max(lightbox.scale / 1.4, 0.1);
    lightboxApply();
  });
  document.getElementById('lightbox-zoom-reset').addEventListener('click', lightboxReset);
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
}

/* ============================================================
 * 8. Content retrieval
 * ============================================================ */

function getContent(res) {
  if (!res.contentPromise) res.contentPromise = loadContent(res);
  return res.contentPromise;
}

async function loadContent(res) {
  // Never try to fetch non-network schemes (e.g. the page's own
  // "chrome-extension://invalid/" requests would fail loudly).
  if (!isFetchableUrl(res.url)) return null;
  // 0) blob: URLs are only reachable from inside the inspected page — the
  //    panel cannot fetch them directly, so ask the inspected page to read
  //    the blob and hand it back as a base64 data URL.
  if (res.url.startsWith('blob:')) {
    return await fetchBlobViaInspectedWindow(res.url);
  }
  // 1) Network API — works regardless of CORS. Guard against callbacks that
  //    never fire (some entries resolve late) so a batch download cannot hang.
  if (res.entry && typeof res.entry.getContent === 'function') {
    try {
      const timeoutP = new Promise((resolve) => setTimeout(() => resolve([undefined, undefined]), 20000));
      const contentP = new Promise((resolve) => {
        res.entry.getContent((c, enc) => resolve([c, enc]));
      });
      const [content, encoding] = await Promise.race([contentP, timeoutP]);
      if (content !== undefined && content !== null && content !== '') {
        if (encoding === 'base64') return base64ToUint8(content);
        return content;
      }
    } catch {
      /* fall through */
    }
  }
  // 2) Fetch fallback — covers data: URIs and same-origin / host-permitted
  //    pages. Bounded with a timeout so a stalled host can't freeze a batch.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const resp = await fetch(res.url, {
        credentials: 'omit',
        mode: 'cors',
        signal: controller.signal,
      });
      if (resp.ok) return await resp.arrayBuffer();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* noop */
  }
  return null;
}

function fetchBlobViaInspectedWindow(url) {
  return new Promise((resolve) => {
    const expr = `(async () => {
      try {
        const resp = await fetch(${JSON.stringify(url)});
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return await new Promise((res2) => {
          const fr = new FileReader();
          fr.onload = () => res2(fr.result);
          fr.onerror = () => res2(null);
          fr.readAsDataURL(blob);
        });
      } catch (e) {
        return null;
      }
    })()`;
    chrome.devtools.inspectedWindow.eval(
      expr,
      { awaitPromise: true, timeout: 20000 },
      (result, info) => {
        if (info && info.isException) {
          resolve(null);
          return;
        }
        if (typeof result === 'string' && result.startsWith('data:')) {
          const comma = result.indexOf(',');
          resolve(base64ToUint8(result.slice(comma + 1)));
        } else {
          resolve(null);
        }
      }
    );
  });
}

// Best-effort preview source for media: prefer the real content (network /
// blob) turned into a panel-local object URL so it plays even when the raw
// URL is CORS-blocked or blob-scoped.
let previewObjectUrls = [];
async function getPreviewUrl(res) {
  const content = await getContent(res).catch(() => null);
  if (content !== null && content !== undefined && content !== '') {
    const url = URL.createObjectURL(toBlob(content, res.mimeType || undefined));
    previewObjectUrls.push(url);
    return url;
  }
  return res.url;
}

function setupMediaPreview(el, res, onError) {
  getPreviewUrl(res).then((url) => {
    if (state.current !== res) return;
    el.src = url;
  });
  // If the browser rejects the format, let the caller swap in a fallback UI
  // (HLS/DASH/unknown codecs) instead of leaving a black player.
  el.addEventListener('error', () => {
    if (typeof onError === 'function') onError();
  }, { once: true });
}

function releasePreviewUrls() {
  for (const url of previewObjectUrls) URL.revokeObjectURL(url);
  previewObjectUrls = [];
}

/* ---------- Unplayable-video fallback (HLS / DASH / unknown codecs) ---------- */

// Media types Chrome's <video> cannot render natively. `isUnplayableVideo`
// pre-empts the player for known-bad containers; a runtime `error` event on
// the <video> element catches everything else (see setupMediaPreview).
function isUnplayableVideo(res) {
  const m = (res.mimeType || '').toLowerCase();
  if (m.includes('mpegurl') || m.includes('hls') || m.includes('dash') || m === 'video/mp2t') return true;
  const ext = getExt(res.url);
  return ['m3u8', 'm3u', 'mpd', 'ts'].includes(ext);
}

function isHlsManifest(res) {
  const m = (res.mimeType || '').toLowerCase();
  if (m.includes('mpegurl') || m.includes('hls')) return true;
  const ext = getExt(res.url);
  return ['m3u8', 'm3u'].includes(ext);
}

function renderUnplayableVideo(res) {
  const pv = document.getElementById('inspector-preview');
  pv.innerHTML = '';
  const isHls = isHlsManifest(res);
  const wrap = document.createElement('div');
  wrap.className = 'media-fallback';
  wrap.innerHTML =
    '<div class="media-fallback__icon">' + ICONS.video + '</div>' +
    '<div class="media-fallback__title">' +
    (isHls ? 'HLS (m3u8) stream detected' : 'This video cannot be played in the browser') +
    '</div>' +
    '<div class="media-fallback__desc">' +
    (isHls
      ? 'Chrome cannot play HLS streams directly. You can merge all segments of <b>' + escapeHtml(res.filename) + '</b> into one video file, or download the raw stream.'
      : 'The browser does not support this format' +
        (res.mimeType ? ' (' + escapeHtml(res.mimeType) + ')' : '') +
        '. Download the file and open it with a desktop media player.') +
    '</div>' +
    '<div class="media-fallback__actions">' +
    (isHls ? '<button id="mfa-merge" class="btn btn--primary">Merge segments & download</button>' : '') +
    '<button id="mfa-download" class="btn">Download original</button>' +
    '</div>' +
    '<div class="media-fallback__note">Tip: open the downloaded file with VLC or any desktop media player — it plays virtually every format.</div>';
  pv.appendChild(wrap);
  const mergeBtn = document.getElementById('mfa-merge');
  if (mergeBtn) mergeBtn.addEventListener('click', () => mergeHlsAndDownload(res));
  document.getElementById('mfa-download').addEventListener('click', () => downloadSingle(res));
}

// Fetch a URL from inside the inspected page (same-origin / CORS-friendly from
// the page's own context) and return its bytes. This is what lets the HLS
// merger download manifests and segments that the panel's own fetch() would
// be blocked from reading.
function fetchFromPage(url) {
  return new Promise((resolve) => {
    const expr = `(async () => {
      try {
        const resp = await fetch(${JSON.stringify(url)});
        if (!resp.ok) return { ok: false };
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
        }
        return { ok: true, b64: btoa(bin) };
      } catch (e) { return { ok: false }; }
    })()`;
    chrome.devtools.inspectedWindow.eval(
      expr,
      { awaitPromise: true, timeout: 60000 },
      (result, info) => {
        if (info && info.isException) {
          resolve(null);
          return;
        }
        if (result && result.ok && typeof result.b64 === 'string') {
          try {
            resolve(base64ToUint8(result.b64));
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      }
    );
  });
}

async function mergeHlsAndDownload(res) {
  if (!window.SourceDownloadHls) {
    toast('HLS engine is missing.', 'error');
    return;
  }
  setBusy(true);
  showProgress('Downloading HLS playlist…');
  try {
    const result = await SourceDownloadHls.combine(
      res.url,
      {
        text: async (u) => {
          const b = await fetchFromPage(u);
          return b ? decodeU8(b) : null;
        },
        bytes: (u) => fetchFromPage(u),
      },
      (f) => updateProgress(f, 'Merging segments… ' + Math.round(f * 100) + '%')
    );
    const rawName = filenameFromUrl(res.url, result.mime);
    const base = rawName.replace(/\.[^.]+$/, '');
    const ext = result.mime === 'video/mp4' ? '.mp4' : '.ts';
    saveBlob(toBlob(result.bytes, result.mime), base + ext);
    toast(result.live
      ? 'Merged ' + result.segments + ' segment' + (result.segments === 1 ? '' : 's') + ' (live stream — saved what was available)'
      : 'Merged ' + result.segments + ' segment' + (result.segments === 1 ? '' : 's') + ' into ' + base + ext, 'success');
  } catch (e) {
    toast(e && e.message ? e.message : 'Could not merge the HLS stream.', 'error');
  } finally {
    hideProgress();
    setBusy(false);
  }
}

/* ============================================================
 * 9. Downloads
 * ============================================================ */

function uniqueName(used, folder, name) {
  let set = used.get(folder);
  if (!set) {
    set = new Set();
    used.set(folder, set);
  }
  if (!set.has(name)) {
    set.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 1;
  let candidate;
  do {
    candidate = base + '-' + i++ + ext;
  } while (set.has(candidate));
  set.add(candidate);
  return candidate;
}

async function downloadSingle(res) {
  setBusy(true);
  showProgress('Preparing…');
  try {
    const content = await getContent(res);
    if (content === null || content === undefined || content === '') {
      toast('Could not fetch this resource (CORS or unsupported type).', 'error');
      return;
    }
    saveBlob(toBlob(content, res.mimeType || undefined), res.filename);
    state.failed.delete(res.id);
    render();
    toast('Download started: ' + res.filename, 'success');
  } finally {
    hideProgress();
    setBusy(false);
  }
}

async function downloadZip(resources, baseName) {
  if (!window.SourceDownloadZip) {
    toast('ZIP engine is missing.', 'error');
    return;
  }
  if (!resources.length) {
    toast('No resources to download.', 'error');
    return;
  }
  setBusy(true);
  showProgress('Fetching 0/' + resources.length + '…');
  try {
    const used = new Map();
    const total = resources.length;
    const results = new Array(total);
    let next = 0;

    const worker = async () => {
      while (next < total) {
        const i = next++;
        const res = resources[i];
        try {
          results[i] = { res, content: await getContent(res) };
        } catch {
          results[i] = { res, content: null };
        }
        const done = i + 1;
        if (done % 5 === 0 || done === total) {
          updateProgress(done / total, 'Fetching ' + done + '/' + total + '…');
        }
      }
    };

    const CONCURRENCY = 5;
    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENCY, total); w++) workers.push(worker());
    await Promise.all(workers);

    const entries = [];
    let fetched = 0;
    const failedNow = [];
    for (const { res, content } of results) {
      if (content !== null && content !== undefined && content !== '') {
        const folderName = TYPES[res.type].folder || 'other';
        entries.push({
          name: folderName + '/' + uniqueName(used, folderName, res.filename),
          data: content,
          date: res.timestamp ? new Date(res.timestamp) : new Date(),
        });
        fetched++;
        state.failed.delete(res.id);
      } else {
        state.failed.add(res.id);
        failedNow.push(res.id);
      }
    }

    updateProgress(1, 'Creating ZIP archive…');
    const blob = await window.SourceDownloadZip.createZip(entries, (fraction) => {
      updateProgress(0.5 + 0.5 * fraction, 'Creating ZIP ' + Math.round(fraction * 100) + '%…');
    });
    hideProgress();

    const skipped = total - fetched;
    saveBlob(blob, baseName + '.zip');
    if (skipped > 0) {
      toast(
        'ZIP saved: ' + fetched + ' of ' + total + ' resources (' + skipped + ' failed)',
        'error',
        {
          label: 'Retry ' + skipped,
          fn: () => downloadZip(
            state.resources.filter((r) => failedNow.includes(r.id)),
            baseName + '-retry'
          ),
        }
      );
    } else {
      toast('ZIP saved: ' + fetched + ' of ' + total + ' resources', 'success');
    }
    render();
  } catch (err) {
    hideProgress();
    toast('ZIP failed: ' + (err && err.message ? err.message : 'unknown error'), 'error');
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  state.busy = busy;
  for (const id of ['btn-download-all', 'btn-download-view', 'btn-download-selected', 'btn-refresh', 'view-grid', 'view-list']) {
    const el = document.getElementById(id);
    if (el) el.disabled = busy;
  }
  setStatusMessage(busy ? 'Working…' : '');
}

function selectedResources() {
  return state.resources.filter((r) => state.selected.has(r.id));
}

function zipBaseName() {
  let host = 'resources';
  try {
    const url = chrome.devtools.inspectedWindow.url || '';
    host = new URL(url).hostname || 'resources';
  } catch {
    /* keep default */
  }
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    'source-download-' + host + '-' +
    d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
    pad(d.getHours()) + pad(d.getMinutes())
  );
}

/* ============================================================
 * 10. Context menu
 * ============================================================ */

function openContextMenu(e, res) {
  e.preventDefault();
  const menu = document.getElementById('context-menu');
  menu.innerHTML = '';

  const items = [
    { label: 'Download', icon: ICONS.download, action: () => downloadSingle(res) },
    { label: 'Open in new tab', icon: ICONS.open, action: () => openResourceTab(res) },
    {
      label: 'Copy URL',
      icon: ICONS.copy,
      action: () => {
        copyText(res.url);
        toast('URL copied to clipboard', 'success');
      },
    },
  ];
  if (state.failed.has(res.id)) {
    items.splice(1, 0, {
      label: 'Retry download',
      icon: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8A5.5 5.5 0 1 1 11 3.7"/><path d="M13.5 2v2.5H11"/></svg>',
      action: () => downloadSingle(res),
    });
  }
  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = 'context-menu__item';
    btn.innerHTML = item.icon + '<span>' + item.label + '</span>';
    btn.addEventListener('click', () => {
      closeContextMenu();
      item.action();
    });
    menu.appendChild(btn);
  }

  const x = Math.min(e.clientX, window.innerWidth - 200);
  const y = Math.min(e.clientY, window.innerHeight - items.length * 40 - 24);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.hidden = false;
}

function closeContextMenu() {
  document.getElementById('context-menu').hidden = true;
}

function openResourceTab(res) {
  chrome.tabs.create({ url: res.url }, () => {
    if (chrome.runtime.lastError) window.open(res.url, '_blank');
  });
}

/* ============================================================
 * 11. Feedback UI (toast, progress, status message)
 * ============================================================ */

let toastTimer = null;
function toast(message, type, action) {
  const el = document.getElementById('toast');
  el.innerHTML = '';
  const span = document.createElement('span');
  span.className = 'toast__msg';
  span.textContent = message;
  el.appendChild(span);
  if (action && action.label) {
    const btn = document.createElement('button');
    btn.className = 'toast__action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      el.hidden = true;
      clearTimeout(toastTimer);
      action.fn();
    });
    el.appendChild(btn);
  }
  el.className = 'toast' + (type ? ' toast--' + type : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 6500);
}

function showProgress(label) {
  document.getElementById('progress-wrap').hidden = false;
  updateProgress(0, label);
}

function updateProgress(fraction, label) {
  const fill = document.getElementById('progress-fill');
  fill.style.width = Math.max(0, Math.min(1, fraction)) * 100 + '%';
  document.getElementById('progress-label').textContent = label;
}

function hideProgress() {
  document.getElementById('progress-wrap').hidden = true;
}

function setStatusMessage(msg) {
  document.getElementById('status-message').textContent = msg || '';
}

/* ============================================================
 * 12. Init
 * ============================================================ */

const PREFS_KEY = 'panelPrefs';
let panelPrefs = { view: 'list', activeTab: 'all', inspectorWidth: null, guideSeen: false };

function loadPrefs() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ panelPrefs: { view: 'list', activeTab: 'all', inspectorWidth: null, guideSeen: false } }, (data) => {
      const p = data.panelPrefs || {};
      panelPrefs = {
        view: p.view === 'grid' ? 'grid' : 'list',
        activeTab: TYPES[p.activeTab] ? p.activeTab : 'all',
        inspectorWidth: typeof p.inspectorWidth === 'number' && p.inspectorWidth > 0 ? p.inspectorWidth : null,
        guideSeen: p.guideSeen === true,
      };
      state.view = panelPrefs.view;
      state.activeTab = panelPrefs.activeTab;
      resolve();
    });
  });
}

function savePrefs() {
  chrome.storage.local.set({ panelPrefs });
}

function applyInspectorWidth() {
  if (!panelPrefs.inspectorWidth) return;
  const inspector = document.getElementById('inspector');
  inspector.style.flexBasis = panelPrefs.inspectorWidth + 'px';
  inspector.style.flexGrow = '0';
  inspector.style.flexShrink = '0';
  inspector.style.maxWidth = 'none';
}

function updateViewToggle() {
  const grid = document.getElementById('view-grid');
  const list = document.getElementById('view-list');
  grid.classList.toggle('icon-btn--active', state.view === 'grid');
  list.classList.toggle('icon-btn--active', state.view === 'list');
}

function bindEvents() {
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    searchClear.hidden = !state.search;
    searchInput.title = isRegexSearch()
      ? 'Regex search active — wrap your query in /pattern/i'
      : 'Search by name, URL, type, alt text or title…';
    render();
    clearTimeout(searchTimer);
    if (!state.search.trim()) {
      setStatusMessage('');
      return;
    }
    searchTimer = setTimeout(() => {
      scanContentForSearch().then(() => {
        if (searchInput.value === state.search) render();
      });
    }, 400);
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    state.search = '';
    searchClear.hidden = true;
    setStatusMessage('');
    render();
    searchInput.focus();
  });

  // Category filter bar
  const bindFilter = (id, key, opts) => {
    const el = document.getElementById(id);
    el.addEventListener(opts && opts.event || 'input', () => {
      state.filters[key] = el.value;
      render();
      if ((key === 'minWidth' || key === 'minHeight') && el.value) decodeImageSizes();
    });
  };
  bindFilter('f-min-size', 'minSize');
  bindFilter('f-max-size', 'maxSize');
  bindFilter('f-min-width', 'minWidth');
  bindFilter('f-min-height', 'minHeight');
  document.getElementById('f-sort').addEventListener('change', (e) => {
    state.filters.sortBy = e.target.value;
    render();
  });
  document.getElementById('f-sort-dir').addEventListener('click', () => {
    state.filters.sortDir = state.filters.sortDir === 'asc' ? 'desc' : 'asc';
    render();
  });
  document.getElementById('f-method').addEventListener('change', (e) => {
    state.filters.method = e.target.value;
    render();
  });
  document.getElementById('f-type').addEventListener('change', (e) => {
    state.filters.reqType = e.target.value;
    render();
  });
  document.getElementById('f-clear').addEventListener('click', () => {
    state.filters = { minSize: '', maxSize: '', minWidth: '', minHeight: '', sortBy: 'name', sortDir: 'asc', method: '', reqType: '' };
    render();
  });

  // Text capture controls
  document.getElementById('tf-kind').addEventListener('change', (e) => {
    state.text.filters.kind = e.target.value;
    // Switching away from the custom selector clears it, so the normal
    // whole-page capture resumes (and vice-versa: typing a selector switches
    // the filter to the CSS mode automatically).
    if (e.target.value !== 'css') {
      state.text.filters.css = '';
      document.getElementById('tf-css').value = '';
    }
    renderTextView();
    pollTextOnce().catch(() => {});
  });
  document.getElementById('tf-level').addEventListener('change', (e) => {
    state.text.filters.level = e.target.value;
    renderTextView();
  });
  const tfCss = document.getElementById('tf-css');
  tfCss.addEventListener('input', () => {
    if (state.text.filters.kind !== 'css') {
      state.text.filters.kind = 'css';
      renderTextView();
    }
  });
  const applyCss = () => {
    const v = tfCss.value.trim();
    state.text.filters.css = v;
    if (!v && state.text.filters.kind === 'css') state.text.filters.kind = 'all';
    renderTextView();
    pollTextOnce().catch(() => {});
  };
  tfCss.addEventListener('change', applyCss);
  tfCss.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyCss();
  });
  let tfQueryTimer = null;
  document.getElementById('tf-query').addEventListener('input', (e) => {
    if (tfQueryTimer) clearTimeout(tfQueryTimer);
    tfQueryTimer = setTimeout(() => {
      tfQueryTimer = null;
      state.text.filters.query = e.target.value;
      renderTextView();
    }, 200);
  });
  document.getElementById('tf-live').addEventListener('click', () => {
    state.text.live = !state.text.live;
    if (!state.text.live) {
      stopTextPoll();
      stopBgTextPoll();
    }
    renderTextView();
    ensureTextPoll();
    ensureBgTextPoll();
  });
  document.getElementById('tf-refresh').addEventListener('click', () => {
    pollTextOnce().catch(() => {});
  });
  document.getElementById('tf-clear').addEventListener('click', () => {
    state.text.blocks = [];
    state.text.tables.clear();
    state.text.sel.clear();
    state.text.lastSig = '';
    renderTextView();
  });
  document.getElementById('tf-export-md').addEventListener('click', exportTextMarkdown);
  document.getElementById('tf-export-csv').addEventListener('click', () => exportTablesAs('csv'));
  document.getElementById('tf-export-html').addEventListener('click', () => exportTablesAs('html'));
  document.getElementById('tf-export-xlsx').addEventListener('click', exportTextXlsx);

  document.getElementById('btn-refresh').addEventListener('click', () => {
    scanDom();
    scanCssResources();
    scheduleSniff();
    if (state.activeTab === 'text') pollTextOnce();
  });

  document.getElementById('view-grid').addEventListener('click', () => {
    state.view = 'grid';
    panelPrefs.view = 'grid';
    savePrefs();
    updateViewToggle();
    render();
  });
  document.getElementById('view-list').addEventListener('click', () => {
    state.view = 'list';
    panelPrefs.view = 'list';
    savePrefs();
    updateViewToggle();
    render();
  });

  document.getElementById('btn-download-all').addEventListener('click', () => {
    if (!state.resources.length) {
      toast('No resources to download.', 'error');
      return;
    }
    downloadZip(state.resources, zipBaseName() + '-all');
  });

  document.getElementById('btn-download-view').addEventListener('click', () => {
    const list = filteredResources();
    if (!list.length) {
      toast('No visible resources to download.', 'error');
      return;
    }
    downloadZip(list, zipBaseName() + '-view');
  });

  document.getElementById('btn-download-selected').addEventListener('click', () => {
    const list = selectedResources();
    if (!list.length) {
      toast('Select at least one resource first.', 'error');
      return;
    }
    downloadZip(list, zipBaseName());
  });

  document.getElementById('inspector-close').addEventListener('click', closeActiveResource);
  document.getElementById('inspector-details').addEventListener('click', toggleInspectorDetails);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
      closeContextMenu();
      closeGuide();
    }
    const lightboxOpen = !document.getElementById('lightbox').hidden;
    if (!lightboxOpen) return;
    if (e.key === '+' || e.key === '=') {
      lightbox.scale = Math.min(lightbox.scale * 1.4, 20);
      lightboxApply();
    } else if (e.key === '-') {
      lightbox.scale = Math.max(lightbox.scale / 1.4, 0.1);
      lightboxApply();
    } else if (e.key === '0') {
      lightboxReset();
    }
  });
  document.getElementById('inspector-download').addEventListener('click', () => {
    if (state.current) downloadSingle(state.current);
  });
  document.getElementById('inspector-open').addEventListener('click', () => {
    if (state.current) openResourceTab(state.current);
  });
  document.getElementById('inspector-copy').addEventListener('click', () => {
    if (!state.current) return;
    copyText(state.current.url);
    toast('URL copied to clipboard', 'success');
  });
  document.getElementById('meta-url').addEventListener('click', (e) => {
    e.preventDefault();
    if (state.current) openResourceTab(state.current);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu')) closeContextMenu();
  });
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.card')) closeContextMenu();
  });
  window.addEventListener('blur', closeContextMenu);
}

function setupResizer() {
  const resizer = document.getElementById('resizer');
  const inspector = document.getElementById('inspector');
  let resizing = false;

  resizer.addEventListener('mousedown', (e) => {
    resizing = true;
    document.body.classList.add('resizing');
    resizer.classList.add('resizer--active');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const main = resizer.parentElement;
    const total = main.clientWidth;
    const width = Math.min(Math.max(total - e.clientX - resizer.offsetWidth, 360), total * 0.94);
    inspector.style.flexBasis = width + 'px';
    inspector.style.flexGrow = '0';
    inspector.style.flexShrink = '0';
    inspector.style.maxWidth = 'none';
  });

  document.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    document.body.classList.remove('resizing');
    resizer.classList.remove('resizer--active');
    panelPrefs.inspectorWidth = Math.round(inspector.getBoundingClientRect().width);
    savePrefs();
  });

  // Double-click the divider to restore the default width.
  resizer.addEventListener('dblclick', () => {
    inspector.style.removeProperty('flex-basis');
    inspector.style.removeProperty('flex-grow');
    inspector.style.removeProperty('flex-shrink');
    inspector.style.removeProperty('max-width');
    panelPrefs.inspectorWidth = null;
    savePrefs();
  });
}

function init() {
  bindEvents();
  updateViewToggle();
  setupResizer();
  setupLightbox();
  setupGuide();
  applyInspectorWidth();
  render();

  chrome.devtools.network.getHAR((har) => {
    if (har && har.entries) {
      for (const entry of har.entries) addResource(fromHarEntry(entry));
    }
    render();
    scanCssResources();
    syncPanelCounts();
    scheduleSniff();
  });

  chrome.devtools.network.onRequestFinished.addListener((entry) => {
    const r = addResource(fromHarEntry(entry));
    scheduleRender();
    if (r && r.type === 'css') scanCssResources();
    scheduleSniff();
  });

  chrome.devtools.network.onNavigated.addListener(() => {
    state.resources = [];
    state.byUrl.clear();
    state.selected.clear();
    state.current = null;
    state.open = [];
    state.failed.clear();
    state.contentIndex.clear();
    apiCount = 0;
    state.text.blocks = [];
    state.text.tables.clear();
    state.text.sel.clear();
    state.text.lastSig = '';
    closeInspector();
    render();
    syncPanelCounts();
    scanDom();
    scanCssResources();
    scheduleSniff();
  });

  scanDom();
  scanCssResources();
  scheduleSniff();
}

document.addEventListener('DOMContentLoaded', () => {
  loadPrefs().then(init);
});
