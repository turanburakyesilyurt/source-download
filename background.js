/* Source Download — background service worker.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Aggregates per-tab resource counts reported by
 * content scripts (and the DevTools panel when it is open) and maintains the
 * toolbar badge. Which categories count is controlled from the popup
 * ("tracking" toggles), persisted in storage. */

'use strict';

try {
  importScripts('lib/i18n.js', 'lib/naming.js');
} catch (e) {
  console.warn('Could not import lib/i18n.js or lib/naming.js in service worker:', e);
}

const CATEGORIES = ['api', 'image', 'svg', 'video', 'audio', 'caption', 'css', 'js', 'sourcemap', 'font', 'document', 'json', 'wasm', 'manifest', 'other'];
const DEFAULT_TRACKING = {};
for (const k of CATEGORIES) DEFAULT_TRACKING[k] = true;

// Content-script counts per tab; panel counts per tab (preferred while the
// DevTools panel is open, because it also sees live network requests).
const countsByTab = new Map();
const panelCountsByTab = new Map();

let tracking = { ...DEFAULT_TRACKING };

function emptyCounts() {
  const c = { all: 0 };
  for (const k of CATEGORIES) c[k] = 0;
  return c;
}

function aggregate() {
  const totals = emptyCounts();
  const tabIds = new Set([...countsByTab.keys(), ...panelCountsByTab.keys()]);
  for (const tabId of tabIds) {
    const counts = panelCountsByTab.get(tabId) || countsByTab.get(tabId);
    if (!counts) continue;
    for (const k of Object.keys(totals)) totals[k] += counts[k] || 0;
  }
  return totals;
}

function computeBadgeNumber() {
  const totals = aggregate();
  let n = 0;
  for (const k of CATEGORIES) if (tracking[k]) n += totals[k];
  return n;
}

function updateBadge() {
  const badgeCount = computeBadgeNumber();
  const text =
    badgeCount === 0
      ? ''
      : badgeCount > 9999
        ? Math.round(badgeCount / 1000) + 'K'
        : String(badgeCount);
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: '#4f8cff' });
}

chrome.storage.local.get({ tracking: DEFAULT_TRACKING }, (data) => {
  const saved = data.tracking || {};
  for (const k of CATEGORIES) {
    tracking[k] = typeof saved[k] === 'boolean' ? saved[k] : true;
  }
  updateBadge();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return undefined;
  if (msg.type === 'resourceCounts') {
    if (sender.tab && sender.tab.id !== undefined && msg.counts && typeof msg.counts === 'object') {
      countsByTab.set(sender.tab.id, msg.counts);
      updateBadge();
    }
    sendResponse({ ok: true });
  } else if (msg.type === 'panelCounts') {
    // From the DevTools panel — more accurate while it is open.
    if (msg.tabId !== undefined && msg.counts && typeof msg.counts === 'object') {
      panelCountsByTab.set(msg.tabId, msg.counts);
      updateBadge();
    }
    sendResponse({ ok: true });
  } else if (msg.type === 'getState') {
    sendResponse({ tracking, counts: aggregate(), badgeCount: computeBadgeNumber() });
  } else if (msg.type === 'setTracking') {
    const next = msg.tracking || {};
    for (const k of CATEGORIES) {
      if (typeof next[k] === 'boolean') tracking[k] = next[k];
    }
    chrome.storage.local.set({ tracking });
    updateBadge();
    sendResponse({ ok: true });
  } else if (msg.type === 'captureFullPage') {
    (async () => {
      const tabId = msg.tabId || (sender.tab ? sender.tab.id : undefined);
      let tab = null;
      if (tabId) {
        try { tab = await chrome.tabs.get(tabId); } catch { /* noop */ }
      }
      await runFullPageCapture(tab);
      sendResponse({ ok: true });
    })();
    return true;
  } else if (msg.type === 'capturePageArchive') {
    (async () => {
      const tabId = msg.tabId || (sender.tab ? sender.tab.id : undefined);
      let tab = null;
      if (tabId) {
        try { tab = await chrome.tabs.get(tabId); } catch { /* noop */ }
      }
      await runOfflinePageArchive(tab);
      sendResponse({ ok: true });
    })();
    return true;
  } else if (msg.type === 'triggerAreaCapture') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        await ensureContentScriptInjected(tab.id);
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        const stored = await chrome.storage.local.get({ lang: 'auto' });
        const lang = stored.lang || 'auto';
        chrome.tabs.sendMessage(tab.id, { type: 'startAreaCapture', dataUrl, lang });
        sendResponse({ ok: true });
      } catch (e) {
        console.warn('triggerAreaCapture failed:', e);
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  } else if (msg.type === 'triggerAreaVideoRecord') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        await ensureContentScriptInjected(tab.id);
        const stored = await chrome.storage.local.get({ lang: 'auto' });
        const lang = stored.lang || 'auto';
        chrome.tabs.sendMessage(tab.id, { type: 'startAreaVideoRecord', lang });
        sendResponse({ ok: true });
      } catch (e) {
        console.warn('triggerAreaVideoRecord failed:', e);
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  } else if (msg.type === 'triggerColorPicker') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) return;
        await ensureContentScriptInjected(tab.id);
        const stored = await chrome.storage.local.get({ lang: 'auto' });
        const lang = stored.lang || 'auto';
        chrome.tabs.sendMessage(tab.id, { type: 'startColorPicker', lang });
        sendResponse({ ok: true });
      } catch (e) {
        console.warn('triggerColorPicker failed:', e);
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }
  return undefined;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const a = countsByTab.delete(tabId);
  const b = panelCountsByTab.delete(tabId);
  if (a || b) updateBadge();
});

