/* Source Download — shared locale resolver.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * One implementation for the panel, popup, service worker and content script,
 * so every surface picks the same language (e.g. zh-HK → zh_TW, nb → no).
 * Safe to load more than once in the same world. */

'use strict';

(function (root) {
  if (root.SourceDownloadLocale) return;

  const SUPPORTED = ['am', 'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'en_GB', 'en_US', 'es', 'es_419', 'et', 'fa', 'fi', 'fil', 'fr', 'gu', 'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lt', 'lv', 'ml', 'mr', 'ms', 'nl', 'no', 'pl', 'pt_BR', 'pt_PT', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta', 'te', 'th', 'tr', 'uk', 'vi', 'zh_CN', 'zh_TW'];
  const RTL = ['ar', 'he', 'fa'];

  function browserLanguage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage) {
        const ui = chrome.i18n.getUILanguage();
        if (ui) return ui;
      }
    } catch { /* noop */ }
    return (typeof navigator !== 'undefined' && navigator.language) || 'en';
  }

  // Maps any BCP 47 / Chrome locale code onto one of SUPPORTED.
  function normalize(code) {
    const lower = String(code || '').trim().toLowerCase().replace(/-/g, '_');
    if (!lower) return 'en';
    for (const loc of SUPPORTED) {
      if (loc.toLowerCase() === lower) return loc;
    }
    if (/^zh_(tw|hk|mo|hant)/.test(lower)) return 'zh_TW';
    if (lower.startsWith('zh')) return 'zh_CN';
    if (lower.startsWith('pt_pt')) return 'pt_PT';
    if (lower.startsWith('pt')) return 'pt_BR';
    if (lower.startsWith('es_419') || /^es_(mx|ar|co|cl|pe|ve|uy|ec|bo|py|cr|pa|do|gt|hn|ni|sv|pr|cu|us)/.test(lower)) return 'es_419';
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('en_gb') || /^en_(au|nz|ie|za|in)/.test(lower)) return 'en_GB';
    if (lower.startsWith('en_us')) return 'en_US';
    if (lower.startsWith('nb') || lower.startsWith('nn')) return 'no';
    if (lower.startsWith('tl')) return 'fil';
    const prefix = lower.split('_')[0];
    for (const loc of SUPPORTED) {
      if (loc.toLowerCase() === prefix) return loc;
    }
    return 'en';
  }

  // "auto" (or empty) follows the browser UI language.
  function resolve(pref) {
    return normalize(!pref || pref === 'auto' ? browserLanguage() : pref);
  }

  // Fills "$name$" placeholders case-insensitively; values are inserted literally.
  function fill(template, vars) {
    let out = String(template == null ? '' : template);
    for (const [k, v] of Object.entries(vars || {})) {
      out = out.replace(new RegExp('\\$' + k + '\\$', 'gi'), () => String(v));
    }
    return out;
  }

  // Reads one _locales/<loc>/messages.json as a flat { key: message } map.
  const cache = {};
  function fetchLocale(loc) {
    if (!cache[loc]) {
      cache[loc] = fetch(chrome.runtime.getURL('_locales/' + loc + '/messages.json'))
        .then((res) => (res.ok ? res.json() : {}))
        .then((raw) => {
          const out = {};
          for (const [k, v] of Object.entries(raw || {})) out[k] = (v && v.message) || '';
          return out;
        })
        .catch(() => {
          delete cache[loc];
          return {};
        });
    }
    return cache[loc];
  }

  // Messages for the resolved locale, with English filling any gaps.
  async function loadMessages(pref) {
    const locale = resolve(pref);
    const [en, own] = await Promise.all([fetchLocale('en'), locale === 'en' ? null : fetchLocale(locale)]);
    return { locale, messages: Object.assign({}, en, own || {}) };
  }

  root.SourceDownloadLocale = Object.freeze({ SUPPORTED, RTL, normalize, resolve, fill, browserLanguage, loadMessages });
})(typeof globalThis !== 'undefined' ? globalThis : self);
