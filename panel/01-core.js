/*
 * Source Download — Chrome DevTools panel (1/8).
 * Constants, helpers, i18n and type tables.
 * The panel/*.js files are classic scripts loaded in order by panel.html and
 * share one global scope.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
/* global SourceDownloadZip, SourceDownloadBeautify */

'use strict';

const THEME_STORAGE = 'sourceDownloadTheme';

(function applyThemeEarly() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE);
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.dataset.theme = saved;
      return;
    }
  } catch { /* noop */ }
  try {
    document.documentElement.dataset.theme =
      chrome.devtools.panels.themeName === 'dark' ? 'dark' : 'light';
  } catch {
    document.documentElement.dataset.theme = 'dark';
  }
})();

/* ============================================================
 * 1. Constants & helpers
 * ============================================================ */

const Locale = window.SourceDownloadLocale;
const SUPPORTED_LOCALES = Locale.SUPPORTED;
let currentLocale = 'auto';
let currentMessages = {};

function resolveLocale(pref) {
  return Locale.resolve(pref);
}

function t(key, fallback, subs) {
  let res = '';
  if (currentMessages && currentMessages[key] != null) {
    res = currentMessages[key];
  } else {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
        const m = chrome.i18n.getMessage(key);
        if (m) res = m;
      }
    } catch { /* noop */ }
  }
  if (!res && fallback !== undefined) res = fallback;
  // Locale files mix "$count$" and "$COUNT$". Normalize every placeholder to
  // upper case so callers can rely on .replace('$COUNT$', …) in all 54 locales.
  if (res) res = normalizePlaceholders(res);
  if (res && subs && typeof subs === 'object') {
    for (const [k, v] of Object.entries(subs)) {
      res = res.split('$' + k.toUpperCase() + '$').join(String(v));
    }
  }
  return res;
}

function normalizePlaceholders(str) {
  return String(str).replace(/\$([A-Za-z_][A-Za-z0-9_]*)\$/g, (m, name) => '$' + name.toUpperCase() + '$');
}

function getI18nMsg(key, fallback) {
  const v = t(key, fallback);
  return v || fallback;
}

const CAT_KEY_MAP = {
  all: 'catAll',
  api: 'catApi',
  image: 'catImages',
  svg: 'catSvg',
  video: 'catVideos',
  audio: 'catAudio',
  caption: 'catCaptions',
  css: 'catCss',
  js: 'catJs',
  sourcemap: 'catSourcemaps',
  font: 'catFonts',
  document: 'catDocuments',
  json: 'catJson',
  wasm: 'catWasm',
  manifest: 'catManifests',
  text: 'catText',
  other: 'catOther',
};

async function setLanguage(lang) {
  const targetLang = lang || 'auto';
  const { locale: resolved, messages } = await Locale.loadMessages(targetLang);
  currentMessages = messages;
  currentLocale = targetLang;
  panelPrefs.lang = targetLang;
  savePrefs();

  if (Locale.RTL.includes(resolved)) {
    document.documentElement.setAttribute('dir', 'rtl');
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
  }

  for (const [typeKey, msgKey] of Object.entries(CAT_KEY_MAP)) {
    if (TYPES[typeKey]) {
      TYPES[typeKey].label = t(msgKey, TYPES[typeKey].label) || TYPES[typeKey].label;
    }
  }

  let extVersion = '';
  try {
    extVersion = chrome.runtime.getManifest().version;
  } catch { /* noop */ }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const msg = t(key, undefined, { VERSION: extVersion });
    if (msg) SourceDownloadA11y.setText(el, msg);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    const msg = t(key, undefined, { VERSION: extVersion });
    if (msg) el.title = msg;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const msg = t(key, undefined, { VERSION: extVersion });
    if (msg) el.placeholder = msg;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const msg = t(el.getAttribute('data-i18n-aria'));
    if (msg) el.setAttribute('aria-label', msg);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    const msg = t(key, undefined, { VERSION: extVersion });
    if (msg) el.innerHTML = msg;
  });

  const langMenu = document.getElementById('lang-menu');
  if (langMenu) {
    langMenu.querySelectorAll('[data-lang]').forEach((btn) => {
      const btnLang = btn.getAttribute('data-lang');
      const isActive = (btnLang === targetLang);
      btn.classList.toggle('context-menu__item--active', isActive);
      btn.style.fontWeight = isActive ? '700' : 'normal';
    });
  }

  const currentLabel = document.getElementById('lang-current-label');
  if (currentLabel) {
    const code = resolved === 'zh_CN' ? 'ZH' : (resolved === 'pt_BR' ? 'PT' : resolved.toUpperCase());
    currentLabel.textContent = code;
  }

  if (typeof renderTabs === 'function') renderTabs();
  if (typeof renderStatus === 'function') renderStatus();
  if (typeof syncThemeButton === 'function') syncThemeButton();
  if (typeof syncTextToolbar === 'function') syncTextToolbar();
  if (typeof renderInspector === 'function') renderInspector();
  SourceDownloadA11y.apply(document);
  if (typeof render === 'function') render();
}

