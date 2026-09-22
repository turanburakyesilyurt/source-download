/*
 * Source Download — Chrome DevTools panel.
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

const SUPPORTED_LOCALES = ['en', 'tr', 'es', 'zh_CN', 'ja', 'de', 'ru'];
let currentLocale = 'auto';
let currentMessages = {};
const localeCache = {};

function resolveLocale(pref) {
  if (pref && pref !== 'auto') {
    if (SUPPORTED_LOCALES.includes(pref)) return pref;
    const norm = String(pref).replace('-', '_');
    if (SUPPORTED_LOCALES.includes(norm)) return norm;
    const prefix = String(pref).split(/[-_]/)[0];
    if (SUPPORTED_LOCALES.includes(prefix)) return prefix;
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  const normNav = nav.replace('-', '_');
  if (SUPPORTED_LOCALES.includes(normNav)) return normNav;
  const prefixNav = nav.split(/[-_]/)[0];
  if (SUPPORTED_LOCALES.includes(prefixNav)) return prefixNav;
  return 'en';
}

function loadLocaleMessages(loc) {
  if (localeCache[loc]) return localeCache[loc];
  if (typeof window !== 'undefined' && window.SourceDownloadI18n && window.SourceDownloadI18n[loc]) {
    localeCache[loc] = window.SourceDownloadI18n[loc];
    return localeCache[loc];
  }
  try {
    if (typeof require === 'function') {
      const fs = require('fs');
      const path = require('path');
      const p = path.resolve(__dirname, '_locales', loc, 'messages.json');
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        const msgs = {};
        for (const [k, v] of Object.entries(raw)) {
          msgs[k] = (v && v.message) || '';
        }
        localeCache[loc] = msgs;
        return msgs;
      }
    }
  } catch { /* noop */ }
  return null;
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
  if (res && subs && typeof subs === 'object') {
    for (const [k, v] of Object.entries(subs)) {
      res = res.replaceAll('$' + k.toUpperCase() + '$', v);
    }
  }
  return res;
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

