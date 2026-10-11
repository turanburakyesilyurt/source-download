/* Source Download — DevTools panel (2/8).
 * State, resource ingestion, content sniffing, CSS discovery, filtering & search.
 */

'use strict';

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
    pill: 'text',        // text | tables
    // One query box, four ways to read it. `text` and `regex` filter what was
    // captured; `css` and `xpath` are resolved against the live page instead,
    // so they can reach elements the readable-text walk skips.
    query: { mode: 'text', value: '' },
    queryError: '',
    tag: 'all',         // all | text box (see TEXT_GROUPS) | <tag name>
    level: 'all',       // all | h1 … h6
  },
};

let idCounter = 0;
let renderTimer = null;
let searchTimer = null;

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

// Number of narrowing filters in use (sorting does not narrow the list).
function activeFilterCount() {
  const f = state.filters;
  return [f.minSize, f.maxSize, f.minWidth, f.minHeight, f.method, f.reqType, f.hideDupes].filter(Boolean).length;
}

function hasActiveFilters() {
  const f = state.filters;
  return !!(
    f.minSize || f.maxSize || f.minWidth || f.minHeight ||
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
