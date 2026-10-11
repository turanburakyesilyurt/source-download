/* Source Download — DevTools panel (6/8).
 * Content retrieval and downloads (single, ZIP, HLS, exports).
 */

'use strict';

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
    return await fetchFromPage(res.url);
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

// Fetches a URL inside the inspected page (its cookies, session and CORS
// rules) through the service worker. Returns bytes or null.
function fetchFromPage(url) {
  return new Promise((resolve) => {
    let tabId;
    try {
      tabId = chrome.devtools.inspectedWindow.tabId;
    } catch {
      resolve(null);
      return;
    }
    chrome.runtime.sendMessage({ type: 'fetchInPage', tabId, url }, (result) => {
      void chrome.runtime.lastError;
      if (result && result.ok && typeof result.b64 === 'string') {
        try {
          resolve(base64ToUint8(result.b64));
          return;
        } catch { /* fall through */ }
      }
      resolve(null);
    });
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
  for (const id of ['btn-download-main', 'btn-download-caret', 'btn-download-all', 'btn-download-view', 'btn-download-selected', 'btn-refresh', 'view-grid', 'view-list', 'btn-export']) {
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
  const item = document.getElementById('btn-export');
  // The item lives in the More menu, which closes on click: anchor to its button.
  const btn = item && !item.closest('.menu') ? item : document.getElementById('btn-more');
  if (!menu || !btn) return;
  closeMenus();
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
  const item = document.getElementById('btn-lang');
  // The item lives in the More menu, which closes on click: anchor to its button.
  const btn = item && !item.closest('.menu') ? item : document.getElementById('btn-more');
  if (!menu || !btn) return;
  closeMenus();
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
  state.text.pill = 'text';
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
