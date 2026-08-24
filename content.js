/* Source Download — content script.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Counts the resources present on the inspected page
 * (Resource Timing API + DOM scan) and reports per-category counts to the
 * background service worker, which updates the toolbar badge. */

(() => {
  const EXT_TYPES = {
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
    ico: 'image', avif: 'image', bmp: 'image', jxl: 'image', jfif: 'image',
    svg: 'svg', svgz: 'svg',
    mp4: 'video', webm: 'video', mkv: 'video', mov: 'video', m4v: 'video', ogv: 'video',
    ts: 'video', m3u8: 'video', m3u: 'video',
    mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', m4a: 'audio', aac: 'audio',
    flac: 'audio', opus: 'audio', weba: 'audio',
    vtt: 'caption', srt: 'caption', ttml: 'caption', sbv: 'caption', ass: 'caption', ssa: 'caption',
    css: 'css',
    js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', tsx: 'js',
    woff: 'font', woff2: 'font', ttf: 'font', otf: 'font', eot: 'font',
    pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document',
    ppt: 'document', pptx: 'document', txt: 'document', xml: 'document',
    html: 'document', htm: 'document', csv: 'document', md: 'document', rtf: 'document',
    zip: 'document', gz: 'document',
    json: 'json', json5: 'json', geojson: 'json',
    map: 'sourcemap',
    wasm: 'wasm',
    webmanifest: 'manifest', manifest: 'manifest',
  };

  const BLOCKED = /^(chrome|chrome-extension|chromium|devtools|about|edge|moz-extension|vivaldi|brave|opera):/i;
  const seen = new Map(); // url -> category

  function getExt(url) {
    try {
      const m = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
      return m ? m[1].toLowerCase() : '';
    } catch {
      const m = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
      return m ? m[1].toLowerCase() : '';
    }
  }

  function classify(url, initiator) {
    if (!url || typeof url !== 'string') return null;
    if (BLOCKED.test(url)) return null;
    const ext = getExt(url);
    if (EXT_TYPES[ext]) return EXT_TYPES[ext];
    switch (initiator) {
      case 'img': return 'image';
      case 'video': return 'video';
      case 'audio': return 'audio';
      case 'track': return 'caption';
      case 'script': return 'js';
      case 'css': return 'css';
      case 'fetch':
      case 'xmlhttprequest': return 'api';
      default: return 'other';
    }
  }

  function add(url, initiator) {
    const t = classify(url, initiator);
    if (t && !seen.has(url)) seen.set(url, t);
  }

  function collectPerformance() {
    let entries = [];
    try {
      entries = performance.getEntriesByType('resource');
    } catch {
      /* noop */
    }
    for (const e of entries) add(e.name, e.initiatorType);
  }

  function collectDom() {
    const doc = document;
    doc.querySelectorAll('img').forEach((el) => {
      const u = el.currentSrc || el.src;
      if (u) add(u, 'img');
    });
    doc.querySelectorAll('img[srcset], source[srcset]').forEach((el) => {
      (el.srcset || '').split(',').forEach((part) => {
        const u = part.trim().split(/\s+/)[0];
        if (u) add(u, 'img');
      });
    });
    doc.querySelectorAll('video').forEach((el) => {
      const s = el.querySelector('source');
      const u = el.currentSrc || (s && s.src);
      if (u) add(u, 'video');
    });
    doc.querySelectorAll('video source').forEach((el) => add(el.src, 'video'));
    doc.querySelectorAll('audio').forEach((el) => {
      const s = el.querySelector('source');
      const u = el.currentSrc || (s && s.src);
      if (u) add(u, 'audio');
    });
    doc.querySelectorAll('audio source').forEach((el) => add(el.src, 'audio'));
    doc.querySelectorAll('script[src]').forEach((el) => add(el.src, 'script'));
    doc.querySelectorAll('link[rel~="stylesheet"]').forEach((el) => add(el.href, 'css'));
    doc.querySelectorAll('link[rel~="icon"]').forEach((el) => add(el.href, 'link'));
    doc.querySelectorAll('iframe[src]').forEach((el) => add(el.src, 'document'));
    doc.querySelectorAll('track[src]').forEach((el) => add(el.src, 'track'));
  }

  function computeCounts() {
    const counts = { all: 0, api: 0, image: 0, svg: 0, video: 0, audio: 0, caption: 0, css: 0, js: 0, sourcemap: 0, font: 0, document: 0, json: 0, wasm: 0, manifest: 0, other: 0 };
    for (const t of seen.values()) if (counts[t] !== undefined) counts[t]++;
    counts.all = seen.size;
    return counts;
  }

  function send() {
    collectPerformance();
    collectDom();
    try {
      chrome.runtime.sendMessage({ type: 'resourceCounts', counts: computeCounts() }, () => {
        void chrome.runtime.lastError; // popup/background may be idle
      });
    } catch {
      /* noop */
    }
  }

  send();
  window.addEventListener('load', send);

  let domTimer = null;
  const observer = new MutationObserver(() => {
    if (domTimer) return;
    domTimer = setTimeout(() => {
      domTimer = null;
      send();
    }, 800);
  });
  try {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch {
    /* noop */
  }
  setInterval(send, 5000);
})();