function setLanguage(lang) {
  const targetLang = lang || 'auto';
  const resolved = resolveLocale(targetLang);
  const msgs = loadLocaleMessages(resolved);
  if (msgs) {
    currentMessages = msgs;
  }
  currentLocale = targetLang;
  panelPrefs.lang = targetLang;
  savePrefs();

  for (const [typeKey, msgKey] of Object.entries(CAT_KEY_MAP)) {
    if (TYPES[typeKey]) {
      TYPES[typeKey].label = t(msgKey, TYPES[typeKey].label) || TYPES[typeKey].label;
    }
  }

  let extVersion = '1.14.0';
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
      extVersion = chrome.runtime.getManifest().version || '1.14.0';
    }
  } catch { /* noop */ }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const msg = t(key, undefined, { VERSION: extVersion });
    if (msg) el.textContent = msg;
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
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    const msg = t(key, undefined, { VERSION: extVersion });
    if (msg) {
      el.innerHTML = msg;
      const hintGuide = el.querySelector('#text-hint-guide');
      if (hintGuide) {
        hintGuide.addEventListener('click', (e) => {
          e.preventDefault();
          openGuide();
          const input = document.getElementById('guide-search');
          if (input) {
            input.value = t('catText', 'Text');
            filterGuide(input.value);
          }
        });
      }
    }
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
    const code = resolved === 'zh_CN' ? 'ZH' : resolved.toUpperCase();
    currentLabel.textContent = code;
  }

  if (typeof renderTabs === 'function') renderTabs();
  if (typeof renderStatus === 'function') renderStatus();
  if (typeof syncTextToolbar === 'function') syncTextToolbar();
  if (typeof renderInspector === 'function') renderInspector();
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
    hideDupes: false,
  },
  text: {
    blocks: [],
    tables: new Map(),
    live: true,
    sel: new Set(),
    lastSig: '',
    pill: 'all',         // all | text | tables
    // One query box, four ways to read it. `text` and `regex` filter what was
    // captured; `css` and `xpath` are resolved against the live page instead,
    // so they can reach elements the readable-text walk skips.
    query: { mode: 'text', value: '' },
    queryError: '',
    tag: 'all',         // all | heading | table | <tag name>
    level: 'all',       // all | h1 … h6
    readMode: false,
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

async function sniffOne(res) {
  res._sniffing = true;
  try {
    const content = await getContent(res);
    if (!content) return;
    const detected = sniffType(content);
    if (!detected || detected === res.type) return;
    // "document" is only promoted to clearly distinct kinds — a .txt that
    // happens to start with "function" shouldn't become a JS file.
    if (res.type === 'document' && !['json', 'svg', 'wasm', 'font', 'caption', 'sourcemap'].includes(detected)) return;
    // A query-string GET classified as API is demoted to its real category when
    // the bytes say it's a static asset; genuine JSON responses stay in API.
    if (res.type === 'api') {
      if (res._apiKind !== 'query' || detected === 'json') return;
      if (!['image', 'svg', 'js', 'css', 'wasm', 'font', 'document', 'caption', 'sourcemap'].includes(detected)) return;
      apiCount = Math.max(0, apiCount - 1);
    }
    res.type = detected;
    if ((detected === 'json' || detected === 'sourcemap') && res._beautified === undefined) res._beautified = true;
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
    scheduleDupeScan();
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

  if (typeof chrome === 'undefined' || !chrome.devtools || !chrome.devtools.inspectedWindow) return;
  chrome.devtools.inspectedWindow.eval(expr, {}, (result, info) => {
    if (info && info.isException) {
      setStatusMessage(t('statusDomScanFailed', 'DOM scan failed: $ERROR$').replace('$ERROR$', (info.value || 'unknown error')));
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
    toast(
      t('toastRefreshComplete', 'Page scan complete: $COUNT$ new resources')
        .replace('$COUNT$', added),
      'success'
    );
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
    setStatusMessage(t('statusFoundCssResources', 'Found $COUNT$ resource(s) referenced from CSS').replace('$COUNT$', added));
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
    TYPES[res.type] ? TYPES[res.type].label : '',
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
  setStatusMessage(t('statusIndexing', 'Indexing file contents…'));
  let i = 0;
  const worker = async () => {
    while (i < targets.length) {
      const r = targets[i++];
      try {
        const content = await getContent(r);
        if (content !== null && content !== undefined && content !== '') {
          state.contentIndex.set(r.url, await indexContentAsync(content));
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
    f.method || f.reqType || f.hideDupes
  );
}

function filteredResources() {
  const raw = state.search.trim();
  const matcher = raw ? compileSearch(raw) : null;
  const f = state.filters;
  const tab = state.activeTab;
  const minBytes = parseFloat(f.minSize) * 1024;
  const maxBytes = parseFloat(f.maxSize) * 1024;
  const minW = parseFloat(f.minWidth);
  const minH = parseFloat(f.minHeight);
  const method = f.method ? f.method.toUpperCase() : '';
  const reqType = f.reqType ? f.reqType.toLowerCase() : '';

  // A single pass, rather than a chain of .filter() calls that would each
  // allocate another array every time the list re-renders.
  const list = [];
  for (const r of state.resources) {
    if (tab !== 'all' && r.type !== tab) continue;
    if (matcher && !matchesSearch(r, matcher)) continue;
    if (minBytes && (r.size || 0) < minBytes) continue;
    if (maxBytes && (r.size || 0) > maxBytes) continue;
    // Resources without a known size are kept until they can be measured.
    if (minW && r.width && r.width < minW) continue;
    if (minH && r.height && r.height < minH) continue;
    if (method && (r.method || 'GET').toUpperCase() !== method) continue;
    if (reqType && (r.resourceType || '').toLowerCase() !== reqType) continue;
    if (f.hideDupes && r.dupeCount > 1 && !r.dupePrimary) continue;
    list.push(r);
  }

  // Sort keys are derived once per resource instead of on every comparison,
  // which matters most for the default name sort and its toLowerCase().
  const dir = f.sortDir === 'desc' ? -1 : 1;
  const sortBy = f.sortBy;
  const keyed = list.map((r) => ({
    r,
    key:
      sortBy === 'size' ? r.size || 0 :
      sortBy === 'type' ? r.type :
      sortBy === 'time' ? r.time || 0 :
      r.filename.toLowerCase(),
  }));
  keyed.sort((a, b) => (a.key < b.key ? -dir : a.key > b.key ? dir : 0));
  return keyed.map((x) => x.r);
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

/*
 * Builds the expression evaluated inside the inspected page.
 *
 * Default mode walks the whole document in DOM order and returns every element
 * that carries its own text, tagged with its element name, so the panel can
 * present a readable version of the page and let the user narrow it down
 * afterwards. Nested duplicates are skipped: once a parent holds text, its
 * children are rejected.
 *
 * `css` and `xpath` modes resolve the query against the live page instead and
 * return only what matched, together with any error the page reported so the
 * panel can show it verbatim.
 */
function textCaptureExpr(mode, query) {
  return '(function () {' +
    'var out = [];' +
    'var err = "";' +
    'var MODE = ' + JSON.stringify(mode) + ';' +
    'var Q = ' + JSON.stringify(query) + ';' +
    'function hasDirectText(el) {' +
    '  for (var i = 0; i < el.childNodes.length; i++) {' +
    '    if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent.trim()) return true;' +
    '  }' +
    '  return false;' +
    '}' +
    'function isTable(el) {' +
    '  return el.tagName === "TABLE" || (el.getAttribute && el.getAttribute("role") === "table");' +
    '}' +
    'function sigFor(rows) {' +
    '  return JSON.stringify(rows[0] || []) + "|" + Math.max.apply(null, rows.map(function (r) { return r.length; }).concat(0));' +
    '}' +
    'function cellsOf(tr) {' +
    '  var cells = [];' +
    '  tr.querySelectorAll("th, td, [role=cell], [role=columnheader], [role=rowheader]").forEach(function (td) {' +
    '    var t = (td.innerText || "").trim();' +
    '    if (t.length > 300) t = t.slice(0, 300) + "\\u2026";' +
    '    cells.push(t);' +
    '  });' +
    '  return cells;' +
    '}' +
    // A short "where did this come from" hint shown next to each block.
    'function whereOf(el) {' +
    '  var s = el.tagName ? el.tagName.toLowerCase() : "";' +
    '  if (el.id) s += "#" + el.id;' +
    '  else if (el.classList && el.classList.length) s += "." + Array.prototype.slice.call(el.classList, 0, 2).join(".");' +
    '  return s.slice(0, 80);' +
    '}' +
    'function captureTable(el) {' +
    '  var trs = el.querySelectorAll("tr, [role=row]");' +
    '  var preview = [];' +
    '  for (var j = 0; j < Math.min(trs.length, 3); j++) {' +
    '    var c = cellsOf(trs[j]);' +
    '    if (c.length) preview.push(c);' +
    '  }' +
    '  if (preview.length) {' +
    '    out.push({ kind: "table", rowCount: trs.length, preview: preview, sig: sigFor(preview), where: whereOf(el) });' +
    '  }' +
    '}' +
    'function captureEl(el, forced) {' +
    '  if (!el || el.nodeType !== 1) return;' +
    '  if (isTable(el)) { captureTable(el); return; }' +
    '  var t = (el.innerText || el.textContent || "").trim();' +
    '  if (!t) return;' +
    '  var tag = el.tagName.toLowerCase();' +
    '  out.push({ kind: tag, text: t.slice(0, /^h[1-6]$/.test(tag) ? 1000 : 3000), where: whereOf(el), matched: !!forced });' +
    '}' +
    'if (MODE === "css" || MODE === "xpath") {' +
    '  var nodes = [];' +
    '  try {' +
    '    if (MODE === "css") {' +
    '      nodes = Array.prototype.slice.call(document.querySelectorAll(Q));' +
    '    } else {' +
    '      var snap = null;' +
    '      try {' +
    '        snap = document.evaluate(Q, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);' +
    '      } catch (inner) {' +
    // Expressions like count(//a) or string(//title) are not node sets; show
    // their scalar result rather than calling the query invalid.
    '        var any = document.evaluate(Q, document, null, XPathResult.ANY_TYPE, null);' +
    '        var val = any.resultType === XPathResult.NUMBER_TYPE ? any.numberValue' +
    '          : any.resultType === XPathResult.BOOLEAN_TYPE ? any.booleanValue' +
    '          : any.stringValue;' +
    '        out.push({ kind: "value", text: String(val), where: "xpath", matched: true });' +
    '        return { blocks: out, error: "", count: 1 };' +
    '      }' +
    '      for (var i = 0; i < snap.snapshotLength; i++) nodes.push(snap.snapshotItem(i));' +
    '    }' +
    '  } catch (e) {' +
    '    err = (e && e.message) || "invalid query";' +
    '  }' +
    '  for (var k = 0; k < nodes.length && k < 5000; k++) {' +
    '    var n = nodes[k];' +
    '    if (n.nodeType === 1) captureEl(n, true);' +
    '    else if (n.nodeValue && n.nodeValue.trim()) {' +
    '      out.push({ kind: n.nodeType === 2 ? "attr" : "text", text: n.nodeValue.trim().slice(0, 3000), where: n.nodeName, matched: true });' +
    '    }' +
    '  }' +
    '  return { blocks: out, error: err, count: nodes.length };' +
    '}' +
    'var F = NodeFilter;' +
    'var walker = document.createTreeWalker(document.body, F.SHOW_ELEMENT, {' +
    '  acceptNode: function (el) {' +
    '    var p = el.parentElement;' +
    '    while (p) {' +
    '      if (isTable(p)) return F.FILTER_REJECT;' +
    '      if (hasDirectText(p)) return F.FILTER_REJECT;' +
    '      p = p.parentElement;' +
    '    }' +
    '    if (isTable(el)) return F.FILTER_ACCEPT;' +
    '    if (hasDirectText(el)) return F.FILTER_ACCEPT;' +
    '    return F.FILTER_SKIP;' +
    '  }' +
    '});' +
    'var node;' +
    'while ((node = walker.nextNode())) captureEl(node, false);' +
    'return { blocks: out, error: "", count: out.length };' +
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

// CSS/XPath queries run inside the page; text and regex queries filter what
// the default whole-page walk already captured.
function pageQuery() {
  const q = state.text.query;
  const mode = q.mode === 'css' || q.mode === 'xpath' ? q.mode : 'all';
  const value = q.value.trim();
  return mode !== 'all' && value ? { mode, value } : { mode: 'all', value: '' };
}

async function pollTextOnce(silent) {
  if (textPolling) return;
  textPolling = true;
  try {
    const pq = pageQuery();
    const result = await evalText(textCaptureExpr(pq.mode, pq.value));
    const blocks = result && result.blocks ? result.blocks : null;
    const prevError = state.text.queryError;
    state.text.queryError = (result && result.error) || '';
    if (!blocks || !blocks.length) {
      // An empty result is meaningful for a query — show it instead of
      // leaving the previous matches on screen.
      if (pq.mode !== 'all' || state.text.queryError !== prevError) {
        state.text.blocks = [];
        state.text.lastSig = 'empty\u0001' + state.text.queryError;
        if (silent) renderTabs();
        else render();
      }
      return;
    }
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
          where: b.where || '',
          firstSeen: hist.snapshots.length ? hist.snapshots[0].ts : now,
          ts: now,
        });
      } else {
        const key = b.kind + '\u0000' + (b.where || '') + '\u0000' + b.text;
        const id = nextTextId();
        if (selKeys.has(key)) state.text.sel.add(id);
        newBlocks.push({
          id, key, ts: now,
          kind: b.kind,
          text: b.text,
          where: b.where || '',
          matched: !!b.matched,
        });
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

function textBlockHaystack(b) {
  return b.kind === 'table' ? b.rows.map((r) => r.join(' ')).join(' ') : b.text || '';
}

// Compiles the query box into a predicate. CSS/XPath already ran in the page,
// so those modes match everything that came back.
function compileTextQuery() {
  const { mode, value } = state.text.query;
  const v = value.trim();
  if (!v || mode === 'css' || mode === 'xpath') return { test: null, error: '' };
  if (mode === 'regex') {
    try {
      const re = new RegExp(v, 'i');
      return { test: (s) => re.test(s), error: '' };
    } catch (e) {
      return { test: null, error: e.message || 'invalid regular expression' };
    }
  }
  const lower = v.toLowerCase();
  return { test: (s) => s.toLowerCase().includes(lower), error: '' };
}

function filteredTextBlocks() {
  const t = state.text;
  const { test } = compileTextQuery();
  return t.blocks.filter((b) => {
    if (t.pill === 'tables' && b.kind !== 'table') return false;
    if (t.pill === 'text' && b.kind === 'table') return false;
    if (t.tag === 'heading') {
      if (!/^h[1-6]$/.test(b.kind)) return false;
      if (t.level !== 'all' && b.kind !== t.level) return false;
    } else if (t.tag !== 'all' && b.kind !== t.tag) {
      return false;
    }
    if (test && !test(textBlockHaystack(b))) return false;
    return true;
  });
}

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return t('timeSecondsAgo', '$COUNT$s ago').replace('$COUNT$', s);
  const m = Math.round(s / 60);
  if (m < 60) return t('timeMinutesAgo', '$COUNT$m ago').replace('$COUNT$', m);
  return new Date(ts).toLocaleTimeString();
}

// The element dropdown lists what the page actually contains, with a count
// beside each entry, so it doubles as a map of the captured document.
function syncTextTagOptions() {
  const sel = document.getElementById('tf-kind');
  if (!sel) return;
  const counts = new Map();
  let headings = 0;
  for (const b of state.text.blocks) {
    if (/^h[1-6]$/.test(b.kind)) headings++;
    counts.set(b.kind, (counts.get(b.kind) || 0) + 1);
  }
  const allLabel = t('textAllElements', 'All elements') || 'All elements';
  const headingsLabel = t('textHeadings', 'Headings') || 'Headings';
  const opts = [['all', `${allLabel} (${state.text.blocks.length})`]];
  if (headings) opts.push(['heading', `${headingsLabel} (${headings})`]);
  for (const tag of [...counts.keys()].sort()) {
    if (/^h[1-6]$/.test(tag)) continue;
    opts.push([tag, tag.toUpperCase() + ' (' + counts.get(tag) + ')']);
  }
  // Never drop the active choice, even when the page momentarily has none.
  if (!opts.some(([v]) => v === state.text.tag)) {
    opts.push([state.text.tag, state.text.tag.toUpperCase() + ' (0)']);
  }

  // Counts move on every poll of a live page; rebuilding the list while it is
  // open would yank it out from under the pointer.
  if (document.activeElement === sel) return;

  const signature = opts.map(([v, l]) => v + '\u0000' + l).join('\u0001');
  if (sel.dataset.sig !== signature) {
    sel.dataset.sig = signature;
    sel.innerHTML = '';
    for (const [value, label] of opts) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      sel.appendChild(opt);
    }
  }
  if (sel.value !== state.text.tag) sel.value = state.text.tag;
}

function getQueryPlaceholder(mode) {
  switch (mode) {
    case 'regex':
      return t('textPlaceholderRegex', '^Price:\\s*\\d+  — JavaScript regular expression');
    case 'css':
      return t('textPlaceholderCss', '.product-card .price, article h2 — any CSS selector');
    case 'xpath':
      return t('textPlaceholderXpath', '//div[@class="row"]//td[2]  ·  count(//a)  ·  //@href');
    case 'text':
    default:
      return t('textPlaceholder', 'Filter page text or query live DOM…');
  }
}

function updateTextSelectionUI() {
  const count = state.text.sel.size;
  const badge = document.getElementById('tf-sel-badge');
  if (badge) {
    badge.hidden = count === 0;
    badge.textContent = count + ' ' + (t('statusSelected', 'selected') || 'selected');
  }
  const clearBtn = document.getElementById('tf-clear-sel');
  if (clearBtn) {
    clearBtn.hidden = count === 0;
  }
  const selectAllBtn = document.getElementById('tf-select-all');
  if (selectAllBtn) {
    const visible = filteredTextBlocks();
    const allSelected = visible.length > 0 && visible.every((b) => state.text.sel.has(b.id));
    selectAllBtn.textContent = allSelected ? t('textDeselectAll', 'Deselect All') : t('textSelectAll', 'Select All');
  }
}

function syncTextToolbar() {
  const liveBtn = document.getElementById('tf-live');
  if (liveBtn) {
    liveBtn.classList.toggle('btn--primary', state.text.live);
    liveBtn.textContent = state.text.live
      ? (t('textLiveOn', 'Live on') || 'Live on')
      : (t('textLiveOff', 'Live off') || 'Live off');
  }
  const mode = document.getElementById('tf-mode');
  if (mode && mode.value !== state.text.query.mode) mode.value = state.text.query.mode;
  const input = document.getElementById('tf-query');
  if (input) {
    if (document.activeElement !== input && input.value !== state.text.query.value) {
      input.value = state.text.query.value;
    }
    input.placeholder = getQueryPlaceholder(state.text.query.mode);
  }
  const levelSel = document.getElementById('tf-level');
  if (levelSel) {
    levelSel.hidden = state.text.tag !== 'heading';
    if (levelSel.value !== state.text.level) levelSel.value = state.text.level;
  }
  const textView = document.getElementById('text-view');
  if (textView) textView.classList.toggle('text-view--read', !!state.text.readMode);
  const readBtn = document.getElementById('tf-read');
  if (readBtn) {
    readBtn.classList.toggle('btn--primary', !!state.text.readMode);
    readBtn.textContent = state.text.readMode
      ? (t('textReadingOn', 'Reading on') || 'Reading on')
      : (t('textReading', 'Reading') || 'Reading');
  }

  const pill = state.text.pill || 'all';
  const pillAll = document.getElementById('tf-pill-all');
  if (pillAll) pillAll.classList.toggle('tf-pill--active', pill === 'all');
  const pillText = document.getElementById('tf-pill-text');
  if (pillText) pillText.classList.toggle('tf-pill--active', pill === 'text');
  const pillTables = document.getElementById('tf-pill-tables');
  if (pillTables) pillTables.classList.toggle('tf-pill--active', pill === 'tables');
  const groupTag = document.getElementById('tf-group-tag');
  if (groupTag) groupTag.hidden = pill === 'tables';

  updateTextSelectionUI();
  syncTextTagOptions();
}

// One line under the query box: how many blocks matched, or exactly what the
// page said about a broken selector / regular expression.
function renderTextStatus(shown) {
  const el = document.getElementById('tf-query-status');
  if (!el) return;
  const { mode, value } = state.text.query;
  const local = compileTextQuery();
  const error = state.text.queryError || local.error;
  if (error) {
    el.className = 'tf-status tf-status--error';
    el.textContent = (mode === 'xpath' ? 'XPath: ' : mode === 'css' ? 'Selector: ' : 'Regex: ') + error;
    return;
  }
  el.className = 'tf-status';
  if (!value.trim()) {
    el.textContent = '';
    return;
  }
  el.textContent = shown + ' ' + (shown === 1 ? (t('textMatch', 'match') || 'match') : (t('textMatches', 'matches') || 'matches'));
}

// The captured document is rendered in windows too — a content-heavy page can
// produce well over a thousand blocks, and tables add rows on top of that.
const TEXT_CHUNK = 80;
let textWindow = null;
let textObserver = null;

function teardownTextWindow() {
  if (textObserver) {
    textObserver.disconnect();
    textObserver = null;
  }
  textWindow = null;
}

function appendTextChunk() {
  if (!textWindow) return;
  const { stream, blocks, sentinel } = textWindow;
  const end = Math.min(textWindow.index + TEXT_CHUNK, blocks.length);
  const frag = document.createDocumentFragment();
  for (let i = textWindow.index; i < end; i++) frag.appendChild(renderTextBlock(blocks[i]));
  stream.insertBefore(frag, sentinel);
  textWindow.index = end;

  if (end >= blocks.length) {
    teardownTextWindow();
    sentinel.remove();
  } else if (textObserver) {
    textObserver.unobserve(sentinel);
    textObserver.observe(sentinel);
  }
}

function renderTextView() {
  teardownTextWindow();
  syncTextToolbar();

  const stream = document.getElementById('text-stream');
  if (!stream) return;
  stream.innerHTML = '';
  const blocks = filteredTextBlocks();
  renderTextStatus(blocks.length);

  const queryActive = !!state.text.query.value.trim();
  if (!state.text.blocks.length) {
    const empty = document.createElement('div');
    empty.className = 'text-empty';
    empty.innerHTML = state.text.queryError
      ? `<p>${t('textEmptyQueryReject', 'The page rejected that query. Fix it above and the results will come straight back.')}</p>`
      : queryActive
        ? `<p>${t('textEmptyNoMatch', 'No element on the page matches this query. Try a looser selector, or switch the mode next to the box.')}</p>`
        : '<svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5V3h14v2M12 3v18M9 21h6"/></svg>' +
          `<p>${t('textEmptyInitial', 'Nothing captured yet. Live capture is running — the whole page will appear here as readable text.')}</p>`;
    stream.appendChild(empty);
    return;
  }
  if (!blocks.length) {
    const empty = document.createElement('div');
    empty.className = 'text-empty';
    empty.innerHTML = `<p>${t('textEmptyFiltered', 'Nothing matches the current query and element filter.')}</p>`;
    stream.appendChild(empty);
    return;
  }

  stream.appendChild(renderTextSummary(blocks));

  const sentinel = document.createElement('div');
  sentinel.className = 'text-sentinel';
  stream.appendChild(sentinel);
  textWindow = { stream, blocks, sentinel, index: 0 };

  if (window.IntersectionObserver) {
    textObserver = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) appendTextChunk();
      },
      { root: stream, rootMargin: '900px 0px' }
    );
    textObserver.observe(sentinel);
  }
  appendTextChunk();
  if (!window.IntersectionObserver) {
    while (textWindow) appendTextChunk();
  }
}

// A one-line read-out of what is on screen and what an export will contain,
// with the words/characters count people usually want from a text tool.
function renderTextSummary(shown) {
  const summary = document.createElement('div');
  summary.className = 'text-summary';

  const tables = shown.filter((b) => b.kind === 'table');
  let words = 0;
  let chars = 0;
  for (const b of shown) {
    if (b.kind === 'table') continue;
    const blockText = b.text || '';
    chars += blockText.length;
    if (blockText.trim()) words += blockText.trim().split(/\s+/).length;
  }

  const chips = [
    t('textSummaryBlocks', '$COUNT$ blocks').replace('$COUNT$', shown.length),
    t('textSummaryWords', '$COUNT$ words').replace('$COUNT$', words.toLocaleString()),
    t('textSummaryChars', '$COUNT$ characters').replace('$COUNT$', chars.toLocaleString()),
  ];
  if (tables.length) {
    const rows = tables.reduce(
      (n, b) => n + dedupeRows(b.hist.snapshots.flatMap((s) => s.rows)).length,
      0
    );
    chips.push(
      t('textSummaryTables', '$TABLES$ table(s) · $ROWS$ unique rows')
        .replace('$TABLES$', tables.length)
        .replace('$ROWS$', rows)
    );
  }
  if (state.text.sel.size) {
    chips.push(
      t('textSummarySelected', '$COUNT$ selected — exports use these only')
        .replace('$COUNT$', state.text.sel.size)
    );
  }

  for (const text of chips) {
    const chip = document.createElement('span');
    chip.className = 'text-summary__chip';
    chip.textContent = text;
    summary.appendChild(chip);
  }

  const copy = document.createElement('button');
  copy.className = 'btn btn--sm text-summary__copy';
  copy.textContent = t('textBtnCopy', 'Copy text');
  copy.title = t('textBtnCopy', 'Copy text');
  copy.addEventListener('click', () => {
    copyText(plainTextOf(shown));
    toast(
      t('toastCopiedBlocks', 'Copied $COUNT$ block(s)').replace('$COUNT$', shown.length),
      'success'
    );
  });
  summary.appendChild(copy);
  return summary;
}

function blockCheckbox(b, container) {
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'txt-block__check';
  check.checked = state.text.sel.has(b.id);
  check.title = t('textIncludeInExports', 'Include in exports');
  check.addEventListener('click', (e) => e.stopPropagation());
  check.addEventListener('change', () => {
    if (check.checked) state.text.sel.add(b.id);
    else state.text.sel.delete(b.id);
    container.classList.toggle('txt-block--sel', check.checked);
    updateTextSelectionUI();
  });
  return check;
}

// Plain-text rendering of what is on screen, used by "Copy text" and the TXT
// export. Headings keep their weight through blank lines, tables become
// tab-separated rows so they paste straight into a spreadsheet.
function plainTextOf(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.kind === 'table') {
      const rows = tableRowsFor(b);
      out.push(rows.map((r) => r.join('\t')).join('\n'));
    } else if (/^h[1-6]$/.test(b.kind)) {
      out.push('\n' + b.text);
    } else {
      out.push(b.text);
    }
  }
  return out.join('\n\n').trim() + '\n';
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
    (b.matched ? ' txt-block--match' : '') +
    (state.text.sel.has(b.id) ? ' txt-block--sel' : '');
  el.dataset.id = b.id;

  if (isTable) {
    renderTextTable(el, b);
    return el;
  }

  el.appendChild(blockCheckbox(b, el));

  const tag = document.createElement('span');
  tag.className = 'txt-block__tag';
  tag.textContent = b.kind.toUpperCase();
  if (b.where) tag.title = b.where;
  el.appendChild(tag);

  const text = document.createElement('span');
  text.className = 'txt-block__text';
  text.textContent = b.text;
  el.appendChild(text);

  // Where on the page this came from — invaluable when a query returns a
  // dozen look-alike blocks and you need to tell them apart.
  if (b.where) {
    const where = document.createElement('span');
    where.className = 'txt-block__where';
    where.textContent = b.where;
    where.title = 'Matched element: ' + b.where;
    el.appendChild(where);
  }

  const copyBtn = document.createElement('button');
  copyBtn.className = 'txt-block__copy-btn';
  copyBtn.title = t('textBtnCopy', 'Copy text');
  copyBtn.textContent = '📋';
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyText(b.text || '');
    toast(t('toastCopiedToClipboard', 'Copied to clipboard'), 'success');
  });
  el.appendChild(copyBtn);

  return el;
}

// What the table shows right now: either the newest snapshot, or every unique
// row seen since capture started — which is exactly what an export contains.
function tableRowsFor(b) {
  if (!b.hist) return b.rows || [];
  return b.hist.merged
    ? dedupeRows(b.hist.snapshots.flatMap((s) => s.rows))
    : b.rows || [];
}

function renderTextTable(el, b) {
  const head = document.createElement('div');
  head.className = 'txt-table__head';
  head.appendChild(blockCheckbox(b, el));

  const tag = document.createElement('span');
  tag.className = 'txt-block__tag txt-block__tag--table';
  tag.textContent = 'TBL';
  head.appendChild(tag);

  const unique = dedupeRows(b.hist.snapshots.flatMap((s) => s.rows)).length;
  const shownRows = tableRowsFor(b);

  const title = document.createElement('span');
  title.className = 'txt-table__title';
  title.textContent = b.hist.merged
    ? t('textTableAllRows', 'Table — all $COUNT$ unique row(s)').replace('$COUNT$', unique)
    : t('textTableOnScreen', 'Table — $COUNT$ row(s) on screen').replace('$COUNT$', b.rowCount);
  head.appendChild(title);

  const meta = document.createElement('span');
  meta.className = 'txt-table__meta';
  const parts = [
    t('textTableSnapshots', '$COUNT$ snapshot(s)').replace('$COUNT$', b.hist.snapshots.length),
    t('textTableUniqueRows', '$COUNT$ unique row(s)').replace('$COUNT$', unique),
    t('textTableUpdated', 'updated $TIME$').replace('$TIME$', timeAgo(b.ts)),
  ];
  if (b.hist.snapshots.length > 1) parts.push('since ' + timeAgo(b.firstSeen));
  meta.textContent = parts.join(' · ');
  head.appendChild(meta);

  // The most useful control on a dynamic table: see everything collected so
  // far, not just whatever the page happens to be showing this second.
  if (unique > (b.rows ? b.rows.length : 0) || b.hist.merged) {
    const mergeBtn = document.createElement('button');
    mergeBtn.className = 'btn btn--sm' + (b.hist.merged ? ' btn--primary' : '');
    mergeBtn.textContent = b.hist.merged
      ? t('textTableShowingAll', 'Showing all rows')
      : t('textTableShowAll', 'Show all $COUNT$ rows').replace('$COUNT$', unique);
    mergeBtn.title = t('tableMergeSnapshotsTitle', 'Combine every snapshot into one deduplicated table — this is what gets exported');
    mergeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      b.hist.merged = !b.hist.merged;
      renderTextView();
    });
    head.appendChild(mergeBtn);
  }

  if (b.hist.snapshots.length > 1) {
    const histBtn = document.createElement('button');
    histBtn.className = 'btn btn--sm txt-table__history';
    histBtn.textContent = b.hist.expanded
      ? t('textTableHideHistory', 'Hide history')
      : t('textTableHistory', 'History ($COUNT$)').replace('$COUNT$', b.hist.snapshots.length - 1);
    histBtn.title = t('tableBrowseSnapshotsTitle', 'Browse earlier snapshots of this table');
    histBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      b.hist.expanded = !b.hist.expanded;
      renderTextView();
    });
    head.appendChild(histBtn);
  }

  const actions = document.createElement('div');
  actions.className = 'txt-table__actions';

  const xlsxBtn = document.createElement('button');
  xlsxBtn.className = 'btn btn--sm btn--primary';
  xlsxBtn.textContent = t('textBtnExportXlsx', '⬇ XLSX');
  xlsxBtn.title = 'Download this table as Excel (.xlsx)';
  xlsxBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportSingleTable(b, 'xlsx');
  });
  actions.appendChild(xlsxBtn);

  const csvBtn = document.createElement('button');
  csvBtn.className = 'btn btn--sm';
  csvBtn.textContent = t('textBtnExportCsv', '⬇ CSV');
  csvBtn.title = t('tableDownloadCsvTitle', 'Download this table as CSV');
  csvBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportSingleTable(b, 'csv');
  });
  actions.appendChild(csvBtn);

  const copyTableBtn = document.createElement('button');
  copyTableBtn.className = 'btn btn--sm';
  copyTableBtn.textContent = t('textBtnCopyTable', '📋 Copy');
  copyTableBtn.title = 'Copy table rows (TSV) to clipboard';
  copyTableBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const rows = tableRowsFor(b);
    copyText(rows.map((r) => r.join('\t')).join('\n'));
    toast(t('toastTableCopied', 'Table copied to clipboard'), 'success');
  });
  actions.appendChild(copyTableBtn);

  head.appendChild(actions);
  el.appendChild(head);

  const wrap = document.createElement('div');
  wrap.className = 'txt-table__wrap';
  const tbl = document.createElement('table');
  tbl.className = 'txt-table';
  if (shownRows.length) {
    const maxCols = Math.max(...shownRows.map((r) => r.length));
    for (const row of shownRows) {
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
    td.textContent = t('textTableNoRows', 'No rows captured yet.');
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
      st.textContent = t('tableSnapshotLabel', 'Snapshot $INDEX$ — $TIME$ ($COUNT$ rows)')
        .replace('$INDEX$', s + 1)
        .replace('$TIME$', timeAgo(snap.ts))
        .replace('$COUNT$', snap.rows.length);
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

// The whole readable page, exactly as shown, as a plain .txt file.
function exportTextPlain() {
  const blocks = exportTextSelection();
  if (!blocks.length) {
    toast(t('toastNothingToExport', 'Nothing to export'));
    return;
  }
  saveBlob(new Blob([plainTextOf(blocks)], { type: 'text/plain' }), 'text/page-text.txt');
  toast(t('toastExportedTxt', 'Exported $COUNT$ block(s) as TXT').replace('$COUNT$', blocks.length));
}

function exportTextMarkdown() {
  const blocks = exportTextSelection();
  if (!blocks.length) {
    toast(t('toastNothingToExport', 'Nothing to export'));
    return;
  }
  const lines = [];
  for (const b of blocks) {
    if (b.kind === 'table') {
      const rows = tableRowsFor(b);
      if (!rows.length) continue;
      const cols = Math.max(...rows.map((r) => r.length));
      const pad = (r) => Array.from({ length: cols }, (_, i) => String(r[i] || '').replace(/\|/g, '\\|'));
      lines.push(
        '| ' + pad(rows[0]).join(' | ') + ' |\n' +
        '| ' + Array(cols).fill('---').join(' | ') + ' |\n' +
        rows.slice(1).map((r) => '| ' + pad(r).join(' | ') + ' |').join('\n')
      );
    } else if (/^h[1-6]$/.test(b.kind)) {
      lines.push('#'.repeat(+b.kind[1]) + ' ' + b.text);
    } else if (b.kind === 'li') {
      lines.push('- ' + b.text);
    } else {
      lines.push(b.text);
    }
  }
  if (!lines.length) {
    toast(t('toastNothingToExport', 'Nothing to export'));
    return;
  }
  const blob = new Blob([lines.join('\n\n')], { type: 'text/markdown' });
  saveBlob(blob, 'text/page-content.md');
  toast(t('toastExportedMd', 'Exported $COUNT$ block(s) as Markdown').replace('$COUNT$', lines.length));
}

async function exportSingleTable(b, format) {
  const rows = tableRowsFor(b);
  if (!rows || !rows.length) {
    toast(t('toastNoTableRows', 'No table rows captured'), 'error');
    return;
  }
  const cleanTitle = (b.title || 'table').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  if (format === 'csv') {
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
    saveBlob(new Blob([csv], { type: 'text/csv' }), 'text/' + cleanTitle + '.csv');
    toast(t('toastExportedCsv', 'Exported table as CSV'), 'success');
  } else if (format === 'xlsx') {
    const blob = await buildXlsx([{ name: 'Table', rows }]);
    saveBlob(blob, 'text/' + cleanTitle + '.xlsx');
    toast(t('toastExportedXlsx', 'Exported table as XLSX'), 'success');
  }
}

async function exportTablesAs(format) {
  const tables = exportTableItems();
  if (!tables.length) {
    toast(t('toastNoTableRows', 'No table data captured'));
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
  const zip = await buildZip(entries);
  saveBlob(zip, format === 'csv' ? 'text/tables.csv.zip' : 'text/tables.html.zip');
  toast(t('toastExportedTablesZip', 'Exported $COUNT$ table(s) as $FORMAT$').replace('$COUNT$', entries.length).replace('$FORMAT$', format.toUpperCase()));
}

async function exportTextXlsx() {
  const tables = exportTableItems();
  if (!tables.length) {
    toast(t('toastNoTableRows', 'No table data captured'));
    return;
  }
  const sheets = tables.map((t, i) => ({ name: ('Table ' + (i + 1)).slice(0, 31), rows: t.rows }));
  const blob = await buildXlsx(sheets);
  saveBlob(blob, 'text/tables.xlsx');
  toast(t('toastExportedSheetsXlsx', 'Exported $COUNT$ sheet(s) as XLSX').replace('$COUNT$', sheets.length));
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
    teardownListWindow();
    renderTextView();
    ensureTextPoll();
  } else {
    stopTextPoll();
    renderList();
    renderFilterBar();
    renderStatus();
    ensureBgTextPoll();
    if (state.activeTab === 'image' || state.filters.hideDupes) scheduleDupeScan();
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
  const hideDupes = document.getElementById('f-hide-dupes');
  if (hideDupes) {
    hideDupes.hidden = state.activeTab !== 'image';
    hideDupes.classList.toggle('btn--primary', !!f.hideDupes);
  }
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
  if (!targets.length) return;
  const CONC = 3;
  let i = 0;
  const worker = async () => {
    while (i < targets.length) {
      const r = targets[i++];
      r._decoding = true;
      try {
        const content = await getContent(r);
        if (!content) continue;
        const mime = r.mimeType || (r.type === 'svg' ? 'image/svg+xml' : '');
        const size = await measureImageSize(content, mime);
        if (size && size.width) {
          r.width = size.width;
          r.height = size.height;
        } else {
          r.width = 0;
          r.height = 0;
        }
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

function refreshDupeMarks() {
  const groups = new Map();
  for (const r of state.resources) {
    r.dupeCount = 0;
    r.dupePrimary = false;
    if (r.type !== 'image' || !r.dupeKey) continue;
    let g = groups.get(r.dupeKey);
    if (!g) {
      g = [];
      groups.set(r.dupeKey, g);
    }
    g.push(r);
  }
  let extra = 0;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    extra += g.length - 1;
    g[0].dupePrimary = true;
    for (const r of g) r.dupeCount = g.length;
  }
  return extra;
}

let dupeScanRun = null;
let dupeScanTimer = null;

function scheduleDupeScan() {
  if (state.activeTab !== 'image' && !state.filters.hideDupes) return;
  if (dupeScanTimer) return;
  dupeScanTimer = setTimeout(() => {
    dupeScanTimer = null;
    scanImageDupes();
  }, 700);
}

async function scanImageDupes() {
  if (dupeScanRun) return dupeScanRun;
  const targets = state.resources.filter(
    (r) => r.type === 'image' && !r.dupeKey && !r._hashing
  );
  if (!targets.length) {
    const extra = refreshDupeMarks();
    const el = document.getElementById('status-dupes');
    if (el) {
      el.hidden = extra === 0;
      if (extra) el.textContent = t('statusDuplicateImages', '$COUNT$ duplicate images').replace('$COUNT$', extra);
    }
    return null;
  }
  setStatusMessage(t('statusCheckingDuplicates', 'Checking image duplicates…'));
  let i = 0;
  const worker = async () => {
    while (i < targets.length) {
      const r = targets[i++];
      r._hashing = true;
      try {
        const content = await getContent(r);
        r.dupeKey = content ? await hashContentAsync(content) : 'empty:' + r.id;
      } catch {
        r.dupeKey = 'fail:' + r.id;
      }
    }
  };
  dupeScanRun = Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker)).then(() => {
    dupeScanRun = null;
    refreshDupeMarks();
    setStatusMessage('');
    render();
  });
  return dupeScanRun;
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
  const counts = { all: 0 };
  for (const k of Object.keys(TYPES)) {
    if (k !== 'all' && k !== 'text') counts[k] = 0;
  }
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
    if (!t) continue;
    const tab = document.createElement('button');
    tab.className = 'vtab' + (key === state.activeTab ? ' vtab--active' : '');
    tab.dataset.tab = key;
    tab.title = t.label;
    tab.style.setProperty('--tab-color', typeColor(key));
    tab.innerHTML =
      '<span class="vtab__icon">' + (ICONS[key] || ICONS.other) + '</span>' +
      '<span class="vtab__label">' + t.label + '</span>' +
      '<span class="vtab__count">' + (key === 'all' ? state.resources.length : key === 'text' ? state.text.blocks.length : counts[key] || 0) + '</span>';
    tab.addEventListener('click', () => {
      state.activeTab = key;
      // A category switch must always start fresh: reset every resource filter
      // and the search box so a leftover filter (e.g. POST from the API tab)
      // can never silently empty another category.
      state.filters = emptyResourceFilters();
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
    thumb.style.color = typeColor(res.type);
    thumb.innerHTML = ICONS[res.type] || ICONS.other;
  }

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'card__check';
  check.checked = state.selected.has(res.id);
  check.title = t('cardToggleBatchTitle', 'Toggle selection for batch download');
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
  parts.push((TYPES[res.type] || TYPES.other).label);
  if (res.size) parts.push(formatBytes(res.size));
  if (res.dupeCount > 1) parts.push('<span class="dupe-chip" title="Same bytes as ' + (res.dupeCount - 1) + ' other image' + (res.dupeCount === 2 ? '' : 's') + '">dup ×' + res.dupeCount + '</span>');
  const extra = res.alt || res.title;
  if (extra) parts.push('<span class="meta-alt">' + escapeHtml(extra).slice(0, 90) + '</span>');
  meta.innerHTML = parts.join(' <span class="sep">·</span> ');
  info.appendChild(name);
  info.appendChild(meta);

  const dl = document.createElement('button');
  dl.className = 'card__download';
  dl.title = t('cardDownloadTitle', 'Download file');
  dl.innerHTML = ICONS.download;
  dl.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadSingle(res);
  });

  if (state.failed.has(res.id)) {
    const warn = document.createElement('button');
    warn.className = 'card__warn';
    warn.title = t('cardRetryFailedTitle', 'Previous download failed — click to retry');
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
    iconWrap.style.color = typeColor(res.type);
    iconWrap.innerHTML = ICONS[res.type] || ICONS.other;
    tile.appendChild(iconWrap);
  }

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'tile__check';
  check.checked = state.selected.has(res.id);
  check.title = t('cardToggleBatchTitle', 'Toggle selection for batch download');
  check.addEventListener('click', (e) => e.stopPropagation());
  check.addEventListener('change', () => toggleSelect(res.id, check.checked));
  tile.appendChild(check);

  const dl = document.createElement('button');
  dl.className = 'tile__dl';
  dl.title = t('cardDownloadTitle', 'Download file');
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

  if (res.dupeCount > 1) {
    const dupe = document.createElement('span');
    dupe.className = 'tile__dupe';
    dupe.title = 'Duplicate — same bytes as ' + (res.dupeCount - 1) + ' other image' + (res.dupeCount === 2 ? '' : 's');
    dupe.textContent = '×' + res.dupeCount;
    tile.appendChild(dupe);
  }

  if (state.failed.has(res.id)) {
    const warn = document.createElement('button');
    warn.className = 'tile__warn';
    warn.title = t('cardRetryFailedTitle', 'Previous download failed — click to retry');
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

/*
 * The list is rendered in windows rather than all at once: a page with a few
 * thousand resources would otherwise build a few thousand DOM nodes on every
 * network update. Rows past the first window are appended as the sentinel at
 * the bottom scrolls into view.
 */
const LIST_CHUNK = 120;
let listChunkObserver = null;
let listWindow = null;
let listWindowSize = LIST_CHUNK;
let listSignature = '';

// Anything that changes which resources are shown resets the window back to
// its first chunk; a plain data refresh keeps whatever the user scrolled to.
function currentListSignature() {
  const f = state.filters;
  return [
    state.activeTab, state.view, state.search,
    f.minSize, f.maxSize, f.minWidth, f.minHeight,
    f.sortBy, f.sortDir, f.method, f.reqType,
  ].join('\u0000');
}

function teardownListWindow() {
  if (listChunkObserver) {
    listChunkObserver.disconnect();
    listChunkObserver = null;
  }
  listWindow = null;
}

// Flattens the filtered resources into a render plan of group headers and
// cards, so windowing does not have to care about the "All" tab's grouping.
function buildListRows(filtered) {
  if (state.activeTab !== 'all') return filtered.map((res) => ({ res }));

  const groups = new Map();
  for (const r of filtered) {
    let g = groups.get(r.type);
    if (!g) groups.set(r.type, (g = []));
    g.push(r);
  }
  const rows = [];
  for (const key of Object.keys(TYPES)) {
    if (key === 'all') continue;
    const group = groups.get(key);
    if (!group || !group.length) continue;
    rows.push({ header: TYPES[key].label, count: group.length });
    for (const r of group) rows.push({ res: r });
  }
  return rows;
}

function appendListChunk() {
  if (!listWindow) return;
  const { listEl, rows, renderOne, sentinel } = listWindow;
  const end = Math.min(listWindow.index + LIST_CHUNK, rows.length);
  const frag = document.createDocumentFragment();
  for (let i = listWindow.index; i < end; i++) {
    const row = rows[i];
    if (row.header !== undefined) {
      const header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML =
        '<span>' + row.header + '</span>' +
        '<span class="group-header__line"></span>' +
        '<span class="group-header__count">' + row.count + '</span>';
      frag.appendChild(header);
    } else {
      frag.appendChild(renderOne(row.res));
    }
  }
  listEl.insertBefore(frag, sentinel);
  listWindow.index = end;
  listWindowSize = end;

  if (end >= rows.length) {
    teardownListWindow();
    sentinel.remove();
  } else if (listChunkObserver) {
    // Re-observing forces a fresh callback when the sentinel is still on
    // screen after this batch (tall panes, short rows).
    listChunkObserver.unobserve(sentinel);
    listChunkObserver.observe(sentinel);
  }
}

function renderList() {
  const listEl = document.getElementById('list');
  teardownListWindow();
  listEl.className = state.view === 'grid' ? 'list list--grid' : 'list list--list';
  listEl.innerHTML = '';
  const filtered = filteredResources();

  const sig = currentListSignature();
  if (sig !== listSignature) {
    listSignature = sig;
    listWindowSize = LIST_CHUNK;
  }

  const empty = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-title');
  const emptySub = document.getElementById('empty-subtitle');
  if (filtered.length === 0) {
    empty.hidden = false;
    if (state.search.trim()) {
      emptyTitle.textContent = t('emptySearchTitle', 'No matches for "$QUERY$"').replace('$QUERY$', state.search.trim());
      emptySub.textContent = t('emptySearchSub', 'Try a different search term, or switch to another category.');
    } else if (hasActiveFilters()) {
      emptyTitle.textContent = t('emptyFiltersTitle', 'No resources match the current filters');
      emptySub.textContent = t('emptyFiltersSub', 'Loosen the size or dimension filters above, or press Clear.');
    } else {
      emptyTitle.textContent = t('emptyTitle', 'No resources found');
      emptySub.textContent = t('emptySubtitle', 'Reload the page while this panel is open to capture network requests, or click Refresh to scan the current DOM.');
    }
    return;
  }
  empty.hidden = true;

  const rows = buildListRows(filtered);
  const sentinel = document.createElement('div');
  sentinel.className = 'list__sentinel';
  listEl.appendChild(sentinel);

  listWindow = {
    listEl,
    rows,
    sentinel,
    index: 0,
    renderOne: state.view === 'grid' ? renderTile : renderCard,
  };

  if (window.IntersectionObserver) {
    listChunkObserver = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) appendListChunk();
      },
      { root: document.querySelector('.list-pane'), rootMargin: '800px 0px' }
    );
    listChunkObserver.observe(sentinel);
  }

  // Restore however far the user had already scrolled before this re-render.
  const target = Math.min(rows.length, Math.max(LIST_CHUNK, listWindowSize));
  while (listWindow && listWindow.index < target) appendListChunk();
  if (!window.IntersectionObserver) {
    while (listWindow) appendListChunk();
  }
}

function renderStatus() {
  const total = state.resources.length;
  const resLabel = t('statusResources', 'resources');
  document.getElementById('status-resources').textContent =
    total + ' ' + (resLabel || 'resources');

  const sel = state.selected.size;
  const selEl = document.getElementById('status-selected');
  selEl.hidden = sel === 0;
  if (sel) selEl.textContent = sel + ' ' + (t('statusSelected', 'selected') || 'selected');

  let size = 0;
  for (const r of state.resources) if (r.size) size += r.size;
  document.getElementById('status-size').textContent = size ? '≈ ' + formatBytes(size) : '';

  const extraDupes = state.resources.filter((r) => r.dupeCount > 1 && !r.dupePrimary).length;
  const dupeEl = document.getElementById('status-dupes');
  if (dupeEl) {
    dupeEl.hidden = extraDupes === 0;
    if (extraDupes) dupeEl.textContent = extraDupes + ' ' + (t('statusDupes', 'duplicates hidden') || 'duplicates hidden');
  }

  const badge = document.getElementById('btn-download-selected-count');
  if (badge) {
    badge.hidden = sel === 0;
    badge.textContent = sel;
  }
  const btnSel = document.getElementById('btn-download-selected');
  if (btnSel) btnSel.disabled = state.busy || sel === 0;
  const btnAll = document.getElementById('btn-download-all');
  if (btnAll) btnAll.disabled = state.busy;

  const allEst = estimateArchiveBytes(state.resources);
  const viewList = filteredResources();
  const viewEst = estimateArchiveBytes(viewList);
  const selList = selectedResources();
  const selEst = estimateArchiveBytes(selList);

  if (btnAll) btnAll.title = (t('btnDownloadAll', 'Download All') || 'Download All') +
    (state.resources.length ? ' (' + formatEstimate(allEst) + ')' : '');
  if (btnSel) btnSel.title = (t('btnDownloadSelected', 'Download Selected') || 'Download Selected') +
    (sel ? ' (' + formatEstimate(selEst) + ')' : '');

  const btnView = document.getElementById('btn-download-view');
  if (btnView) {
    btnView.disabled = state.busy || viewList.length === 0;
    const label = btnView.querySelector('span');
    if (label) {
      label.textContent = hasActiveFilters()
        ? ' ' + (t('btnDownloadFiltered', 'Download Filtered') || 'Download Filtered') + ' (' + viewList.length + ')'
        : ' ' + (t('btnDownloadView', 'Download View') || 'Download View');
    }
    btnView.title = (hasActiveFilters()
      ? (t('btnDownloadFiltered', 'Download Filtered') || 'Download Filtered')
      : (t('btnDownloadView', 'Download View') || 'Download View')) +
      (viewList.length ? ' (' + formatEstimate(viewEst) + ')' : '');
  }
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
  if (res.type === 'json' || res.type === 'manifest' || res.type === 'sourcemap') return 'json';
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

// Preview bodies are kept whole up to this point. Beyond it the file is
// almost certainly a source map or a data blob, not something to read.
const MAX_PREVIEW_CHARS = 8 * 1024 * 1024;

// Formatting a multi-megabyte bundle on the UI thread is what used to lock the
// panel up, so anything sizeable is handed to the archive worker instead.
const BEAUTIFY_INLINE_LIMIT = 256 * 1024;
// Auto-formatting is a convenience, not worth a long wait on a huge payload.
const AUTO_BEAUTIFY_LIMIT = 2 * 1024 * 1024;

function clampPreviewText(text) {
  if (text.length <= MAX_PREVIEW_CHARS) return text;
  return text.slice(0, MAX_PREVIEW_CHARS) +
    '\n\n… (preview capped at ' + formatBytes(MAX_PREVIEW_CHARS) + ' — download the file to read the rest)';
}

function beautifyLangFor(res) {
  if (res.type === 'json' || res.type === 'manifest' || res.type === 'sourcemap' || isJsonType(res)) return 'json';
  if (res.type === 'css') return 'css';
  if (res.type === 'js') return 'js';
  if (res.type === 'svg' || res.type === 'xml' || res.type === 'document') return 'html';
  return '';
}

function beautifyText(res, text) {
  const b = window.SourceDownloadBeautify;
  const lang = beautifyLangFor(res);
  if (!b || !lang || !b[lang]) return text;
  try {
    return b[lang](text);
  } catch {
    return text; // beautification failed — keep the original text
  }
}

// Resolves to the formatted text, off-thread when the payload is large enough
// for the difference to be felt.
async function beautifyAsync(res, text) {
  if (res._formatted !== undefined) return res._formatted;
  if (res._beautifyPromise) return res._beautifyPromise;
  const lang = beautifyLangFor(res);
  if (!lang) return text;

  const run = (async () => {
    if (text.length <= BEAUTIFY_INLINE_LIMIT) return beautifyText(res, text);
    try {
      return await runCpuJob({ kind: 'beautify', lang, text }, null, 25000);
    } catch (err) {
      if (err && err.timeout) {
        toast(t('toastFormatTimeout', 'Formatting timed out — showing original file.'), 'error');
        return text;
      }
      if (err && err.workerUnavailable) {
        toast(t('toastFormatFailed', 'Could not format file — showing original.'), 'error');
        return text;
      }
      toast(t('toastFormatFailed', 'Could not format file — showing original.'), 'error');
      return text;
    }
  })();

  res._beautifyPromise = run;
  try {
    const formatted = await run;
    res._formatted = formatted;
    return formatted;
  } finally {
    res._beautifyPromise = null;
  }
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

/*
 * Code preview rendering.
 *
 * Files are shown in full — a 3 MB bundle used to be cut off at 300 000
 * characters, which silently broke Beautify because it only ever saw the
 * truncated head. Instead of trimming the content, rows are built lazily:
 * only the visible window exists in the DOM, and minified lines (which can be
 * megabytes long on a single line) are split into segments so layout never
 * stalls on one enormous text node.
 */
const CODE_CHUNK = 300;
const MAX_SEGMENT_CHARS = 4000;
const MAX_DISPLAY_ROWS = 400000;

let codeWindow = null;
let codeObserver = null;

function teardownCodeWindow() {
  if (codeObserver) {
    codeObserver.disconnect();
    codeObserver = null;
  }
  codeWindow = null;
}

function buildCodeRows(text) {
  const rows = [];
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length <= MAX_SEGMENT_CHARS) {
      rows.push({ n: i + 1, start: offset, text: line });
    } else {
      for (let p = 0; p < line.length; p += MAX_SEGMENT_CHARS) {
        rows.push({
          n: p === 0 ? i + 1 : 0,      // 0 = continuation of the line above
          start: offset + p,
          text: line.slice(p, p + MAX_SEGMENT_CHARS),
        });
      }
    }
    offset += line.length + 1;         // + the newline itself
    if (rows.length >= MAX_DISPLAY_ROWS) break;
  }
  return rows;
}

// First match whose end lies past `offset`; matches are sorted, so a binary
// search keeps per-row work independent of how many matches there are.
function firstMatchFrom(matches, offset) {
  let lo = 0;
  let hi = matches.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (matches[mid][0] + matches[mid][1] <= offset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function rowIndexForOffset(rows, offset) {
  let lo = 0;
  let hi = rows.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].start <= offset) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

// Marks carry their global match index so "next match" can find the element
// even after the window has grown.
function codeRowHtml(row, matches, lang) {
  if (!matches.length) return highlightCode(row.text, lang);
  const start = row.start;
  const end = start + row.text.length;
  let html = '';
  let pos = 0;
  for (let mi = firstMatchFrom(matches, start); mi < matches.length; mi++) {
    const ms = matches[mi][0];
    if (ms >= end) break;
    const me = ms + matches[mi][1];
    const relS = Math.max(0, ms - start);
    const relE = Math.min(row.text.length, me - start);
    if (relE <= pos) continue;
    if (relS > pos) html += highlightCode(row.text.slice(pos, relS), lang);
    html += '<mark class="hl" data-match data-mi="' + mi + '">' +
      escapeHtmlText(row.text.slice(relS, relE)) + '</mark>';
    pos = relE;
  }
  if (pos < row.text.length) html += highlightCode(row.text.slice(pos), lang);
  return html;
}

function appendCodeChunk() {
  if (!codeWindow) return;
  const { body, rows, sentinel, matches, lang } = codeWindow;
  const end = Math.min(codeWindow.index + CODE_CHUNK, rows.length);
  const frag = document.createDocumentFragment();
  for (let i = codeWindow.index; i < end; i++) {
    const r = rows[i];
    const row = document.createElement('div');
    row.className = 'code-row';
    const ln = document.createElement('span');
    ln.className = 'code-ln';
    ln.textContent = r.n ? String(r.n) : '';
    const line = document.createElement('code');
    line.className = 'code-line';
    line.innerHTML = codeRowHtml(r, matches, lang);
    row.appendChild(ln);
    row.appendChild(line);
    frag.appendChild(row);
  }
  body.insertBefore(frag, sentinel);
  codeWindow.index = end;

  if (end >= rows.length) {
    teardownCodeWindow();
    sentinel.remove();
  } else if (codeObserver) {
    codeObserver.unobserve(sentinel);
    codeObserver.observe(sentinel);
  }
}

// Grows the window until `rowIdx` exists in the DOM, used when jumping to a
// search hit that lives below everything rendered so far.
function ensureCodeRow(rowIdx) {
  let guard = 0;
  while (codeWindow && codeWindow.index <= rowIdx && guard++ < 100000) appendCodeChunk();
}

function renderCodeRows(body, rows, matches, lang, scroller) {
  teardownCodeWindow();
  body.innerHTML = '';
  const sentinel = document.createElement('div');
  sentinel.className = 'code-sentinel';
  body.appendChild(sentinel);
  codeWindow = { body, rows, sentinel, matches, lang, index: 0 };

  if (window.IntersectionObserver) {
    codeObserver = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) appendCodeChunk();
      },
      { root: scroller || null, rootMargin: '1200px 0px' }
    );
    codeObserver.observe(sentinel);
  }
  appendCodeChunk();
  if (!window.IntersectionObserver) {
    while (codeWindow) appendCodeChunk();
  }
}

