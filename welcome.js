/* Source Download — first-run welcome page.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

(async () => {
  const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  document.getElementById('devtools-keys').textContent = isMac ? '⌥ ⌘ I' : 'F12';

  let pref = 'auto';
  try {
    pref = (await chrome.storage.local.get({ lang: 'auto' })).lang || 'auto';
  } catch { /* noop */ }
  const { locale, messages } = await SourceDownloadLocale.loadMessages(pref);
  document.documentElement.lang = locale.replace('_', '-');
  document.documentElement.dir = SourceDownloadLocale.RTL.includes(locale) ? 'rtl' : 'ltr';
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const msg = messages[el.getAttribute('data-i18n')];
    if (msg) el.textContent = msg;
  }
  if (messages.welcomeTitle) document.title = messages.welcomeTitle;
})();
