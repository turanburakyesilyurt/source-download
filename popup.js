/* Source Download — toolbar popup.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * A launcher for the capture tools of the current page. File lists and
 * counts live in the DevTools panel, which sees every network request.
 */
'use strict';

let currentLocale = 'auto';
let currentMessages = null;

function t(key, fallback) {
  if (currentMessages && currentMessages[key] != null) return currentMessages[key];
  return fallback !== undefined ? fallback : '';
}

async function setPopupLanguage(lang) {
  currentLocale = lang || 'auto';
  const { locale: resolved, messages } = await SourceDownloadLocale.loadMessages(currentLocale);
  currentMessages = messages;
  document.documentElement.setAttribute('dir', SourceDownloadLocale.RTL.includes(resolved) ? 'rtl' : 'ltr');
  document.documentElement.lang = resolved.replace('_', '-');

  const langSelect = document.getElementById('popup-lang');
  if (langSelect && langSelect.value !== currentLocale) langSelect.value = currentLocale;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const msg = t(el.getAttribute('data-i18n'));
    if (msg) SourceDownloadA11y.setText(el, msg);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const msg = t(el.getAttribute('data-i18n-title'));
    if (msg) el.title = msg;
  });
  SourceDownloadA11y.apply(document);
}

// Capture tools run in the page; the popup only starts them and closes.
const ACTIONS = {
  'popup-btn-full-page': 'captureFullPage',
  'popup-btn-area-screenshot': 'triggerAreaCapture',
  'popup-btn-record-area': 'triggerAreaVideoRecord',
  'popup-btn-pick-color': 'triggerColorPicker',
  'popup-btn-offline': 'capturePageArchive',
};

const RESTRICTED = /^(chrome|edge|about|devtools|chrome-extension|view-source|file):|chromewebstore\.google\.com|chrome\.google\.com\/webstore/i;

async function markRestrictedPage() {
  let url = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    url = (tab && tab.url) || '';
  } catch { /* noop */ }
  const restricted = !url || RESTRICTED.test(url);
  document.getElementById('popup-restricted').hidden = !restricted;
  for (const id of Object.keys(ACTIONS)) document.getElementById(id).disabled = restricted;
}

async function initPopup() {
  let savedLang = 'auto';
  try {
    const data = await chrome.storage.local.get({ lang: 'auto', panelPrefs: {} });
    savedLang = data.lang || (data.panelPrefs && data.panelPrefs.lang) || 'auto';
  } catch { /* noop */ }
  await setPopupLanguage(savedLang);

  document.getElementById('popup-lang').addEventListener('change', async (e) => {
    const newLang = e.target.value;
    try {
      const data = await chrome.storage.local.get({ panelPrefs: {} });
      const panelPrefs = data.panelPrefs || {};
      panelPrefs.lang = newLang;
      await chrome.storage.local.set({ lang: newLang, panelPrefs });
    } catch { /* noop */ }
    setPopupLanguage(newLang);
  });

  for (const [id, type] of Object.entries(ACTIONS)) {
    document.getElementById(id).addEventListener('click', () => {
      chrome.runtime.sendMessage({ type }, () => void chrome.runtime.lastError);
      window.close();
    });
  }
  document.getElementById('popup-btn-guide').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    window.close();
  });

  const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  document.getElementById('devtools-keys').textContent = isMac ? '⌥ ⌘ I' : 'F12';
  try {
    document.getElementById('popup-version').textContent = 'v' + chrome.runtime.getManifest().version;
  } catch { /* noop */ }
  markRestrictedPage();
}

window.setPopupLanguage = setPopupLanguage;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}
