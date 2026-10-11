/* Source Download — accessibility helpers for extension pages.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Run after every language change: labels come from the localized titles,
 * so screen readers get the same words as sighted users in all 54 locales. */

'use strict';

(function (root) {
  if (root.SourceDownloadA11y) return;

  // Leading symbols such as "★ Review" or "📄 Text" are decoration.
  const LEADING_SYMBOLS = /^([\p{Extended_Pictographic}\u2190-\u21FF\u2B06\u2B07\u2605\u2715\uFE0F]+)\s*/u;

  // Sets an element's text, hiding a leading emoji/arrow from screen readers.
  function setText(el, text) {
    const m = String(text).match(LEADING_SYMBOLS);
    if (!m) {
      el.textContent = text;
      return;
    }
    el.textContent = '';
    const deco = document.createElement('span');
    deco.setAttribute('aria-hidden', 'true');
    deco.textContent = m[1] + ' ';
    el.append(deco, document.createTextNode(String(text).slice(m[0].length)));
  }

  const SYMBOLS_ONLY = /^[\p{Extended_Pictographic}\u2190-\u21FF\u2B06\u2B07\u2605\u2715\u00D7\uFE0F\s]+$/u;

  function hasVisibleText(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('svg, [aria-hidden="true"]').forEach((n) => n.remove());
    return clone.textContent.trim().length > 0;
  }

  // Icon-only controls get their title as accessible name; icons are hidden.
  function apply(scope) {
    const doc = scope || document;
    doc.querySelectorAll('button svg, a svg, [role="button"] svg').forEach((svg) => svg.setAttribute('aria-hidden', 'true'));
    doc.querySelectorAll('button, a, [role="button"]').forEach((el) => {
      const title = el.getAttribute('title');
      if (!title) return;
      // A label made only of symbols ("✕", "↑") reads as "multiplication x".
      const onlySymbols = el.children.length === 0 && SYMBOLS_ONLY.test(el.textContent.trim());
      if (onlySymbols) {
        const deco = document.createElement('span');
        deco.setAttribute('aria-hidden', 'true');
        deco.textContent = el.textContent.trim();
        el.textContent = '';
        el.appendChild(deco);
      }
      if (onlySymbols || !hasVisibleText(el)) el.setAttribute('aria-label', title);
    });
  }

  root.SourceDownloadA11y = Object.freeze({ apply, setText });
})(typeof globalThis !== 'undefined' ? globalThis : self);
