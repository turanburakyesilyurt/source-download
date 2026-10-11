/* Source Download — background service worker.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Keeps the context menu and the full-page / archive capture pipeline.
 * Nothing runs on web pages until the user asks: the capture tools
 * (content.js) are injected only when one of them is used. */

'use strict';

try {
  importScripts('lib/locale.js', 'lib/naming.js');
} catch (e) {
  console.warn('Could not import lib/locale.js or lib/naming.js in service worker:', e);
}

/* ============================================================
 * Per-tab state (only: how many elements were hidden in this tab)
 * ============================================================ */

// The toolbar badge and page counting were removed in 1.18: counts are only
// reliable inside the DevTools panel, which sees every network request.
// One storage key per tab; writes for the same tab are queued.
const tabKey = (tabId) => 'sdTab:' + tabId;
const writeQueues = new Map();

async function readTab(tabId) {
  try {
    const key = tabKey(tabId);
    return (await chrome.storage.session.get(key))[key] || null;
  } catch {
    return null;
  }
}

function writeTabState(tabId, patch) {
  const prev = writeQueues.get(tabId) || Promise.resolve();
  const next = prev.then(async () => {
    const key = tabKey(tabId);
    if (patch === null) {
      await chrome.storage.session.remove(key);
      writeQueues.delete(tabId);
      return null;
    }
    const value = Object.assign({}, await readTab(tabId), patch);
    await chrome.storage.session.set({ [key]: value });
    return value;
  }).catch(() => null);
  writeQueues.set(tabId, next);
  return next;
}

function isRestrictedUrl(url) {
  return !url || /^(chrome|edge|about|devtools|chrome-extension|view-source):/i.test(url) ||
    url.includes('chromewebstore.google.com') || url.includes('chrome.google.com/webstore');
}

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') writeTabState(tabId, { zapped: 0 }).then(() => syncUndoMenu(tabId));
});

chrome.tabs.onActivated.addListener(({ tabId }) => syncUndoMenu(tabId));

chrome.tabs.onRemoved.addListener((tabId) => {
  writeTabState(tabId, null);
});

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

// Clear a badge left by versions up to 1.17.
chrome.action.setBadgeText({ text: '' }).catch(() => {});
chrome.storage.local.remove('tracking').catch(() => {});

// Optional "why did you remove it?" form (GitHub issue template in the public repo).
try {
  chrome.runtime.setUninstallURL('https://github.com/turanburakyesilyurt/source-download/issues/new?template=uninstall-feedback.yml');
} catch { /* noop */ }

/* ============================================================
 * Localization (shared resolver, one locale loaded at a time)
 * ============================================================ */

let currentBackgroundLang = 'auto';
let bgMessages = {};

async function loadBackgroundMessages(lang) {
  const res = await SourceDownloadLocale.loadMessages(lang || currentBackgroundLang);
  bgMessages = res.messages;
  return res;
}

function getMenuTitle(key, fallback) {
  return bgMessages[key] || fallback;
}

async function getLocalizedMessage(key, fallback) {
  try {
    const stored = await chrome.storage.local.get({ lang: 'auto' });
    const { messages } = await SourceDownloadLocale.loadMessages(stored.lang || 'auto');
    return messages[key] || fallback;
  } catch {
    return getMenuTitle(key, fallback);
  }
}

/* ============================================================
 * On-demand capture tools (content.js)
 * ============================================================ */

// Installs the capture tools in the tab if they are not there yet and hands
// them the dictionary for the user's language (only that one locale).
async function ensureContentScriptInjected(tabId) {
  if (!tabId) throw new Error('No active tab available.');
  const tab = await chrome.tabs.get(tabId);
  if (!tab || isRestrictedUrl(tab.url)) {
    throw new Error('Extensions cannot run on restricted browser or Web Store pages.');
  }

  const stored = await chrome.storage.local.get({ lang: 'auto' });
  const { locale, messages } = await SourceDownloadLocale.loadMessages(stored.lang || 'auto');
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (loc, msgs) => {
      const g = globalThis;
      g.SourceDownloadI18n = g.SourceDownloadI18n || {};
      g.SourceDownloadI18n[loc] = msgs;
    },
    args: [locale, messages],
  });

  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    if (res && res.pong) return true;
  } catch {
    // Capture tools not installed in this document yet.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['lib/locale.js', 'lib/naming.js', 'lib/pdf.js', 'lib/gif.js', 'content.js'],
  });
  return true;
}