/* ============================================================
 * Context Menus & Full Page Capture & Archiving
 * ============================================================ */

async function ensureContentScriptInjected(tabId) {
  if (!tabId) throw new Error('No active tab available.');
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    if (res && res.pong) return true;
  } catch {
    // Content script not answering yet
  }

  const tab = await chrome.tabs.get(tabId);
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.includes('chromewebstore.google.com') || tab.url.includes('chrome.google.com/webstore')) {
    throw new Error('Extensions cannot run on restricted browser or Web Store pages.');
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['lib/i18n.js', 'lib/naming.js', 'lib/pdf.js', 'lib/gif.js', 'content.js'],
  });
  await new Promise((r) => setTimeout(r, 120));
  return true;
}

let currentBackgroundLang = 'auto';

function resolveLocale(code) {
  if (!code || code === 'auto') {
    const browserLang = (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage)
      ? chrome.i18n.getUILanguage()
      : 'en';
    code = browserLang;
  }
  const lower = String(code).toLowerCase().replace('-', '_');
  if (lower.startsWith('tr')) return 'tr';
  if (lower.startsWith('de')) return 'de';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('zh')) return 'zh_CN';
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('ru')) return 'ru';
  return 'en';
}

function getMenuTitle(key, fallback, lang) {
  const loc = resolveLocale(lang || currentBackgroundLang);
  const dict = (typeof globalScope !== 'undefined' && globalScope.SourceDownloadI18n) || (typeof self !== 'undefined' && self.SourceDownloadI18n);
  if (dict && dict[loc] && dict[loc][key]) {
    return dict[loc][key];
  }
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const m = chrome.i18n.getMessage(key);
      if (m) return m;
    }
  } catch { /* noop */ }
  return fallback;
}

let isSettingUpMenus = false;

