/* Source Download — DevTools panel (4/8).
 * Resource list / grid rendering and selection.
 */

'use strict';

function render() {
  renderTabs();
  const isText = state.activeTab === 'text';
  document.body.classList.toggle('text-mode', isText);
  const listTop = document.getElementById('list-top');
  const listEl = document.getElementById('list');
  const empty = document.getElementById('empty-state');
  const textView = document.getElementById('text-view');
  if (listTop) listTop.hidden = isText;
  if (listEl) listEl.hidden = isText;
  if (empty) empty.hidden = isText;
  if (textView) textView.hidden = !isText;
  const toolbarSearch = document.getElementById('toolbar-search');
  if (toolbarSearch) toolbarSearch.hidden = isText;
  for (const el of [document.getElementById('dl-split'), document.querySelector('.view-toggle')]) {
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
  renderListHead();
}

// Category title, visible count, select-all and the Filters toggle.
function renderListHead() {
  const n = activeFilterCount();
  const open = !!panelPrefs.filtersOpen || n > 0;
  document.getElementById('filterbar').hidden = !open;
  const btn = document.getElementById('btn-filters');
  btn.setAttribute('aria-expanded', String(open));
  btn.classList.toggle('list-head__filters--on', open);
  const badge = document.getElementById('btn-filters-count');
  badge.hidden = n === 0;
  badge.textContent = n;

  const type = TYPES[state.activeTab] || TYPES.all;
  document.getElementById('list-head-title').textContent = type.label;
  const visible = filteredResources();
  document.getElementById('list-head-count').textContent = visible.length;

  const box = document.getElementById('list-select-all');
  const picked = visible.filter((r) => state.selected.has(r.id)).length;
  box.disabled = visible.length === 0;
  box.checked = visible.length > 0 && picked === visible.length;
  box.indeterminate = picked > 0 && picked < visible.length;
  const title = box.checked ? t('textDeselectAll', 'Deselect All') : t('textSelectAll', 'Select All');
  box.title = title;
  box.setAttribute('aria-label', title);
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
  }, 100);
}

function renderTabs() {
  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = '';
  const counts = {};
  for (const r of state.resources) counts[r.type] = (counts[r.type] || 0) + 1;
  const countOf = (key) => key === 'all' ? state.resources.length : key === 'text' ? state.text.blocks.length : counts[key] || 0;
  // "All" and page text first; empty file categories stay out of the way
  // unless asked for (or currently open).
  const order = ['all', 'text', ...Object.keys(TYPES).filter((k) => k !== 'all' && k !== 'text')];
  const isEmpty = (key) => key !== 'all' && key !== 'text' && key !== state.activeTab && countOf(key) === 0;
  const emptyCount = order.filter(isEmpty).length;
  for (const key of order) {
    const t = TYPES[key];
    if (!t) continue;
    if (!panelPrefs.showEmpty && isEmpty(key)) continue;
    const tab = document.createElement('button');
    tab.className = 'vtab' + (key === state.activeTab ? ' vtab--active' : '');
    tab.dataset.tab = key;
    tab.title = t.label;
    tab.style.setProperty('--tab-color', typeColor(key));
    tab.innerHTML =
      '<span class="vtab__icon">' + (ICONS[key] || ICONS.other) + '</span>' +
      '<span class="vtab__label">' + t.label + '</span>' +
      '<span class="vtab__count">' + countOf(key) + '</span>';
    if (isEmpty(key)) tab.classList.add('vtab--empty');
    if (key === 'text') tab.classList.add('vtab--text');
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
  if (emptyCount) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'vtab vtab--toggle';
    const label = panelPrefs.showEmpty ? t('tabsHideEmpty', 'Hide empty') : t('tabsShowEmpty', 'Show empty');
    toggle.title = label;
    toggle.setAttribute('aria-pressed', String(!!panelPrefs.showEmpty));
    toggle.innerHTML =
      '<span class="vtab__icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="' +
      (panelPrefs.showEmpty ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4') + '"/></svg></span>' +
      '<span class="vtab__label"></span><span class="vtab__count">' + emptyCount + '</span>';
    toggle.querySelector('.vtab__label').textContent = label;
    toggle.addEventListener('click', () => {
      panelPrefs.showEmpty = !panelPrefs.showEmpty;
      savePrefs();
      renderTabs();
    });
    tabsEl.appendChild(toggle);
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

  if (state.activeTab !== 'text') renderListHead();
  const allList = state.resources;
  const viewList = filteredResources();
  const selList = selectedResources();
  const viewKey = hasActiveFilters() ? 'btnDownloadFiltered' : 'btnDownloadView';
  const viewText = hasActiveFilters() ? 'Download Filtered' : 'Download Visible';

  const items = [
    ['btn-download-selected', 'btnDownloadSelected', 'Download Selected', selList, sel === 0],
    ['btn-download-view', viewKey, viewText, viewList, viewList.length === 0],
    ['btn-download-all', 'btnDownloadAll', 'Download All', allList, allList.length === 0],
  ];
  for (const [id, key, fallback, list, empty] of items) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    btn.disabled = state.busy || empty;
    const label = btn.querySelector('[data-i18n]');
    if (label && id === 'btn-download-view') {
      label.setAttribute('data-i18n', key);
      label.textContent = t(key, fallback) || fallback;
    }
    const meta = document.getElementById(id + '-count');
    if (meta) {
      meta.hidden = list.length === 0;
      meta.textContent = list.length ? list.length + ' · ' + formatEstimate(estimateArchiveBytes(list)) : '';
    }
    btn.title = (t(key, fallback) || fallback) + (list.length ? ' (' + formatEstimate(estimateArchiveBytes(list)) + ')' : '');
  }

  // The main button always does the most likely download for the current view.
  const target = downloadMainTarget();
  const [, key, fallback, list] = items.find((i) => i[0] === target);
  const main = document.getElementById('btn-download-main');
  if (main) {
    main.disabled = state.busy || list.length === 0;
    main.dataset.target = target;
    main.title = (t(key, fallback) || fallback) + (list.length ? ' (' + formatEstimate(estimateArchiveBytes(list)) + ')' : '');
    document.getElementById('btn-download-main-label').textContent = t(key, fallback) || fallback;
    const count = document.getElementById('btn-download-main-count');
    count.hidden = list.length === 0;
    count.textContent = list.length;
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
