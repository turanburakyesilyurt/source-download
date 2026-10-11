/* Source Download — DevTools panel (5/8).
 * Inspector: previews, code view, tabs, lightbox, guide, settings.
 */

'use strict';

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
  // Nothing open: keep the inspector closed so the resource list gets the
  // full width (it used to take 72% of the panel as an empty placeholder).
  if (!state.current && !state.open.length) {
    inspector.hidden = true;
    return;
  }
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
      '<span class="itab__close" aria-hidden="true"><svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></span>';
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.closest('.itab__close')) {
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
  document.getElementById('inspector-title').title = res.filename;
  const icon = document.getElementById('inspector-icon');
  icon.innerHTML = ICONS[res.type] || ICONS.other;
  icon.style.setProperty('--tab-color', typeColor(res.type));
  document.getElementById('inspector-sub').textContent = [
    (TYPES[res.type] || TYPES.other).label,
    res.size ? formatBytes(res.size) : '',
    res.width && res.height ? res.width + ' × ' + res.height : '',
    res.mimeType || '',
  ].filter(Boolean).join(' · ');

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
  const res = state.current;
  document.getElementById('lightbox').hidden = false;
  document.getElementById('lightbox-title').textContent = res ? res.filename : '';
  const meta = document.getElementById('lightbox-meta');
  const base = res ? [(TYPES[res.type] || TYPES.other).label, res.size ? formatBytes(res.size) : ''].filter(Boolean) : [];
  meta.textContent = base.join(' · ');
  // The callers fill the content right after this; add the pixel size once it loads.
  setTimeout(() => {
    const media = document.querySelector('#lightbox-content img, #lightbox-content video');
    if (!media) return;
    const show = () => {
      const w = media.naturalWidth || media.videoWidth;
      const h = media.naturalHeight || media.videoHeight;
      if (w && h) meta.textContent = base.concat(w + ' × ' + h + ' px').join(' · ');
    };
    if (media.complete || media.readyState > 0) show();
    media.addEventListener('load', show, { once: true });
    media.addEventListener('loadedmetadata', show, { once: true });
  }, 0);
  lightboxReset();
  document.getElementById('lightbox-close').focus({ preventScroll: true });
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
  const label = btn.querySelector('span');
  if (label) label.textContent = btn.title;
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

  chrome.storage.local.get({ namingPatterns: defPatterns, videoFormat: 'mp4', gifResolution: '720p', gifFps: 10, areaAutoCopy: false }, (data) => {
    document.getElementById('setting-area-autocopy').checked = !!data.areaAutoCopy;
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
    // 'original' (4K) was removed in 1.17; older saved values fall back to 720p.
    if (selGr) selGr.value = ['1080p', '720p', '480p'].includes(data.gifResolution) ? data.gifResolution : '720p';
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
      const gifResolution = (selGr && selGr.value) || '720p';
      const selGf = document.getElementById('setting-gif-fps');
      const gifFps = parseInt((selGf && selGf.value) || '10', 10) || 10;

      chrome.storage.local.set({
        namingPatterns: { screenshot, recording, archive },
        videoFormat,
        gifResolution,
        gifFps,
        areaAutoCopy: document.getElementById('setting-area-autocopy').checked,
      }, () => {
        closeSettings();
        if (typeof toast === 'function') {
          toast(t('toastSettingsSaved', 'Settings saved'));
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
      if (selGr) selGr.value = '720p';
      const selGf = document.getElementById('setting-gif-fps');
      if (selGf) selGf.value = '10';
      document.getElementById('setting-area-autocopy').checked = false;
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
  document.getElementById('lightbox-download').addEventListener('click', () => {
    if (state.current) downloadSingle(state.current);
  });
  document.getElementById('lightbox-open').addEventListener('click', () => {
    if (state.current) openResourceTab(state.current);
  });
}