function setupContextMenus(lang) {
  if (lang) currentBackgroundLang = lang;
  if (isSettingUpMenus) return;
  isSettingUpMenus = true;

  try {
    chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError;

      const items = [
        {
          id: 'sd-zap-element',
          title: getMenuTitle('contextMenuZap', 'Zap / Hide this element', currentBackgroundLang),
          contexts: ['all'],
        },
        {
          id: 'sd-undo-zap',
          title: getMenuTitle('contextMenuUndoZap', 'Restore last hidden element', currentBackgroundLang),
          contexts: ['all'],
        },
        {
          id: 'sd-reset-zap',
          title: getMenuTitle('contextMenuResetZap', 'Reset all hidden elements', currentBackgroundLang),
          contexts: ['all'],
        },
        { id: 'sd-sep-1', type: 'separator', contexts: ['all'] },
        {
          id: 'sd-capture-area',
          title: getMenuTitle('contextMenuCaptureArea', 'Capture area screenshot', currentBackgroundLang),
          contexts: ['all'],
        },
        {
          id: 'sd-record-area',
          title: getMenuTitle('contextMenuRecordArea', 'Record Regional Video / GIF', currentBackgroundLang),
          contexts: ['all'],
        },
        { id: 'sd-sep-2', type: 'separator', contexts: ['all'] },
        {
          id: 'sd-pick-color',
          title: getMenuTitle('contextMenuPickColor', 'Pick color from screen', currentBackgroundLang),
          contexts: ['all'],
        },
        { id: 'sd-sep-3', type: 'separator', contexts: ['all'] },
        {
          id: 'sd-capture-page',
          title: getMenuTitle('contextMenuCapturePage', 'Capture full page screenshot', currentBackgroundLang),
          contexts: ['all'],
        },
        {
          id: 'sd-page-archive',
          title: getMenuTitle('contextMenuPageArchive', 'Download offline page archive', currentBackgroundLang),
          contexts: ['all'],
        },
      ];

      for (const item of items) {
        chrome.contextMenus.create(item, () => {
          void chrome.runtime.lastError;
        });
      }

      isSettingUpMenus = false;
    });
  } catch (e) {
    isSettingUpMenus = false;
    console.warn('Context menu creation error:', e);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ lang: 'auto' }, (data) => {
    currentBackgroundLang = data.lang || 'auto';
    setupContextMenus(currentBackgroundLang);
  });
});

chrome.storage.local.get({ lang: 'auto' }, (data) => {
  currentBackgroundLang = data.lang || 'auto';
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    const newLang = changes.lang ? changes.lang.newValue : (changes.panelPrefs && changes.panelPrefs.newValue ? changes.panelPrefs.newValue.lang : null);
    if (newLang && newLang !== currentBackgroundLang) {
      currentBackgroundLang = newLang;
      setupContextMenus(currentBackgroundLang);
    }
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  try {
    await ensureContentScriptInjected(tab.id);
  } catch (err) {
    console.warn('Context menu injection error:', err);
    return;
  }
  if (info.menuItemId === 'sd-zap-element') {
    if (info.frameId && info.frameId !== 0) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [info.frameId] },
        func: () => {
          try {
            document.documentElement.style.setProperty('display', 'none', 'important');
          } catch { /* noop */ }
        }
      }).catch(() => {});
    }

    chrome.tabs.sendMessage(tab.id, {
      type: 'zapLastElement',
      frameId: info.frameId || 0,
      frameUrl: info.frameUrl || '',
      srcUrl: info.srcUrl || '',
      linkUrl: info.linkUrl || ''
    }, () => {
      void chrome.runtime.lastError;
    });
  } else if (info.menuItemId === 'sd-undo-zap') {
    chrome.tabs.sendMessage(tab.id, { type: 'undoZapElement' }, () => {
      void chrome.runtime.lastError;
    });
  } else if (info.menuItemId === 'sd-reset-zap') {
    chrome.tabs.sendMessage(tab.id, { type: 'resetAllZap' }, () => {
      void chrome.runtime.lastError;
    });
  } else if (info.menuItemId === 'sd-capture-area') {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      const stored = await chrome.storage.local.get({ lang: 'auto' });
      const lang = stored.lang || 'auto';
      chrome.tabs.sendMessage(tab.id, { type: 'startAreaCapture', dataUrl, lang }, () => {
        void chrome.runtime.lastError;
      });
    } catch (err) {
      console.warn('Area screenshot capture failed:', err);
    }
  } else if (info.menuItemId === 'sd-record-area') {
    try {
      const stored = await chrome.storage.local.get({ lang: 'auto' });
      const lang = stored.lang || 'auto';
      chrome.tabs.sendMessage(tab.id, { type: 'startAreaVideoRecord', lang }, () => {
        void chrome.runtime.lastError;
      });
    } catch (err) {
      console.warn('Area video record start failed:', err);
    }
  } else if (info.menuItemId === 'sd-pick-color') {
    try {
      const stored = await chrome.storage.local.get({ lang: 'auto' });
      const lang = stored.lang || 'auto';
      chrome.tabs.sendMessage(tab.id, { type: 'startColorPicker', lang }, () => {
        void chrome.runtime.lastError;
      });
    } catch (err) {
      console.warn('Color picker start failed:', err);
    }
  } else if (info.menuItemId === 'sd-capture-page') {
    await runFullPageCapture(tab);
  } else if (info.menuItemId === 'sd-page-archive') {
    await runOfflinePageArchive(tab);
  }
});