function setupContentSearch(scroller, body, text, lang, opts) {
  const bar = document.createElement('div');
  bar.className = 'content-find';
  bar.innerHTML =
    '<input type="text" class="content-find__input" placeholder="' + escapeHtml(t('findInContentPlaceholder', 'Find in content…')) + '" spellcheck="false">' +
    '<span class="content-find__count">0/0</span>' +
    '<button class="content-find__btn" data-dir="-1" title="' + escapeHtml(t('findPreviousMatch', 'Previous match')) + '">▲</button>' +
    '<button class="content-find__btn" data-dir="1" title="' + escapeHtml(t('findNextMatch', 'Next match')) + '">▼</button>' +
    (opts
      ? '<button class="content-find__beautify" title="' + (opts.beautified ? escapeHtml(t('findShowRaw', 'Show original (unformatted) content')) : escapeHtml(t('findBeautify', 'Format / beautify this content'))) + '">' + (opts.beautified ? escapeHtml(t('btnRaw', 'Raw')) : escapeHtml(t('btnBeautify', 'Beautify'))) + '</button>'
      : '') +
    '<button class="content-find__close" title="' + escapeHtml(t('findClose', 'Close')) + '">✕</button>';
  const input = bar.querySelector('input');
  const count = bar.querySelector('.content-find__count');
  const rows = buildCodeRows(text);

  // Scrolls to the active hit, growing the rendered window first when the hit
  // is still below what has been built.
  const focusMatch = () => {
    const m = contentFind.matches[contentFind.index];
    if (!m) return;
    ensureCodeRow(rowIndexForOffset(rows, m[0]));
    body.querySelectorAll('mark.hl--active').forEach((el) => el.classList.remove('hl--active'));
    const el = body.querySelector('mark[data-mi="' + contentFind.index + '"]');
    if (el) {
      el.classList.add('hl--active');
      el.scrollIntoView({ block: 'center' });
    }
  };

  const apply = () => {
    contentFind.term = input.value.trim();
    contentFind.matches = findMatches(text, contentFind.term);
    contentFind.index = contentFind.matches.length ? 0 : -1;
    renderCodeRows(body, rows, contentFind.matches, lang, scroller);
    count.textContent = contentFind.matches.length
      ? (contentFind.index + 1) + '/' + contentFind.matches.length
      : '0/0';
    if (contentFind.index !== -1) focusMatch();
  };

  const step = (dir) => {
    if (!contentFind.matches.length) return;
    contentFind.index = (contentFind.index + dir + contentFind.matches.length) % contentFind.matches.length;
    count.textContent = (contentFind.index + 1) + '/' + contentFind.matches.length;
    focusMatch();
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
    renderCodeRows(body, rows, [], lang, scroller);
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
  const opts = {
    beautified: !!res._beautified,
    toggle: () => {
      res._beautified = !res._beautified;
      renderTextPreview(res, pv === document.getElementById('inspector-preview') ? undefined : pv);
    },
  };

  const mount = (shown) => {
    if (!pv.isConnected) return;
    const bar = setupContentSearch(scroller, body, shown, lang, opts);
    wrap.insertBefore(bar, scroller);
  };

  if (!res._beautified) {
    mount(text);
    return;
  }
  if (res._formatted !== undefined) {
    mount(res._formatted);
    return;
  }
  // Show the original immediately so a slow worker can never leave the
  // inspector stuck on a "Formatting…" placeholder.
  mount(text);
  const btn = wrap.querySelector('.content-find__beautify');
  if (btn) {
    btn.textContent = t('inspectorFormatting', 'Formatting…');
    btn.disabled = true;
  }
  beautifyAsync(res, text).then((formatted) => {
    if (!pv.isConnected || state.current !== res || !res._beautified) return;
    const bar = wrap.querySelector('.content-find');
    if (bar) bar.remove();
    body.innerHTML = '';
    mount(formatted);
  });
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
      '<div class="request-preview__label">' + escapeHtml(t('inspectorQueryParams', 'Query parameters')) + '</div>' +
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
        '<div class="request-preview__label">' + escapeHtml(t('inspectorRequestBody', 'Request body')) + '</div>' +
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
      '<span>' + escapeHtml(t('inspectorBinaryResponse', 'Binary response — download to view it')) + '</span></div>';
  } else {
    const pre = document.createElement('pre');
    pre.textContent = t('inspectorLoadingResponse', 'Loading response…');
    main.appendChild(pre);
    getContent(res).then((content) => {
      if (!state.current || state.current.id !== res.id) return;
      if (content === null || content === undefined || content === '') {
        pre.textContent = t('inspectorNoResponsePreview', 'No response preview — the content could not be retrieved.');
        return;
      }
      res._text = clampPreviewText(contentToText(content));
      if (isJsonType(res) && res._beautified === undefined) {
        res._beautified = res._text.length <= AUTO_BEAUTIFY_LIMIT;
      }
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
  wrap.innerHTML = '<div class="font-preview__status">' + escapeHtml(t('inspectorLoadingFont', 'Loading font preview…')) + '</div>';
  pv.appendChild(wrap);

  getContent(res).then((content) => {
    if (!state.current || state.current.id !== res.id) return;
    if (!content || (typeof content === 'string' && !content.trim())) {
      wrap.innerHTML = '<div class="font-preview__status">' + escapeHtml(t('inspectorFontSample', 'Font content could not be retrieved.')) + '</div>';
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
  wrap.innerHTML = '<div class="font-preview__status">' + escapeHtml(t('inspectorLoadingSvg', 'Loading SVG…')) + '</div>';
  pv.appendChild(wrap);

  getContent(res).then((content) => {
    if (!state.current || state.current.id !== res.id) return;
    if (!content || (typeof content === 'string' && !content.trim())) {
      wrap.innerHTML = '<div class="font-preview__status">' + escapeHtml(t('inspectorSvgError', 'SVG content could not be retrieved.')) + '</div>';
      return;
    }
    const text = contentToText(content);
    res._text = text;
    wrap.innerHTML = '';

    const img = document.createElement('img');
    img.alt = '';
    img.className = 'svg-preview__img';
    img.title = t('inspectorClickToEnlarge', 'Click to enlarge');

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
    srcBtn.textContent = t('inspectorViewSource', 'View source');
    srcBtn.title = t('inspectorViewSourceTitle', 'Show the SVG markup with syntax highlighting');
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
  const tabsEl = document.getElementById('inspector-tabs');
  tabsEl.hidden = true;
  tabsEl.innerHTML = '';
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
    closeAll.title = t('inspectorCloseAllTabsTitle', 'Close all open tabs');
    closeAll.innerHTML =
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M3 3l10 10M13 3L3 13"/></svg>' +
      '<span>' + escapeHtml(t('inspectorCloseAllTabs', 'Close all')) + '</span>';
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
      '<span class="itab__dot" style="background:' + typeColor(r.type) + '"></span>' +
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
    img.title = t('inspectorClickToEnlarge', 'Click to enlarge');
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
      video.title = t('inspectorClickToEnlarge', 'Click to enlarge');
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
            '<p>' + escapeHtml(t('videoCannotPlay', 'This video cannot be played in the browser.')) + '</p>' +
            '<p class="media-fallback__note">' + escapeHtml(t('videoFallbackVlcNote', 'Download the file and open it with VLC or another media player.')) + '</p>' +
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
    pre.textContent = t('inspectorLoadingContent', 'Loading content…');
    pv.appendChild(pre);
    getContent(res).then((content) => {
      if (!state.current || state.current.id !== res.id) return;
      if (content === null || content === undefined || content === '') {
        pre.textContent = t('inspectorNoPreview', 'No preview available — the content could not be retrieved.');
        return;
      }
      res._text = clampPreviewText(contentToText(content));
      if (isJsonType(res) && res._beautified === undefined) {
        res._beautified = res._text.length <= AUTO_BEAUTIFY_LIMIT;
      }
      renderTextPreview(res);
    });
  } else {
    pv.innerHTML =
      '<div class="preview-fallback">' +
      (ICONS[res.type] || ICONS.other) +
      '<span>' + escapeHtml(t('emptyPreviewUnknown', 'No preview for this resource type')) + '</span></div>';
  }

  setInspectorMeta('meta-url', res.url, true);
  setInspectorMeta('meta-type', '', false);
  document.getElementById('meta-type').innerHTML =
    '<span class="meta-chip meta-chip--' + res.type + '">' + (TYPES[res.type] || TYPES.other).label + '</span>';
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

function chromeThemeName() {
  try {
    return chrome.devtools.panels.themeName === 'dark' ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

function readStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* noop */ }
  if (panelPrefs.theme === 'light' || panelPrefs.theme === 'dark') return panelPrefs.theme;
  return null;
}

function resolvedTheme() {
  return readStoredTheme() || chromeThemeName();
}

function syncThemeButton() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const light = isLightTheme();
  btn.title = light ? t('btnThemeDark', 'Switch to dark theme') : t('btnThemeLight', 'Switch to light theme');
  btn.setAttribute('aria-label', btn.title);
  btn.setAttribute('aria-pressed', light ? 'false' : 'true');
}

function applyTheme(theme, persist) {
  const next = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE, next); } catch { /* noop */ }
    panelPrefs.theme = next;
    savePrefs();
  }
  syncThemeButton();
}

function toggleTheme() {
  applyTheme(isLightTheme() ? 'dark' : 'light', true);
  render();
  if (state.open.length) renderInspectorTabs();
}

function applyDevtoolsTheme() {
  if (readStoredTheme()) {
    applyTheme(readStoredTheme(), false);
    return;
  }
  applyTheme(chromeThemeName(), false);
}

function setupGuide() {
  document.getElementById('btn-guide').addEventListener('click', openGuide);
  document.getElementById('guide-close').addEventListener('click', closeGuide);
  document.getElementById('guide-backdrop').addEventListener('click', closeGuide);
  document.getElementById('guide-search').addEventListener('input', (e) => {
    filterGuide(e.target.value);
  });
  try {
    const ver = document.getElementById('guide-version');
    if (ver) ver.textContent = chrome.runtime.getManifest().version;
  } catch {
    /* noop */
  }
  const hintLink = document.getElementById('text-hint-guide');
  if (hintLink) hintLink.addEventListener('click', (e) => {
    e.preventDefault();
    openGuide();
    const input = document.getElementById('guide-search');
    const q = t('catText', 'Text');
    input.value = q;
    filterGuide(q);
  });
}

/* ---------- Settings Modal (File Naming Patterns & Video Format) ---------- */
function openSettings() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.hidden = false;
  loadSettingsUI();
}

function closeSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) modal.hidden = true;
}

function updateNamingPreview() {
  const previewEl = document.getElementById('setting-naming-preview');
  if (!previewEl) return;
  const patternInput = document.getElementById('setting-naming-screenshot');
  const pattern = (patternInput && patternInput.value) || '{domain}-{type}-{date}_{time}';
  const namingHelper = (typeof SourceDownloadNaming !== 'undefined') ? SourceDownloadNaming : (typeof window !== 'undefined' && window.SourceDownloadNaming);
  if (namingHelper && typeof namingHelper.formatFilename === 'function') {
    previewEl.textContent = namingHelper.formatFilename(pattern, {
      domain: 'example-com',
      title: 'awesome-page',
      type: 'screenshot-area'
    }, '.png');
  } else {
    previewEl.textContent = 'example-com-screenshot-area-2026-09-22_12-00-00.png';
  }
}

function loadSettingsUI() {
  const namingHelper = (typeof SourceDownloadNaming !== 'undefined') ? SourceDownloadNaming : (typeof window !== 'undefined' && window.SourceDownloadNaming);
  const defPatterns = (namingHelper && namingHelper.DEFAULT_PATTERNS) || {
    screenshot: '{domain}-{type}-{date}_{time}',
    recording: '{domain}-{type}-{date}_{time}',
    archive: '{domain}-archive-{date}'
  };

  chrome.storage.local.get({ namingPatterns: defPatterns, videoFormat: 'mp4', gifResolution: 'original', gifFps: 10 }, (data) => {
    const patterns = data.namingPatterns || defPatterns;
    const inpSc = document.getElementById('setting-naming-screenshot');
    const inpRec = document.getElementById('setting-naming-recording');
    const inpArc = document.getElementById('setting-naming-archive');
    const selVf = document.getElementById('setting-video-format');
    const selGr = document.getElementById('setting-gif-resolution');
    const selGf = document.getElementById('setting-gif-fps');

    if (inpSc) inpSc.value = patterns.screenshot || defPatterns.screenshot;
    if (inpRec) inpRec.value = patterns.recording || defPatterns.recording;
    if (inpArc) inpArc.value = patterns.archive || defPatterns.archive;
    if (selVf) selVf.value = data.videoFormat || 'mp4';
    if (selGr) selGr.value = data.gifResolution || 'original';
    if (selGf) selGf.value = String(data.gifFps || 10);

    updateNamingPreview();
  });
}

function setupSettings() {
  const btnSettings = document.getElementById('btn-settings');
  const btnClose = document.getElementById('settings-close');
  const backdrop = document.getElementById('settings-backdrop');
  const btnSave = document.getElementById('setting-btn-save');
  const btnReset = document.getElementById('setting-btn-reset');

  if (btnSettings) btnSettings.addEventListener('click', openSettings);
  if (btnClose) btnClose.addEventListener('click', closeSettings);
  if (backdrop) backdrop.addEventListener('click', closeSettings);

  const inpSc = document.getElementById('setting-naming-screenshot');
  const inpRec = document.getElementById('setting-naming-recording');
  const inpArc = document.getElementById('setting-naming-archive');

  if (inpSc) inpSc.addEventListener('input', updateNamingPreview);
  if (inpRec) inpRec.addEventListener('input', updateNamingPreview);
  if (inpArc) inpArc.addEventListener('input', updateNamingPreview);

  document.querySelectorAll('#settings-modal .token-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const token = btn.dataset.token;
      const targetInput = document.getElementById(targetId);
      if (targetInput && token) {
        const start = targetInput.selectionStart || targetInput.value.length;
        const end = targetInput.selectionEnd || targetInput.value.length;
        const val = targetInput.value;
        targetInput.value = val.slice(0, start) + token + val.slice(end);
        targetInput.selectionStart = targetInput.selectionEnd = start + token.length;
        targetInput.focus();
        updateNamingPreview();
      }
    });
  });

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const screenshot = (inpSc && inpSc.value.trim()) || '{domain}-{type}-{date}_{time}';
      const recording = (inpRec && inpRec.value.trim()) || '{domain}-{type}-{date}_{time}';
      const archive = (inpArc && inpArc.value.trim()) || '{domain}-archive-{date}';
      const selVf = document.getElementById('setting-video-format');
      const videoFormat = (selVf && selVf.value) || 'mp4';
      const selGr = document.getElementById('setting-gif-resolution');
      const gifResolution = (selGr && selGr.value) || 'original';
      const selGf = document.getElementById('setting-gif-fps');
      const gifFps = parseInt((selGf && selGf.value) || '10', 10) || 10;

      chrome.storage.local.set({
        namingPatterns: { screenshot, recording, archive },
        videoFormat,
        gifResolution,
        gifFps
      }, () => {
        closeSettings();
        if (typeof toast === 'function') {
          toast(t('toastCopied', 'Settings saved'));
        }
      });
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      const namingHelper = (typeof SourceDownloadNaming !== 'undefined') ? SourceDownloadNaming : (typeof window !== 'undefined' && window.SourceDownloadNaming);
      const defPatterns = (namingHelper && namingHelper.DEFAULT_PATTERNS) || {
        screenshot: '{domain}-{type}-{date}_{time}',
        recording: '{domain}-{type}-{date}_{time}',
        archive: '{domain}-archive-{date}'
      };
      if (inpSc) inpSc.value = defPatterns.screenshot;
      if (inpRec) inpRec.value = defPatterns.recording;
      if (inpArc) inpArc.value = defPatterns.archive;
      const selVf = document.getElementById('setting-video-format');
      if (selVf) selVf.value = 'mp4';
      const selGr = document.getElementById('setting-gif-resolution');
      if (selGr) selGr.value = 'original';
      const selGf = document.getElementById('setting-gif-fps');
      if (selGf) selGf.value = '10';
      updateNamingPreview();
    });
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
    (isHls ? escapeHtml(t('videoHlsDetected', 'HLS (m3u8) stream detected')) : escapeHtml(t('videoCannotPlay', 'This video cannot be played in the browser'))) +
    '</div>' +
    '<div class="media-fallback__desc">' +
    (isHls
      ? t('videoHlsNotice', 'Chrome cannot play HLS streams directly. You can merge all segments of <b>$NAME$</b> into a single MP4/TS video file.').replace('$NAME$', escapeHtml(res.filename))
      : escapeHtml(t('videoFormatUnsupported', 'The browser does not support this format')) +
        (res.mimeType ? ' (' + escapeHtml(res.mimeType) + ')' : '') +
        '. ' + escapeHtml(t('videoFallbackVlcNote', 'Download the file and open it with VLC or another media player.'))) +
    '</div>' +
    '<div class="media-fallback__actions">' +
    (isHls ? '<button id="mfa-merge" class="btn btn--primary">' + escapeHtml(t('btnMergeHls', 'Merge segments & download')) + '</button>' : '') +
    '<button id="mfa-download" class="btn">' + escapeHtml(t('videoDownloadOriginal', 'Download original')) + '</button>' +
    '</div>' +
    '<div class="media-fallback__note">' + escapeHtml(t('videoTipVlc', 'Tip: open the downloaded file with VLC or any desktop media player — it plays virtually every format.')) + '</div>';
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