async function startTool(type, extra) {
  const tab = await activeTab();
  if (!tab || !tab.id) throw new Error('No active tab available.');
  await ensureContentScriptInjected(tab.id);
  const stored = await chrome.storage.local.get({ lang: 'auto' });
  await chrome.tabs.sendMessage(tab.id, Object.assign({ type, lang: stored.lang || 'auto' }, extra || {}));
  return tab;
}

/* ============================================================
 * Fetch in the page's own context (cookies, session, CORS of the site)
 * ============================================================ */

// Used by the DevTools panel when a direct fetch fails (signed-in or
// CORS-protected resources, HLS segments). chrome.scripting waits for the
// promise, unlike devtools.inspectedWindow.eval which cannot await.
async function fetchInPage(tabId, url) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (u) => {
      try {
        const resp = await fetch(u, { credentials: 'include' });
        if (!resp.ok) return { ok: false, status: resp.status };
        const bytes = new Uint8Array(await resp.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return { ok: true, b64: btoa(bin), type: resp.headers.get('content-type') || '' };
      } catch (e) {
        return { ok: false, error: String(e && e.message || e) };
      }
    },
    args: [url],
  });
  return (res && res.result) || { ok: false };
}

/* ============================================================
 * Messages
 * ============================================================ */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return undefined;
  if (msg.type === 'panelCounts' || msg.type === 'refreshBadge') {
    sendResponse({ ok: true }); // sent by older panels / tabs; nothing to do
  } else if (msg.type === 'zapState') {
    if (sender.tab && sender.tab.id !== undefined) {
      writeTabState(sender.tab.id, { zapped: msg.count || 0 }).then(() => syncUndoMenu(sender.tab.id));
    }
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
        const tab = await activeTab();
        if (!tab || !tab.id) throw new Error('No active tab available.');
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        await startTool('startAreaCapture', { dataUrl });
        sendResponse({ ok: true });
      } catch (e) {
        console.warn('triggerAreaCapture failed:', e);
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  } else if (msg.type === 'triggerAreaVideoRecord' || msg.type === 'triggerColorPicker') {
    (async () => {
      try {
        await startTool(msg.type === 'triggerColorPicker' ? 'startColorPicker' : 'startAreaVideoRecord');
        sendResponse({ ok: true });
      } catch (e) {
        console.warn(msg.type + ' failed:', e);
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  } else if (msg.type === 'fetchInPage') {
    fetchInPage(msg.tabId, msg.url)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  } else if (msg.type === 'recordMilestone') {
    recordDownloadMilestone().then(() => sendResponse({ ok: true }));
    return true;
  }
  return undefined;
});

/* ============================================================
 * Context menu
 * ============================================================ */

let menuSetup = Promise.resolve();

function setupContextMenus(lang) {
  if (lang) currentBackgroundLang = lang;
  menuSetup = menuSetup.then(async () => {
    try {
      await loadBackgroundMessages(currentBackgroundLang);
    } catch { /* fall back to English titles */ }
    await new Promise((resolve) => chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError;
      resolve();
    }));
    const items = [
      { id: 'sd-zap-element', title: getMenuTitle('contextMenuZap', 'Hide this element') },
      { id: 'sd-undo-zap', title: getMenuTitle('contextMenuUndoZap', 'Restore last hidden element'), visible: false },
      { id: 'sd-reset-zap', title: getMenuTitle('contextMenuResetZap', 'Reset all hidden elements'), visible: false },
      { id: 'sd-sep-1', type: 'separator' },
      { id: 'sd-capture-area', title: getMenuTitle('contextMenuCaptureArea', 'Capture area screenshot') },
      { id: 'sd-record-area', title: getMenuTitle('contextMenuRecordArea', 'Record area as video / GIF') },
      { id: 'sd-pick-color', title: getMenuTitle('contextMenuPickColor', 'Pick color from screen') },
      { id: 'sd-sep-2', type: 'separator' },
      { id: 'sd-capture-page', title: getMenuTitle('contextMenuCapturePage', 'Capture full page screenshot') },
      { id: 'sd-page-archive', title: getMenuTitle('contextMenuPageArchive', 'Download offline page archive') },
    ];
    for (const item of items) {
      chrome.contextMenus.create(Object.assign({ contexts: ['all'] }, item), () => {
        void chrome.runtime.lastError;
      });
    }
    // Menus outlive the service worker, so remember which language they were
    // built in; a restart compares against this instead of an in-memory value.
    await chrome.storage.local.set({ menuLang: currentBackgroundLang });
    const tab = await activeTab().catch(() => null);
    if (tab) await syncUndoMenu(tab.id);
  }).catch((e) => console.warn('Context menu creation error:', e));
  return menuSetup;
}

