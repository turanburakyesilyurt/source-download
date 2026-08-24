/* Source Download — background service worker.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Aggregates per-tab resource counts reported by
 * content scripts (and the DevTools panel when it is open) and maintains the
 * toolbar badge. Which categories count is controlled from the popup
 * ("tracking" toggles), persisted in storage. */

'use strict';

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
  }
  return undefined;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const a = countsByTab.delete(tabId);
  const b = panelCountsByTab.delete(tabId);
  if (a || b) updateBadge();
});