/*
 * Two workers: zip-worker.js owns CRC / deflate / XLSX assembly, and
 * jobs-worker.js owns Beautify, the content-search index, image hashing and
 * createImageBitmap decode. Splitting them means a ZIP build cannot stall a
 * Beautify click (or vice versa). Both fall back to inline work if a worker
 * cannot start.
 */
function createJobRunner(scriptUrl) {
  let worker = null;
  const jobs = new Map();
  let seq = 0;

  function failAll(message) {
    for (const job of jobs.values()) {
      if (job.timer) clearTimeout(job.timer);
      const err = new Error(message);
      err.workerUnavailable = true;
      job.reject(err);
    }
    jobs.clear();
  }

  function getWorker() {
    if (worker) return worker;
    try {
      const w = new Worker(scriptUrl);
      w.addEventListener('message', (e) => {
        const msg = e.data || {};
        const job = jobs.get(msg.id);
        if (!job) return;
        if (msg.type === 'progress') {
          if (job.onProgress) job.onProgress(msg.fraction);
          return;
        }
        jobs.delete(msg.id);
        if (job.timer) clearTimeout(job.timer);
        if (msg.type === 'done') job.resolve(msg.blob);
        else job.reject(new Error(msg.message || 'job failed'));
      });
      w.addEventListener('error', () => {
        worker = null;
        failAll(scriptUrl + ' crashed');
      });
      worker = w;
      return w;
    } catch {
      return null;
    }
  }

  function run(payload, onProgress, timeoutMs) {
    const w = getWorker();
    if (!w) {
      const err = new Error('worker unavailable');
      err.workerUnavailable = true;
      return Promise.reject(err);
    }
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const job = { resolve, reject, onProgress, timer: null };
      jobs.set(id, job);
      if (timeoutMs > 0) {
        job.timer = setTimeout(() => {
          jobs.delete(id);
          if (jobs.size === 0 && worker) {
            try { worker.terminate(); } catch { /* noop */ }
            worker = null;
          }
          const err = new Error('timed out');
          err.timeout = true;
          reject(err);
        }, timeoutMs);
      }
      try {
        // Buffers are cloned rather than transferred: the same ArrayBuffers
        // stay cached on each resource for previews and repeat downloads.
        w.postMessage(Object.assign({ id }, payload));
      } catch (err) {
        jobs.delete(id);
        if (job.timer) clearTimeout(job.timer);
        err.workerUnavailable = true;
        reject(err);
      }
    });
  }

  return { run };
}