async function recordDownloadMilestone() {
  try {
    const data = await chrome.storage.local.get({ downloadMilestone: 0 });
    const count = (data.downloadMilestone || 0) + 1;
    await chrome.storage.local.set({ downloadMilestone: count });
  } catch { /* noop */ }
}

function dataUrlToBlob(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, commaIdx);
  const base64Data = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64Data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function safeCaptureVisibleTab(windowId, format = 'png', maxRetries = 6) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await chrome.tabs.captureVisibleTab(windowId, { format });
    } catch (err) {
      const msg = String(err && err.message || err).toLowerCase();
      if (
        msg.includes('max_capture_visible_tab') ||
        msg.includes('quota') ||
        msg.includes('per second') ||
        msg.includes('cells-per-second')
      ) {
        // Chromium allows max 2 capture calls per second. Back off and retry.
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  return await chrome.tabs.captureVisibleTab(windowId, { format });
}

async function runFullPageCapture(tab) {
  if (!tab || !tab.id) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = activeTab;
  }
  if (!tab || !tab.id) {
    chrome.runtime.sendMessage({ type: 'screenshotError', message: 'No active tab found.' }).catch(() => {});
    return;
  }

  try {
    await ensureContentScriptInjected(tab.id);

    const dims = await chrome.tabs.sendMessage(tab.id, { type: 'prepareFullPageScreenshot' });
    if (!dims || !dims.scrollHeight) return;

    const stored = await chrome.storage.local.get({ namingPatterns: {}, lang: 'auto' });
    const userLang = stored.lang || 'auto';

    const { scrollHeight, innerHeight, innerWidth, dpr } = dims;
    const totalSteps = Math.ceil(scrollHeight / innerHeight);
    const slices = [];

    chrome.tabs.sendMessage(tab.id, {
      type: 'fullPageScreenshotStart',
      totalSteps,
      lang: userLang
    }).catch(() => {});

    for (let step = 0; step < totalSteps; step++) {
      const y = Math.min(step * innerHeight, Math.max(0, scrollHeight - innerHeight));
      await chrome.tabs.sendMessage(tab.id, { type: 'scrollToY', y });

      if (step >= 1) {
        await chrome.tabs.sendMessage(tab.id, { type: 'hideStickyElements' });
      }

      // Throttled delay to satisfy Chromium MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND limit
      await new Promise((r) => setTimeout(r, 520));

      // Temporarily hide progress pill so it is never captured in screenshot slice
      await chrome.tabs.sendMessage(tab.id, { type: 'hideProgressForSlice' }).catch(() => {});
      await new Promise((r) => setTimeout(r, 60));

      const dataUrl = await safeCaptureVisibleTab(tab.windowId, 'png');
      slices.push({ dataUrl, y, step });

      const percent = Math.round(((step + 1) / totalSteps) * 100);
      chrome.tabs.sendMessage(tab.id, {
        type: 'fullPageProgress',
        current: step + 1,
        total: totalSteps,
        percent,
        lang: userLang
      }).catch(() => {});

      chrome.runtime.sendMessage({
        type: 'screenshotProgress',
        current: step + 1,
        total: totalSteps,
      }).catch(() => {});
    }

    await chrome.tabs.sendMessage(tab.id, { type: 'finishFullPageScreenshot' });
    chrome.tabs.sendMessage(tab.id, { type: 'fullPageStitching', lang: userLang }).catch(() => {});

    let scale = 1;
    let targetHeight = Math.round(scrollHeight * dpr);
    let targetWidth = Math.round(innerWidth * dpr);

    // Guard against Chrome OffscreenCanvas maximum dimension limit (16384px)
    if (targetHeight > 16384) {
      scale = 16384 / targetHeight;
      targetHeight = 16384;
      targetWidth = Math.round(targetWidth * scale);
    }

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');

    for (const slice of slices) {
      const blob = dataUrlToBlob(slice.dataUrl);
      const bitmap = await createImageBitmap(blob);
      ctx.drawImage(bitmap, 0, Math.round(slice.y * dpr * scale), targetWidth, Math.round(bitmap.height * scale));
    }

    const finalBlob = await canvas.convertToBlob({ type: 'image/png' });
    let finalDataUrl = '';
    try {
      finalDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(finalBlob);
      });
    } catch {
      const buffer = await finalBlob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 16384;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
      }
      finalDataUrl = 'data:image/png;base64,' + btoa(binary);
    }

    let domain = 'webpage';
    try {
      domain = new URL(tab.url).hostname.replace(/[^a-z0-9.-]/gi, '_');
    } catch { /* noop */ }

    const pattern = (stored.namingPatterns && stored.namingPatterns.screenshot) || '{domain}-{type}-{date}_{time}';
    const namingHelper = (typeof SourceDownloadNaming !== 'undefined') ? SourceDownloadNaming : null;
    const defaultFn = `${domain}-fullpage-${new Date().toISOString().slice(0, 10)}`;
    const baseFilename = namingHelper ? namingHelper.formatFilename(pattern, { domain, title: tab.title || domain, type: 'screenshot-full' }) : defaultFn;

    chrome.tabs.sendMessage(tab.id, {
      type: 'showFullPageExportModal',
      dataUrl: finalDataUrl,
      width: targetWidth,
      height: targetHeight,
      domain,
      title: tab.title || domain,
      url: tab.url || '',
      baseFilename,
      lang: stored.lang || 'auto'
    }).catch(async (err) => {
      console.warn('Could not show export modal in tab, downloading directly:', err);
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'hideFullPageProgress' });
      } catch { /* noop */ }
      await chrome.downloads.download({
        url: finalDataUrl,
        filename: baseFilename.endsWith('.png') ? baseFilename : baseFilename + '.png',
        saveAs: false,
      });
      recordDownloadMilestone();
    });

    chrome.runtime.sendMessage({ type: 'screenshotDone' }).catch(() => {});
  } catch (err) {
    console.error('Full page capture error:', err);
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'finishFullPageScreenshot' });
      await chrome.tabs.sendMessage(tab.id, { type: 'hideFullPageProgress' });
    } catch { /* noop */ }
    chrome.runtime.sendMessage({ type: 'screenshotError', message: String(err) }).catch(() => {});
  }
}