window.setLanguage = setLanguage;
window.t = t;

const TYPES = {
  all:      { label: getI18nMsg('catAll', 'All'),               folder: null },
  api:      { label: getI18nMsg('catApi', 'API'),               folder: 'api' },
  image:    { label: getI18nMsg('catImages', 'Images'),         folder: 'images' },
  svg:      { label: getI18nMsg('catSvg', 'SVG'),               folder: 'svg' },
  video:    { label: getI18nMsg('catVideos', 'Videos'),         folder: 'videos' },
  audio:    { label: getI18nMsg('catAudio', 'Audio'),           folder: 'audio' },
  caption:  { label: getI18nMsg('catCaptions', 'Captions'),     folder: 'captions' },
  css:      { label: getI18nMsg('catCss', 'CSS'),               folder: 'css' },
  js:       { label: getI18nMsg('catJs', 'JS'),                 folder: 'js' },
  sourcemap:{ label: getI18nMsg('catSourcemaps', 'Source maps'),folder: 'sourcemaps' },
  font:     { label: getI18nMsg('catFonts', 'Fonts'),           folder: 'fonts' },
  document: { label: getI18nMsg('catDocuments', 'Documents'),   folder: 'documents' },
  json:     { label: getI18nMsg('catJson', 'JSON'),             folder: 'json' },
  wasm:     { label: getI18nMsg('catWasm', 'WASM'),             folder: 'wasm' },
  manifest: { label: getI18nMsg('catManifests', 'Manifests'),   folder: 'manifests' },
  text:     { label: getI18nMsg('catText', 'Text'),             folder: 'text' },
  other:    { label: getI18nMsg('catOther', 'Other'),           folder: 'other' },
};

const EXT_TYPES = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
  ico: 'image', avif: 'image', bmp: 'image', jxl: 'image', jfif: 'image',
  svg: 'svg', svgz: 'svg',
  mp4: 'video', webm: 'video', mkv: 'video', mov: 'video', m4v: 'video', ogv: 'video',
  ts: 'video', m3u8: 'video', m3u: 'video', mpd: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', m4a: 'audio', aac: 'audio',
  flac: 'audio', opus: 'audio', weba: 'audio',
  vtt: 'caption', srt: 'caption', ttml: 'caption', sbv: 'caption', ass: 'caption', ssa: 'caption',
  css: 'css',
  js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', tsx: 'js',
  map: 'sourcemap',
  woff: 'font', woff2: 'font', ttf: 'font', otf: 'font', eot: 'font',
  pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document',
  ppt: 'document', pptx: 'document', txt: 'document', xml: 'document',
  html: 'document', htm: 'document', csv: 'document', md: 'document', rtf: 'document',
  zip: 'document', gz: 'document',
  json: 'json', json5: 'json', geojson: 'json',
  wasm: 'wasm',
  webmanifest: 'manifest', manifest: 'manifest',
};