// "Restore" / "Reset" only make sense once something was hidden in this tab.
async function syncUndoMenu(tabId) {
  const entry = await readTab(tabId);
  const visible = Boolean(entry && entry.zapped > 0);
  for (const id of ['sd-undo-zap', 'sd-reset-zap']) {
    chrome.contextMenus.update(id, { visible }, () => void chrome.runtime.lastError);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get({ lang: 'auto' }, (data) => {
    currentBackgroundLang = data.lang || 'auto';
    setupContextMenus(currentBackgroundLang);
  });
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') }).catch(() => {});
  }
});

// The stored language can change while this worker sleeps (the event that
// wakes it may arrive after the value was read here), so the menus are rebuilt
// whenever the language they were built in differs from the chosen one.
function syncMenuLanguage(lang) {
  currentBackgroundLang = lang || 'auto';
  return chrome.storage.local.get({ menuLang: null }).then(({ menuLang }) => {
    if (menuLang !== currentBackgroundLang) return setupContextMenus(currentBackgroundLang);
    return loadBackgroundMessages(currentBackgroundLang);
  }).catch(() => {});
}

chrome.storage.local.get({ lang: 'auto' }, (data) => {
  syncMenuLanguage(data.lang || 'auto');
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    const newLang = changes.lang ? changes.lang.newValue : (changes.panelPrefs && changes.panelPrefs.newValue ? changes.panelPrefs.newValue.lang : null);
    if (newLang) syncMenuLanguage(newLang);
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
  const stored = await chrome.storage.local.get({ lang: 'auto' });
  const lang = stored.lang || 'auto';
  const send = (message) => chrome.tabs.sendMessage(tab.id, message, () => void chrome.runtime.lastError);

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
    send({
      type: 'zapLastElement',
      frameId: info.frameId || 0,
      frameUrl: info.frameUrl || '',
      srcUrl: info.srcUrl || '',
      linkUrl: info.linkUrl || ''
    });
  } else if (info.menuItemId === 'sd-undo-zap') {
    send({ type: 'undoZapElement' });
  } else if (info.menuItemId === 'sd-reset-zap') {
    send({ type: 'resetAllZap' });
  } else if (info.menuItemId === 'sd-capture-area') {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      send({ type: 'startAreaCapture', dataUrl, lang });
    } catch (err) {
      console.warn('Area screenshot capture failed:', err);
    }
  } else if (info.menuItemId === 'sd-record-area') {
    send({ type: 'startAreaVideoRecord', lang });
  } else if (info.menuItemId === 'sd-pick-color') {
    send({ type: 'startColorPicker', lang });
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
    chrome.runtime.sendMessage({ type: 'screenshotError', message: await getLocalizedMessage('errNoActiveTab', 'No active tab found.') }).catch(() => {});
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
    chrome.runtime.sendMessage({ type: 'archiveError', message: await getLocalizedMessage('errNoActiveTab', 'No active tab found.') }).catch(() => {});
    return;
  }

  try {
    await ensureContentScriptInjected(tab.id);

    chrome.tabs.sendMessage(tab.id, {
      type: 'showToast',
      text: await getLocalizedMessage('toastArchiveCreating', 'Creating offline page archive…'),
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
      text: await getLocalizedMessage('toastArchiveCreated', 'Single-file HTML archive saved.'),
    });

    chrome.runtime.sendMessage({ type: 'archiveDone' }).catch(() => {});
  } catch (err) {
    console.error('Offline archive error:', err);
    chrome.runtime.sendMessage({ type: 'archiveError', message: String(err) }).catch(() => {});
  }
}