const archiveRunner = createJobRunner('lib/zip-worker.js');
const cpuRunner = createJobRunner('lib/jobs-worker.js');

function runArchiveJob(payload, onProgress) {
  return archiveRunner.run(payload, onProgress, 0);
}

function runCpuJob(payload, onProgress, timeoutMs) {
  return cpuRunner.run(payload, onProgress, timeoutMs || 0);
}

async function indexContentAsync(content) {
  if (content === null || content === undefined || content === '') return '';
  const asText = typeof content === 'string';
  if (asText && content.length <= 4096) {
    return content.toLowerCase().slice(0, CONTENT_INDEX_CAP);
  }
  try {
    const payload = asText
      ? { kind: 'index', text: content, cap: CONTENT_INDEX_CAP }
      : { kind: 'index', bytes: content, cap: CONTENT_INDEX_CAP };
    return await runCpuJob(payload, null, 20000);
  } catch {
    return contentToText(content).toLowerCase().slice(0, CONTENT_INDEX_CAP);
  }
}

function contentToBytes(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (typeof content === 'string') return new TextEncoder().encode(content);
  if (content && content.buffer) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  return null;
}

async function hashContentAsync(content) {
  const bytes = contentToBytes(content);
  if (!bytes) return 'empty';
  if (bytes.length <= 2048) {
    let h = 2166136261;
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16) + ':' + bytes.length;
  }
  try {
    return await runCpuJob({ kind: 'hash', bytes }, null, 8000);
  } catch {
    let h = 2166136261;
    const n = Math.min(bytes.length, 8192);
    for (let i = 0; i < n; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16) + ':' + bytes.length;
  }
}