// File-type detection and extension repair live in lib/filetype.js so the
// panel and the test suite share exactly one implementation.
const FT = window.SourceDownloadFileType;
const { mimeExt, sniffType } = FT;

const TYPE_DOT_COLORS = {
  all: '#9aa0ae',
  api: '#c084fc',
  image: '#38bdf8',
  svg: '#f59e0b',
  video: '#f87171',
  audio: '#eab308',
  caption: '#2dd4bf',
  css: '#818cf8',
  js: '#4ade80',
  sourcemap: '#fb7185',
  font: '#f472b6',
  document: '#fb923c',
  json: '#38bdf8',
  wasm: '#e879f9',
  manifest: '#a78bfa',
  text: '#2dd4bf',
  other: '#cbd5e1',
};

// Same hues, darkened so they stay ≥ ~4.5:1 on the light panel background.
const TYPE_DOT_COLORS_LIGHT = {
  all: '#334155',
  api: '#6d28d9',
  image: '#0369a1',
  svg: '#b45309',
  video: '#b91c1c',
  audio: '#a16207',
  caption: '#0f766e',
  css: '#5b21b6',
  js: '#15803d',
  sourcemap: '#be123c',
  font: '#be185d',
  document: '#c2410c',
  json: '#1d4ed8',
  wasm: '#a21caf',
  manifest: '#6d28d9',
  text: '#0f766e',
  other: '#334155',
};

function isLightTheme() {
  return document.documentElement.dataset.theme === 'light';
}

function typeColor(key) {
  const map = isLightTheme() ? TYPE_DOT_COLORS_LIGHT : TYPE_DOT_COLORS;
  return map[key] || map.other;
}

