/* Source Download — DevTools panel (8/8).
 * Event wiring and startup.
 */

'use strict';

/* ============================================================
 * 12. Init
 * ============================================================ */

const PREFS_KEY = 'panelPrefs';
let panelPrefs = { view: 'list', activeTab: 'all', inspectorWidth: null, guideSeen: false, theme: null, lang: 'auto' };

function loadPrefs() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve();
      return;
    }
    chrome.storage.local.get({ lang: null, panelPrefs: { view: 'list', activeTab: 'all', inspectorWidth: null, guideSeen: false, theme: null, lang: 'auto' } }, (data) => {
      const p = data.panelPrefs || {};
      const stored = (p.theme === 'light' || p.theme === 'dark') ? p.theme : null;
      const savedLang = data.lang || p.lang || 'auto';
      panelPrefs = {
        view: p.view === 'grid' ? 'grid' : 'list',
        activeTab: TYPES[p.activeTab] ? p.activeTab : 'all',
        inspectorWidth: typeof p.inspectorWidth === 'number' && p.inspectorWidth > 0 ? p.inspectorWidth : null,
        guideSeen: p.guideSeen === true,
        showEmpty: p.showEmpty === true,
        filtersOpen: p.filtersOpen === true,
        theme: stored,
        lang: savedLang,
      };
      if (stored) {
        try { localStorage.setItem(THEME_STORAGE, stored); } catch { /* noop */ }
      }
      state.view = panelPrefs.view;
      state.activeTab = panelPrefs.activeTab;
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
  setupMenus();
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
  document.getElementById('btn-filters').addEventListener('click', () => {
    // With filters in use the bar stays open; closing it clears them.
    if (activeFilterCount()) {
      state.filters = { ...emptyResourceFilters(), sortBy: state.filters.sortBy, sortDir: state.filters.sortDir };
      panelPrefs.filtersOpen = false;
    } else {
      panelPrefs.filtersOpen = !panelPrefs.filtersOpen;
    }
    savePrefs();
    render();
    if (panelPrefs.filtersOpen) document.getElementById('f-min-size').focus();
  });
  document.getElementById('list-select-all').addEventListener('change', (e) => {
    const visible = filteredResources();
    for (const r of visible) {
      if (e.target.checked) state.selected.add(r.id);
      else state.selected.delete(r.id);
    }
    render();
  });
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

  // Text | Tables segment
  const setPill = (pill) => {
    state.text.pill = pill;
    renderTextView();
  };
  document.getElementById('tf-pill-text').addEventListener('click', () => setPill('text'));
  document.getElementById('tf-pill-tables').addEventListener('click', () => setPill('tables'));
  document.getElementById('tx-copy').addEventListener('click', () => {
    const blocks = filteredTextBlocks();
    if (!blocks.length) {
      toast(t('toastNothingToExport', 'Nothing to export'));
      return;
    }
    copyText(plainTextOf(blocks));
    toast(t('toastCopiedBlocks', 'Copied $COUNT$ block(s)').replace('$COUNT$', blocks.length), 'success');
  });

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

  // Review banner: after the 3rd successful save, shown once; if dismissed,
  // at most once more after 30 days. Never again after Review/Star/Issue.
  const RATING_MIN_SAVES = 3;
  const RATING_REPEAT_MS = 30 * 24 * 60 * 60 * 1000;

  async function checkRatingMilestone() {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
      const data = await chrome.storage.local.get({ downloadMilestone: 0, ratingDismissed: false, ratingDone: false, ratingShows: null });
      let shows = Array.isArray(data.ratingShows) ? data.ratingShows : [];
      if (data.ratingShows === null && data.ratingDismissed) shows = [Date.now()]; // dismissed before v1.17
      const b = document.getElementById('panel-rating-banner');
      if (!b || !b.hidden || data.ratingDone || data.downloadMilestone < RATING_MIN_SAVES) return;
      const due = shows.length === 0 || (shows.length === 1 && Date.now() - shows[0] >= RATING_REPEAT_MS);
      if (!due) return;
      b.hidden = false;
      await chrome.storage.local.set({ ratingShows: shows.concat(Date.now()) });
    } catch { /* noop */ }
  }

  const hideRating = (done) => {
    const b = document.getElementById('panel-rating-banner');
    if (b) b.hidden = true;
    try {
      chrome.storage.local.set(done ? { ratingDone: true } : { ratingDismissed: true });
    } catch { /* noop */ }
  };
  const ratingDismiss = document.getElementById('panel-rating-dismiss');
  if (ratingDismiss) ratingDismiss.addEventListener('click', () => hideRating(false));
  for (const id of ['panel-rating-review', 'panel-rating-star', 'panel-rating-issue']) {
    const link = document.getElementById(id);
    if (link) link.addEventListener('click', () => hideRating(true));
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.downloadMilestone) checkRatingMilestone();
    });
  } catch { /* noop */ }

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
      scanDom();
      scanCssResources();
      scheduleSniff();
    });
  }

  scanDom();
  scanCssResources();
  scheduleSniff();
}

document.addEventListener('DOMContentLoaded', () => {
  loadPrefs().then(init);
});