async function measureImageSize(content, mime) {
  const bytes = contentToBytes(content);
  if (!bytes) return null;
  try {
    return await runCpuJob({ kind: 'imageSize', bytes, mime }, null, 8000);
  } catch {
    if (!window.createImageBitmap) return null;
    try {
      const blob = toBlob(content, mime || undefined);
      const bmp = await createImageBitmap(blob);
      const out = { width: bmp.width, height: bmp.height };
      bmp.close();
      return out;
    } catch {
      return null;
    }
  }
}

async function buildZip(entries, onProgress, options) {
  try {
    return await runArchiveJob({ kind: 'zip', entries, options }, onProgress);
  } catch (err) {
    if (!err || !err.workerUnavailable) throw err;
    return window.SourceDownloadZip.createZip(entries, onProgress, options);
  }
}

async function buildXlsx(sheets) {
  try {
    return await runArchiveJob({ kind: 'xlsx', sheets });
  } catch (err) {
    if (!err || !err.workerUnavailable) throw err;
    return window.SourceDownloadXlsx.build(sheets);
  }
}

function estimateArchiveBytes(resources) {
  let bytes = 0;
  let unknown = 0;
  for (const r of resources) {
    if (r.size > 0) bytes += r.size;
    else unknown++;
  }
  bytes += resources.length * 80 + 22;
  return { bytes, unknown };
}