const ICONS = {
  download: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v7.5M4.5 7l3.5 3L11.5 7"/><path d="M2.5 12.5h11"/></svg>',
  open: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5H2.5V13.5H13.5V10"/><path d="M9 2.5h4.5V7"/><path d="M13.5 2.5L8 8"/></svg>',
  copy: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="8" height="8" rx="2"/><path d="M4 10H3a1 1 0 01-1-1V3a1 1 0 011-1h6a1 1 0 011 1v1"/></svg>',
  all: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5" opacity="0.9"/><rect x="13" y="3" width="8" height="8" rx="1.5" opacity="0.55"/><rect x="3" y="13" width="8" height="8" rx="1.5" opacity="0.55"/><rect x="13" y="13" width="8" height="8" rx="1.5" opacity="0.9"/></svg>',
  api: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8L4 12l4 4M16 8l4 4-4 4"/><path d="M14 7l-4 10" stroke-width="2"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9" r="1.7" fill="currentColor" stroke="none"/><path d="M21 16.5l-5.5-5.5-8 7.5" fill="currentColor" fill-opacity="0.35"/></svg>',
  video: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2.5" y="6" width="14" height="12" rx="2"/><path d="M16.5 10l5-2.5v9L16.5 14z" fill="currentColor" stroke="none"/></svg>',
  audio: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M9 18V5.5l11-2V16"/><circle cx="6.2" cy="18" r="2.8" fill="currentColor" stroke="none"/><circle cx="16.2" cy="16" r="2.8" fill="currentColor" stroke="none"/></svg>',
  caption: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 5h16a2 2 0 012 2v8a2 2 0 01-2 2H9l-5 3.5V7a2 2 0 012-2z" fill="currentColor" fill-opacity="0.2"/><path d="M8 10h8M8 13h5"/></svg>',
  css: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 3.5l1.5 17L12 22l6-1.5 1.5-17z" fill="currentColor" fill-opacity="0.18"/><path d="M8 8h8l-.6 7L12 16.5 8.6 15"/></svg>',
  js: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" fill-opacity="0.18"/><path d="M9 8v7.2c0 1.7 2.4 1.7 2.4 0V14" stroke-linecap="round"/><path d="M14 15.2c.5.8 1.4 1.2 2.3.5.7-.5.6-1.5-.2-1.9-.7-.4-1.6-.2-2 .5" stroke-linecap="round"/></svg>',
  sourcemap: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19V5h10l4 4v10z" fill="currentColor" fill-opacity="0.18"/><path d="M15 5v4h4"/><circle cx="10" cy="14" r="2.2"/><path d="M10 12.2V9.5M12 14.8l2 1.6"/></svg>',
  font: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19L9.2 5h2.4L17 19"/><path d="M6.4 13.5h8.2"/><path d="M18.2 19v-6.5m0 0c0-1.2.9-2 2.1-2" stroke-width="1.6"/></svg>',
  document: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" fill="currentColor" fill-opacity="0.18"/><path d="M14 3v5h5M8 12h8M8 16h6"/></svg>',
  svg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3l9 17H3z" fill="currentColor" fill-opacity="0.22"/><circle cx="12" cy="14" r="2.2" fill="currentColor" stroke="none"/></svg>',
  json: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 5H7a3 3 0 00-3 3v1.5A2.5 2.5 0 012 12a2.5 2.5 0 012 2.5V16a3 3 0 003 3h1"/><path d="M16 5h1a3 3 0 013 3v1.5A2.5 2.5 0 0122 12a2.5 2.5 0 01-2 2.5V16a3 3 0 01-3 3h-1"/></svg>',
  wasm: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 2.5l8.5 5v9L12 21.5 3.5 16.5v-9z" fill="currentColor" fill-opacity="0.18"/><path d="M8.2 9l2.2 7 1.6-4.2L13.6 16l2.2-7"/></svg>',
  manifest: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="5" y="4" width="14" height="17" rx="2" fill="currentColor" fill-opacity="0.18"/><path d="M8 4.5V3h8v1.5M8 10h8M8 14h8M8 18h5"/></svg>',
  other: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-dasharray="3 2"><rect x="3.5" y="5.5" width="17" height="13" rx="3"/></svg>',
  text: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 5h16M8 5v15M6 20h4"/><path d="M12 10h8M12 14h6" stroke-width="1.5"/></svg>',
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

// Every download runs through this so a file never lands on disk without an
// extension that matches its actual bytes.
function downloadName(res, content) {
  return FT.ensureExtension(res.filename || 'resource', res, content);
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
    if (m.includes('vtt') || m.includes('ttml') || m.includes('subrip') || m === 'text/srt') return 'caption';
    if (m.includes('sourcemap')) return 'sourcemap';
    if (m.includes('json')) {
      const ext = getExt(url);
      if (ext === 'map') return 'sourcemap';
      return 'json';
    }
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
    vtt: 'text/vtt', srt: 'application/x-subrip', ttml: 'application/ttml+xml',
    map: 'application/json',
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
  if (['css', 'js', 'svg', 'json', 'manifest', 'caption', 'sourcemap'].includes(res.type)) return true;
  if (/(text\/|application\/(json|xml|javascript|x-javascript|xhtml|manifest)|text\/vtt)/i.test(m)) return true;
  const ext = getExt(res.url);
  return [
    'json', 'map', 'html', 'htm', 'txt', 'xml', 'svg', 'css', 'js', 'mjs',
    'md', 'csv', 'tsv', 'yml', 'yaml', 'ini', 'log', 'rtf',
    'vtt', 'srt', 'ttml',
  ].includes(ext);
}

function isJsonType(res) {
  if (res.type === 'json' || res.type === 'sourcemap' || res.type === 'manifest') return true;
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

// Every successful save counts towards the review banner (see checkRatingMilestone).
function recordValueMoment() {
  try {
    chrome.runtime.sendMessage({ type: 'recordMilestone' }, () => void chrome.runtime.lastError);
  } catch { /* noop */ }
}

function saveBlob(blob, filename) {
  recordValueMoment();
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
