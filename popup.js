/* Source Download — toolbar popup.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

const CAT_KEY_MAP = {
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
  other: 'catOther',
};

const CATS = [
  { key: 'api', label: 'API' },
  { key: 'image', label: 'Images' },
  { key: 'svg', label: 'SVG' },
  { key: 'video', label: 'Videos' },
  { key: 'audio', label: 'Audio' },
  { key: 'caption', label: 'Captions' },
  { key: 'css', label: 'CSS' },
  { key: 'js', label: 'JS' },
  { key: 'sourcemap', label: 'Source maps' },
  { key: 'font', label: 'Fonts' },
  { key: 'document', label: 'Documents' },
  { key: 'json', label: 'JSON' },
  { key: 'wasm', label: 'WASM' },
  { key: 'manifest', label: 'Manifests' },
  { key: 'other', label: 'Other' },
];

const state = {
  tracking: {},
  counts: {},
  badgeCount: 0,
};
for (const c of CATS) state.tracking[c.key] = true;

let currentLocale = 'auto';
let currentMessages = null;

function resolveLocale(code) {
  if (!code || code === 'auto') {
    const browserLang = (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage)
      ? chrome.i18n.getUILanguage()
      : (navigator.language || 'en');
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

function t(key, fallback) {
  if (currentMessages && currentMessages[key] != null) {
    return currentMessages[key];
  }
  try {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      const m = chrome.i18n.getMessage(key);
      if (m) return m;
    }
  } catch { /* noop */ }
  return fallback !== undefined ? fallback : '';
}

function setPopupLanguage(lang) {
  currentLocale = lang || 'auto';
  const resolved = resolveLocale(currentLocale);
  const dict = (typeof globalScope !== 'undefined' && globalScope.SourceDownloadI18n) || (typeof window !== 'undefined' && window.SourceDownloadI18n);
  if (dict && dict[resolved]) {
    currentMessages = dict[resolved];
  }

  const langSelect = document.getElementById('popup-lang');
  if (langSelect && langSelect.value !== currentLocale) {
    langSelect.value = currentLocale;
  }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.getAttribute('data-i18n');
    const msg = t(k);
    if (msg) el.textContent = msg;
  });

  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const k = el.getAttribute('data-i18n-html');
    const msg = t(k);
    if (msg) el.innerHTML = msg;
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const k = el.getAttribute('data-i18n-title');
    const msg = t(k);
    if (msg) el.title = msg;
  });

  renderList();
}

function allEnabled() {
  return CATS.every((c) => !!state.tracking[c.key]);
}

function sendTracking() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: 'setTracking', tracking: state.tracking }, () => {
      chrome.runtime.sendMessage({ type: 'getState' }, (res) => {
        if (res) {
          state.badgeCount = res.badgeCount || 0;
          updateBadgePreview();
        }
      });
    });
  }
}

function renderList() {
  const list = document.getElementById('tracking-list');
  if (!list) return;
  list.innerHTML = '';

  // Master toggle: on = track every category, off = none.
  const master = document.createElement('div');
  master.className = 'tracking-row tracking-row--master';
  const masterLabel = document.createElement('span');
  masterLabel.className = 'tracking-row__label';
  masterLabel.textContent = t('popupTrackAll', 'Track all categories');
  const masterCount = document.createElement('span');
  masterCount.className = 'tracking-row__count';
  masterCount.textContent = state.counts.all || 0;
  const masterToggle = document.createElement('button');
  masterToggle.type = 'button';
  masterToggle.className = 'toggle' + (allEnabled() ? ' toggle--on' : '');
  masterToggle.setAttribute('role', 'switch');
  masterToggle.setAttribute('aria-checked', String(allEnabled()));
  masterToggle.setAttribute('aria-label', t('popupTrackAll', 'Track all categories'));
  masterToggle.addEventListener('click', () => {
    const target = !allEnabled();
    for (const c of CATS) state.tracking[c.key] = target;
    sendTracking();
    renderList();
  });
  master.appendChild(masterLabel);
  master.appendChild(masterCount);
  master.appendChild(masterToggle);
  list.appendChild(master);

  for (const c of CATS) {
    const row = document.createElement('div');
    row.className = 'tracking-row';
    const label = document.createElement('span');
    label.className = 'tracking-row__label';
    const msgKey = CAT_KEY_MAP[c.key];
    const catTitle = msgKey ? t(msgKey, c.label) : c.label;
    label.textContent = catTitle;
    const count = document.createElement('span');
    count.className = 'tracking-row__count';
    count.textContent = state.counts[c.key] || 0;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toggle' + (state.tracking[c.key] ? ' toggle--on' : '');
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', String(!!state.tracking[c.key]));
    toggle.setAttribute('aria-label', (t('popupTrackAll', 'Track') + ' ' + catTitle));
    toggle.addEventListener('click', () => {
      state.tracking[c.key] = !state.tracking[c.key];
      sendTracking();
      renderList();
    });
    row.appendChild(label);
    row.appendChild(count);
    row.appendChild(toggle);
    list.appendChild(row);
  }
  updateBadgePreview();
}

function updateCounts() {
  const rows = document.querySelectorAll('.tracking-row__count');
  const cats = [{ key: 'all' }].concat(CATS);
  cats.forEach((t, i) => {
    if (rows[i]) rows[i].textContent = state.counts[t.key] || 0;
  });
  updateBadgePreview();
}

function updateBadgePreview() {
  const el = document.getElementById('badge-preview');
  if (!el) return;
  const n = state.badgeCount;
  el.hidden = n === 0;
  if (n) el.textContent = n > 9999 ? Math.round(n / 1000) + 'K' : String(n);
}

let refreshTimer = null;
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'resourceCounts') {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: 'getState' }, (res) => {
            if (res) {
              state.counts = res.counts || {};
              state.badgeCount = res.badgeCount || 0;
              updateCounts();
            }
          });
        }
      }, 400);
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
  chrome.runtime.sendMessage({ type: 'getState' }, (res) => {
    if (res) {
      state.tracking = res.tracking || state.tracking;
      state.counts = res.counts || {};
      state.badgeCount = res.badgeCount || 0;
      renderList();
    }
  });
}

// Sync language changes in real-time
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      const newLang = changes.lang ? changes.lang.newValue : (changes.panelPrefs && changes.panelPrefs.newValue ? changes.panelPrefs.newValue.lang : null);
      if (newLang && newLang !== currentLocale) {
        setPopupLanguage(newLang);
      }
    }
  });
}

async function initPopup() {
  let savedLang = 'auto';
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const data = await chrome.storage.local.get({ lang: 'auto', panelPrefs: {} });
      savedLang = data.lang || (data.panelPrefs && data.panelPrefs.lang) || 'auto';
    }
  } catch { /* noop */ }
  setPopupLanguage(savedLang);

  const langSelect = document.getElementById('popup-lang');
  if (langSelect) {
    langSelect.addEventListener('change', async (e) => {
      const newLang = e.target.value;
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const data = await chrome.storage.local.get({ panelPrefs: {} });
          const panelPrefs = data.panelPrefs || {};
          panelPrefs.lang = newLang;
          await chrome.storage.local.set({ lang: newLang, panelPrefs });
        }
      } catch { /* noop */ }
      setPopupLanguage(newLang);
    });
  }

  const btnAreaScreenshot = document.getElementById('popup-btn-area-screenshot');
  if (btnAreaScreenshot) {
    btnAreaScreenshot.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'triggerAreaCapture' });
        window.close();
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}