function formatEstimate(est) {
  if (!est || (!est.bytes && !est.unknown)) return '';
  if (!est.bytes && est.unknown) return 'size unknown';
  const s = '≈ ' + formatBytes(est.bytes);
  return est.unknown ? s + '+' : s;
}

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
      toast(t('toastDownloadFailed', 'Could not fetch this resource (CORS or unsupported type).'), 'error');
      return;
    }
    const name = downloadName(res, content);
    saveBlob(toBlob(content, res.mimeType || undefined), name);
    state.failed.delete(res.id);
    render();
    toast(t('toastDownloadStarted', 'Download started: $NAME$').replace('$NAME$', name), 'success');
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
    toast(t('toastNoResourcesToDownload', 'No resources to download.'), 'error');
    return;
  }
  setBusy(true);
  const est = estimateArchiveBytes(resources);
  showProgress(t('progressFetching', 'Fetching $DONE$/$TOTAL$ · ZIP $EST$…').replace('$DONE$', '0').replace('$TOTAL$', resources.length).replace('$EST$', formatEstimate(est)));
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
          updateProgress(done / total, t('progressFetching', 'Fetching $DONE$/$TOTAL$ · ZIP $EST$…').replace('$DONE$', done).replace('$TOTAL$', total).replace('$EST$', formatEstimate(est)));
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
        const folderName = (TYPES[res.type] && TYPES[res.type].folder) || 'other';
        entries.push({
          name: folderName + '/' + uniqueName(used, folderName, downloadName(res, content)),
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

    updateProgress(1, t('progressCreatingZipArchive', 'Creating ZIP archive…'));
    const blob = await buildZip(entries, (fraction) => {
      updateProgress(0.5 + 0.5 * fraction, t('progressCreatingZip', 'Creating ZIP $PERCENT$%…').replace('$PERCENT$', Math.round(fraction * 100)));
    });
    hideProgress();

    const skipped = total - fetched;
    saveBlob(blob, baseName + '.zip');
    if (skipped > 0) {
      toast(
        t('toastZipSavedWithFailed', 'ZIP saved: $FETCHED$ of $TOTAL$ resources ($SKIPPED$ failed)')
          .replace('$FETCHED$', fetched)
          .replace('$TOTAL$', total)
          .replace('$SKIPPED$', skipped),
        'error',
        {
          label: t('btnRetryFailed', 'Retry $COUNT$').replace('$COUNT$', skipped),
          fn: () => downloadZip(
            state.resources.filter((r) => failedNow.includes(r.id)),
            baseName + '-retry'
          ),
        }
      );
    } else {
      toast(t('toastZipSaved', 'ZIP saved: $FETCHED$ of $TOTAL$ resources').replace('$FETCHED$', fetched).replace('$TOTAL$', total), 'success');
    }
    render();
  } catch (err) {
    hideProgress();
    toast(t('toastZipFailed', 'ZIP failed: $ERROR$').replace('$ERROR$', (err && err.message ? err.message : 'unknown error')), 'error');
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  state.busy = busy;
  for (const id of ['btn-download-all', 'btn-download-view', 'btn-download-selected', 'btn-refresh', 'view-grid', 'view-list', 'btn-export']) {
    const el = document.getElementById(id);
    if (el) el.disabled = busy;
  }
  setStatusMessage(busy ? t('statusWorking', 'Working…') : '');
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

function exportResourceList(format) {
  const list = filteredResources();
  if (!list.length) {
    toast(t('toastNothingToExport', 'No resources to export.'), 'error');
    return;
  }
  const rows = list.map((r) => ({
    url: r.url,
    filename: r.filename,
    type: r.type,
    mimeType: r.mimeType || '',
    size: r.size || '',
    status: r.status || '',
    method: r.method || '',
    hostname: r.hostname || '',
    width: r.width || '',
    height: r.height || '',
    source: r.source || '',
    duplicate: r.dupeCount > 1 ? r.dupeCount : '',
  }));
  const name = zipBaseName() + '-list.' + format;
  if (format === 'json') {
    saveBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), name);
  } else {
    const cols = Object.keys(rows[0]);
    const lines = [cols.join(',')].concat(
      rows.map((row) => cols.map((c) => csvEscape(row[c])).join(','))
    );
    saveBlob(new Blob([lines.join('\r\n')], { type: 'text/csv' }), name);
  }
  toast(t('toastExportedTablesZip', 'Exported $COUNT$ resource(s) as $FORMAT$').replace('$COUNT$', rows.length).replace('$FORMAT$', format.toUpperCase()), 'success');
}

function exportHar() {
  chrome.devtools.network.getHAR((har) => {
    if (!har) {
      toast(t('toastDevToolsNotAvailable', 'Could not read the network log.'), 'error');
      return;
    }
    const log = har.log ? har.log : har;
    if (!log.creator) {
      let version = '1.11.0';
      try { version = chrome.runtime.getManifest().version; } catch { /* keep */ }
      log.creator = { name: 'Source Download', version };
    }
    const file = { log };
    saveBlob(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), zipBaseName() + '.har');
    const n = (log.entries || []).length;
    toast(t('toastHarExported', 'HAR exported ($COUNT$ entries)').replace('$COUNT$', n), 'success');
  });
}

function closeExportMenu() {
  const menu = document.getElementById('export-menu');
  if (menu) menu.hidden = true;
}

function openExportMenu(e) {
  e.preventDefault();
  e.stopPropagation();
  closeContextMenu();
  closeLangMenu();
  const menu = document.getElementById('export-menu');
  const btn = document.getElementById('btn-export');
  if (!menu || !btn) return;
  menu.hidden = !menu.hidden;
  if (menu.hidden) return;
  const rect = btn.getBoundingClientRect();
  menu.style.left = Math.max(8, rect.right - 220) + 'px';
  menu.style.top = (rect.bottom + 4) + 'px';
}

function closeLangMenu() {
  const menu = document.getElementById('lang-menu');
  if (menu) menu.hidden = true;
}

function openLangMenu(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  closeContextMenu();
  closeExportMenu();
  const menu = document.getElementById('lang-menu');
  const btn = document.getElementById('btn-lang');
  if (!menu || !btn) return;
  menu.hidden = !menu.hidden;
  if (menu.hidden) return;
  const rect = btn.getBoundingClientRect();
  menu.style.left = Math.max(8, rect.right - 165) + 'px';
  menu.style.top = (rect.bottom + 4) + 'px';
}

function emptyResourceFilters() {
  return { minSize: '', maxSize: '', minWidth: '', minHeight: '', sortBy: 'name', sortDir: 'asc', method: '', reqType: '', hideDupes: false };
}

function resetTextFilters(opts) {
  const recapture = !opts || opts.recapture !== false;
  state.text.tag = 'all';
  state.text.level = 'all';
  state.text.pill = 'all';
  state.text.query = { mode: 'text', value: '' };
  state.text.queryError = '';
  state.text.lastSig = '';
  const input = document.getElementById('tf-query');
  if (input) input.value = '';
  const mode = document.getElementById('tf-mode');
  if (mode) mode.value = 'text';
  if (recapture) {
    state.text.blocks = [];
    state.text.tables.clear();
    state.text.sel.clear();
  }
}

/* ============================================================
 * 10. Context menu
 * ============================================================ */

function openContextMenu(e, res) {
  e.preventDefault();
  e.stopPropagation();
  closeExportMenu();
  closeLangMenu();
  closeContextMenu();

  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.className = 'context-menu';
  const existing = document.getElementById('context-menu');
  if (existing) existing.remove();
  document.body.appendChild(menu);

  const items = [
    { label: t('inspectorDownloadFile', 'Download'), icon: ICONS.download, action: () => downloadSingle(res) },
    { label: t('inspectorOpenTab', 'Open in new tab'), icon: ICONS.open, action: () => openResourceTab(res) },
    {
      label: t('inspectorCopyUrl', 'Copy URL'),
      icon: ICONS.copy,
      action: () => {
        copyText(res.url);
        toast(t('toastUrlCopied', 'URL copied to clipboard'), 'success');
      },
    },
  ];
  if (state.failed.has(res.id)) {
    items.splice(1, 0, {
      label: t('contextMenuRetryDownload', 'Retry download'),
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
  closeExportMenu();
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
let panelPrefs = { view: 'list', activeTab: 'all', inspectorWidth: null, guideSeen: false, readMode: false, theme: null, lang: 'auto' };

function loadPrefs() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve();
      return;
    }
    chrome.storage.local.get({ lang: null, panelPrefs: { view: 'list', activeTab: 'all', inspectorWidth: null, guideSeen: false, readMode: false, theme: null, lang: 'auto' } }, (data) => {
      const p = data.panelPrefs || {};
      const stored = (p.theme === 'light' || p.theme === 'dark') ? p.theme : null;
      const savedLang = data.lang || p.lang || 'auto';
      panelPrefs = {
        view: p.view === 'grid' ? 'grid' : 'list',
        activeTab: TYPES[p.activeTab] ? p.activeTab : 'all',
        inspectorWidth: typeof p.inspectorWidth === 'number' && p.inspectorWidth > 0 ? p.inspectorWidth : null,
        guideSeen: p.guideSeen === true,
        readMode: p.readMode === true,
        theme: stored,
        lang: savedLang,
      };
      if (stored) {
        try { localStorage.setItem(THEME_STORAGE, stored); } catch { /* noop */ }
      }
      state.view = panelPrefs.view;
      state.activeTab = panelPrefs.activeTab;
      state.text.readMode = panelPrefs.readMode;
      resolve();
    });
  });
}