async function runOfflinePageArchive(tab) {
  if (!tab || !tab.id) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = activeTab;
  }
  if (!tab || !tab.id) {
    chrome.runtime.sendMessage({ type: 'archiveError', message: 'No active tab found.' }).catch(() => {});
    return;
  }

  try {
    await ensureContentScriptInjected(tab.id);

    chrome.tabs.sendMessage(tab.id, {
      type: 'showToast',
      text: 'Building self-contained offline archive…',
    }).catch(() => {});

    const data = await chrome.tabs.sendMessage(tab.id, { type: 'getDomAndAssets' });
    if (!data || !data.html) return;

    let domain = 'webpage';
    try {
      domain = new URL(data.location || tab.url).hostname.replace(/[^a-z0-9.-]/gi, '_');
    } catch { /* noop */ }

    const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
    let dataUrl = '';
    try {
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      const base64Html = btoa(unescape(encodeURIComponent(data.html)));
      dataUrl = 'data:text/html;charset=utf-8;base64,' + base64Html;
    }

    const stored = await chrome.storage.local.get({ namingPatterns: {} });
    const pattern = (stored.namingPatterns && stored.namingPatterns.archive) || '{domain}-archive-{date}';
    const namingHelper = (typeof SourceDownloadNaming !== 'undefined') ? SourceDownloadNaming : null;
    const defaultFn = `${domain}-offline-archive-${new Date().toISOString().slice(0, 10)}.html`;
    const filename = namingHelper
      ? namingHelper.formatFilename(pattern, { domain, title: data.title || tab.title || domain, type: 'archive' }, '.html')
      : defaultFn;

    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false,
    });

    recordDownloadMilestone();

    chrome.tabs.sendMessage(tab.id, {
      type: 'showToast',
      text: chrome.i18n.getMessage('toastArchiveCreated') || 'Single-file HTML archive saved.',
    });

    chrome.runtime.sendMessage({ type: 'archiveDone' }).catch(() => {});
  } catch (err) {
    console.error('Offline archive error:', err);
    chrome.runtime.sendMessage({ type: 'archiveError', message: String(err) }).catch(() => {});
  }
}