function savePrefs() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ lang: panelPrefs.lang, panelPrefs });
  }
}

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      const newLang = changes.lang ? changes.lang.newValue : (changes.panelPrefs && changes.panelPrefs.newValue ? changes.panelPrefs.newValue.lang : null);
      if (newLang && newLang !== currentLocale) {
        setLanguage(newLang);
      }
    }
  });
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
      ? t('searchRegexHint', 'Regex search active — wrap your query in /pattern/i')
      : t('searchPlaceholder', 'Search by name, URL, type, alt text or title…');
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
    state.filters = emptyResourceFilters();
    render();
  });

  const hideDupesBtn = document.getElementById('f-hide-dupes');
  if (hideDupesBtn) {
    hideDupesBtn.addEventListener('click', () => {
      state.filters.hideDupes = !state.filters.hideDupes;
      if (state.filters.hideDupes) scheduleDupeScan();
      render();
    });
  }

  // Text capture controls
  const tfKind = document.getElementById('tf-kind');
  if (tfKind) {
    tfKind.addEventListener('change', (e) => {
      state.text.tag = e.target.value;
      if (state.text.tag !== 'heading') state.text.level = 'all';
      renderTextView();
    });
  }
  const tfLevel = document.getElementById('tf-level');
  if (tfLevel) {
    tfLevel.addEventListener('change', (e) => {
      state.text.level = e.target.value;
      renderTextView();
    });
  }

  // Text category pills
  const setPill = (pill) => {
    state.text.pill = pill;
    renderTextView();
  };
  const pillAll = document.getElementById('tf-pill-all');
  if (pillAll) pillAll.addEventListener('click', () => setPill('all'));
  const pillText = document.getElementById('tf-pill-text');
  if (pillText) pillText.addEventListener('click', () => setPill('text'));
  const pillTables = document.getElementById('tf-pill-tables');
  if (pillTables) pillTables.addEventListener('click', () => setPill('tables'));

  // Text selection controls
  const selectAllBtn = document.getElementById('tf-select-all');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const visible = filteredTextBlocks();
      const allSelected = visible.length > 0 && visible.every((b) => state.text.sel.has(b.id));
      if (allSelected) {
        for (const b of visible) state.text.sel.delete(b.id);
      } else {
        for (const b of visible) state.text.sel.add(b.id);
      }
      renderTextView();
    });
  }

  const clearSelBtn = document.getElementById('tf-clear-sel');
  if (clearSelBtn) {
    clearSelBtn.addEventListener('click', () => {
      state.text.sel.clear();
      renderTextView();
    });
  }

  // CSS and XPath queries have to run inside the page, so those two modes
  // trigger a fresh capture; text and regex just re-filter what is already
  // here and stay instant.
  const applyTextQuery = () => {
    renderTextView();
    if (state.text.query.mode === 'css' || state.text.query.mode === 'xpath') {
      pollTextOnce().catch(() => {});
    }
  };
  const tfMode = document.getElementById('tf-mode');
  if (tfMode) {
    tfMode.addEventListener('change', (e) => {
      state.text.query.mode = e.target.value;
      state.text.queryError = '';
      state.text.lastSig = '';
      applyTextQuery();
    });
  }
  let tfQueryTimer = null;
  const tfQuery = document.getElementById('tf-query');
  if (tfQuery) {
    tfQuery.addEventListener('input', (e) => {
      if (tfQueryTimer) clearTimeout(tfQueryTimer);
      const wait = state.text.query.mode === 'css' || state.text.query.mode === 'xpath' ? 450 : 180;
      tfQueryTimer = setTimeout(() => {
        tfQueryTimer = null;
        state.text.query.value = e.target.value;
        state.text.queryError = '';
        state.text.lastSig = '';
        if (!e.target.value.trim()) {
          state.text.tag = 'all';
          state.text.level = 'all';
        }
        applyTextQuery();
      }, wait);
    });
    tfQuery.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        tfQuery.value = '';
        state.text.query.value = '';
        state.text.queryError = '';
        state.text.lastSig = '';
        applyTextQuery();
        return;
      }
      if (e.key !== 'Enter') return;
      if (tfQueryTimer) clearTimeout(tfQueryTimer);
      tfQueryTimer = null;
      state.text.query.value = tfQuery.value;
      state.text.lastSig = '';
      if (!tfQuery.value.trim()) {
        state.text.tag = 'all';
        state.text.level = 'all';
      }
      applyTextQuery();
    });
  }
  const tfLive = document.getElementById('tf-live');
  if (tfLive) {
    tfLive.addEventListener('click', () => {
      state.text.live = !state.text.live;
      if (!state.text.live) {
        stopTextPoll();
        stopBgTextPoll();
      }
      renderTextView();
      ensureTextPoll();
      ensureBgTextPoll();
    });
  }
  const tfRefresh = document.getElementById('tf-refresh');
  if (tfRefresh) {
    tfRefresh.addEventListener('click', () => {
      pollTextOnce().catch(() => {});
    });
  }
  const tfClear = document.getElementById('tf-clear');
  if (tfClear) {
    tfClear.addEventListener('click', () => {
      resetTextFilters({ recapture: true });
      renderTextView();
      pollTextOnce().catch(() => {});
    });
  }
  const readBtn = document.getElementById('tf-read');
  if (readBtn) {
    readBtn.addEventListener('click', () => {
      state.text.readMode = !state.text.readMode;
      panelPrefs.readMode = state.text.readMode;
      savePrefs();
      renderTextView();
    });
  }
  const expTxt = document.getElementById('tf-export-txt');
  if (expTxt) expTxt.addEventListener('click', exportTextPlain);
  const expMd = document.getElementById('tf-export-md');
  if (expMd) expMd.addEventListener('click', exportTextMarkdown);
  const expCsv = document.getElementById('tf-export-csv');
  if (expCsv) expCsv.addEventListener('click', () => exportTablesAs('csv'));
  const expHtml = document.getElementById('tf-export-html');
  if (expHtml) expHtml.addEventListener('click', () => exportTablesAs('html'));
  const expXlsx = document.getElementById('tf-export-xlsx');
  if (expXlsx) expXlsx.addEventListener('click', exportTextXlsx);

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

  document.getElementById('btn-theme').addEventListener('click', toggleTheme);

  document.getElementById('btn-download-all').addEventListener('click', () => {
    if (!state.resources.length) {
      toast(t('toastNoResourcesToDownload', 'No resources to download.'), 'error');
      return;
    }
    downloadZip(state.resources, zipBaseName() + '-all');
  });

  document.getElementById('btn-download-view').addEventListener('click', () => {
    const list = filteredResources();
    if (!list.length) {
      toast(t('toastNoVisibleResources', 'No visible resources to download.'), 'error');
      return;
    }
    downloadZip(list, zipBaseName() + '-view');
  });

  document.getElementById('btn-download-selected').addEventListener('click', () => {
    const list = selectedResources();
    if (!list.length) {
      toast(t('toastSelectAtLeastOne', 'Select at least one resource first.'), 'error');
      return;
    }
    downloadZip(list, zipBaseName());
  });

  const exportBtn = document.getElementById('btn-export');
  if (exportBtn) exportBtn.addEventListener('click', openExportMenu);
  const exportMenu = document.getElementById('export-menu');
  if (exportMenu) {
    exportMenu.addEventListener('click', (e) => {
      const item = e.target.closest('[data-export]');
      if (!item) return;
      closeExportMenu();
      const kind = item.getAttribute('data-export');
      if (kind === 'json' || kind === 'csv') exportResourceList(kind);
      else if (kind === 'har') exportHar();
      else if (kind === 'screenshot') captureFullPageDevTools();
      else if (kind === 'archive') captureOfflineArchiveDevTools();
    });
  }
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('export-menu');
    if (!menu || menu.hidden) return;
    const btn = document.getElementById('btn-export');
    if (btn && btn.contains(e.target)) return;
    if (menu.contains(e.target)) return;
    closeExportMenu();
  });

  const btnLang = document.getElementById('btn-lang');
  if (btnLang) btnLang.addEventListener('click', openLangMenu);

  const langMenu = document.getElementById('lang-menu');
  if (langMenu) {
    langMenu.addEventListener('click', (e) => {
      const item = e.target.closest('[data-lang]');
      if (!item) return;
      const lang = item.getAttribute('data-lang');
      closeLangMenu();
      setLanguage(lang);
    });
  }
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('lang-menu');
    if (!menu || menu.hidden) return;
    const btn = document.getElementById('btn-lang');
    if (btn && btn.contains(e.target)) return;
    if (menu.contains(e.target)) return;
    closeLangMenu();
  });

  const shotBtn = document.getElementById('btn-screenshot');
  if (shotBtn) shotBtn.addEventListener('click', captureFullPageDevTools);

  const archiveBtn = document.getElementById('btn-archive');
  if (archiveBtn) archiveBtn.addEventListener('click', captureOfflineArchiveDevTools);

  function captureFullPageDevTools() {
    if (typeof chrome === 'undefined' || !chrome.devtools || !chrome.devtools.inspectedWindow) {
      toast(t('toastDevToolsNotAvailable', 'DevTools inspected window not available.'), 'error');
      return;
    }
    const tabId = chrome.devtools.inspectedWindow.tabId;
    showProgress(t('toastScreenshotCapturing', 'Capturing full page screenshot…'));
    chrome.runtime.sendMessage({ type: 'captureFullPage', tabId });
  }

  function captureOfflineArchiveDevTools() {
    if (typeof chrome === 'undefined' || !chrome.devtools || !chrome.devtools.inspectedWindow) {
      toast(t('toastDevToolsNotAvailable', 'DevTools inspected window not available.'), 'error');
      return;
    }
    const tabId = chrome.devtools.inspectedWindow.tabId;
    showProgress(t('toastArchiveCreating', 'Creating offline page archive…'));
    chrome.runtime.sendMessage({ type: 'capturePageArchive', tabId });
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'screenshotProgress') {
        const pct = Math.round((msg.current / msg.total) * 100);
        let pText = t('toastProgressCapturing', 'Capturing full page... $PERCENT$%')
          .replace(/\$PERCENT\$/gi, String(pct))
          .replace(/\$CURRENT\$/gi, String(msg.current))
          .replace(/\$TOTAL\$/gi, String(msg.total));
        if (!pText.includes(String(msg.current))) {
          pText = pText.trim() + ` (${msg.current}/${msg.total})`;
        }
        showProgress(pText);
        updateProgress(msg.current / msg.total, pText);
      } else if (msg.type === 'screenshotDone') {
        hideProgress();
        toast(t('toastScreenshotCaptured', 'Full page screenshot saved.'));
      } else if (msg.type === 'screenshotError') {
        hideProgress();
        toast(t('toastScreenshotError', 'Screenshot error: $ERROR$').replace('$ERROR$', (msg.message || 'failed')), 'error');
      } else if (msg.type === 'archiveDone') {
        hideProgress();
        toast(t('toastArchiveCreated', 'Single-file HTML archive saved.'));
      } else if (msg.type === 'archiveError') {
        hideProgress();
        toast(t('toastArchiveError', 'Archive error: $ERROR$').replace('$ERROR$', (msg.message || 'failed')), 'error');
      }
    });
  }

  async function checkRatingMilestone() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      const data = await chrome.storage.local.get({ downloadMilestone: 0, ratingDismissed: false });
      if (data.downloadMilestone >= 3 && !data.ratingDismissed) {
        const b = document.getElementById('panel-rating-banner');
        if (b) b.hidden = false;
      }
    } catch { /* noop */ }
  }

  const ratingDismiss = document.getElementById('panel-rating-dismiss');
  if (ratingDismiss) {
    ratingDismiss.addEventListener('click', () => {
      const b = document.getElementById('panel-rating-banner');
      if (b) b.hidden = true;
      chrome.storage.local.set({ ratingDismissed: true });
    });
  }

  checkRatingMilestone();

  document.getElementById('inspector-close').addEventListener('click', closeActiveResource);
  document.getElementById('inspector-details').addEventListener('click', toggleInspectorDetails);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
      closeContextMenu();
      closeExportMenu();
      closeLangMenu();
      closeGuide();
      closeSettings();
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
    toast(t('toastUrlCopied', 'URL copied to clipboard'), 'success');
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

async function init() {
  bindEvents();
  updateViewToggle();
  setupResizer();
  setupLightbox();
  setupGuide();
  setupSettings();
  applyInspectorWidth();
  applyDevtoolsTheme();
  if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.panels && chrome.devtools.panels.onThemeChanged) {
    chrome.devtools.panels.onThemeChanged.addListener(applyDevtoolsTheme);
  }
  await setLanguage(panelPrefs.lang || 'auto');
  render();

  if (typeof chrome !== 'undefined' && chrome.devtools && chrome.devtools.network) {
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
      state.text.query = { mode: 'text', value: '' };
      state.text.queryError = '';
      state.text.tag = 'all';
      state.text.level = 'all';
      closeInspector();
      render();
      syncPanelCounts();
      scanDom();
      scanCssResources();
      scheduleSniff();
    });
  }

  scanDom();
  scanCssResources();
  scheduleSniff();
}

window.SourceDownload = {
  I18n: { t, setLanguage, resolveLocale, loadLocaleMessages },
  UI: { toast, showProgress, updateProgress, hideProgress, toggleTheme, applyTheme, openGuide, closeGuide },
  Resources: { addResource, filteredResources, selectedResources, scanDom, scanCssResources },
  TextView: { renderTextView, syncTextToolbar, exportTextPlain, exportTextMarkdown, exportSingleTable, exportTablesAs, exportTextXlsx },
  Inspector: { renderInspector, openResource, closeResource, beautifyAsync },
  Exporter: { downloadSingle, downloadZip, exportResourceList, exportHar },
};

document.addEventListener('DOMContentLoaded', () => {
  loadPrefs().then(init);
});

