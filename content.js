/* Source Download — content script.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Page-side capture tools: element hider, area screenshot, area video/GIF
 * recording, color picker, full-page screenshot helpers and the offline page
 * archive. Injected by the service worker only when the user starts one of
 * them (see ensureContentScriptInjected in background.js). */

(() => {
  // Injected on demand by the service worker; never install twice in one document.
  if (window.__sdCaptureToolsLoaded) return;
  window.__sdCaptureToolsLoaded = true;

  function reportZapState() {
    try {
      chrome.runtime.sendMessage({ type: 'zapState', count: zappedStack.length }, () => void chrome.runtime.lastError);
    } catch { /* noop */ }
  }

  /* ============================================================
   * Element Zapper & Full Page Screenshot Integration
   * ============================================================ */

  // content-context.js (the only always-on script) remembers the last
  // right-click, because these tools are injected after the menu was opened.
  const sdCtx = window.__sdContext || {};
  let lastRightClickTarget = sdCtx.target || null;
  let lastMouseX = typeof sdCtx.x === 'number' ? sdCtx.x : window.innerWidth / 2;
  let lastMouseY = typeof sdCtx.y === 'number' ? sdCtx.y : window.innerHeight / 2;

  ['mousemove', 'pointermove', 'mousedown', 'contextmenu'].forEach((evt) => {
    window.addEventListener(evt, (e) => {
      if (e.clientX !== undefined && e.clientY !== undefined) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
      if (evt === 'contextmenu') {
        lastRightClickTarget = e.target;
      }
    }, { capture: true, passive: true });
  });

  const zappedStack = [];

  // Light theme shared by every on-page tool (toolbars, dialogs, toasts).
  // Inline styles reference these variables; every tool root has an
  // "__sd_" id, so the variables never leak into the page's own elements.
  function sdEnsureTheme() {
    if (document.getElementById('__sd_ui_theme')) return;
    const style = document.createElement('style');
    style.id = '__sd_ui_theme';
    style.textContent = [
      '[id^="__sd_"]{--sd-surface:rgba(255,255,255,0.97);--sd-surface-2:#f3f5fa;--sd-canvas:#eef1f6;',
      '--sd-border:rgba(16,24,40,0.11);--sd-border-strong:rgba(16,24,40,0.2);--sd-chip:rgba(16,24,40,0.05);',
      '--sd-hover:#e8ecf4;--sd-text:#1b1f29;--sd-muted:#5f6675;--sd-accent:#2f63e0;',
      '--sd-shadow:0 12px 32px rgba(16,24,40,0.16),0 2px 6px rgba(16,24,40,0.08);',
      '--sd-shadow-lg:0 24px 60px rgba(16,24,40,0.28);color-scheme:light;}',
      '[id^="__sd_"] button[style*="var(--sd-surface-2)"]:not(:disabled):hover{background:var(--sd-hover)!important;}',
      '[id^="__sd_"] button[style*="var(--sd-chip)"]:not(:disabled):hover{background:var(--sd-hover)!important;}',
      '[id^="__sd_"] button[style*="var(--sd-accent)"]:not(:disabled):hover{filter:brightness(1.1);}',
      '[id^="__sd_"] button[style*="background:transparent"][style*="var(--sd-muted)"]:hover{color:var(--sd-text)!important;background:var(--sd-hover)!important;}',
      '[id^="__sd_"] .__sd_tb_tool:hover{box-shadow:inset 0 0 0 1px var(--sd-border-strong);}',
      '[id^="__sd_"] button:focus-visible{outline:2px solid var(--sd-accent);outline-offset:2px;}',
    ].join('');
    (document.head || document.documentElement).appendChild(style);
  }
  sdEnsureTheme();

  function showToast(text) {
    sdEnsureTheme();
    let toast = document.getElementById('__sd_toast_notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = '__sd_toast_notification';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--sd-surface);color:var(--sd-text);padding:9px 18px;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:13px;font-weight:500;box-shadow:var(--sd-shadow);border:1px solid var(--sd-border);z-index:2147483647;pointer-events:none;transition:opacity 0.25s ease, transform 0.25s ease;opacity:0;';
      document.documentElement.appendChild(toast);
    }
    toast.textContent = text;
    try {
      toast.dir = SD_RTL_LOCALES.includes(resolveDict().lang) ? 'rtl' : 'ltr';
    } catch { /* noop */ }
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    if (toast.__timer) clearTimeout(toast.__timer);
    toast.__timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
    }, 2200);
  }

  function isProtectedElement(el) {
    if (!el || el === document.documentElement || el === document.body) return true;
    const tag = el.tagName.toUpperCase();
    if (['HTML', 'BODY', 'MAIN', 'NAV', 'HEADER', 'FOOTER'].includes(tag)) return true;
    const id = (el.id || '').toLowerCase();
    if (['app', 'root', '__next', 'content', 'main-content', 'main', 'page', 'layout', 'container', 'wrapper', 'react-root'].includes(id)) {
      return true;
    }
    const role = (el.getAttribute && el.getAttribute('role') || '').toLowerCase();
    if (role === 'main' || role === 'application') return true;

    // Reject layout containers occupying > 80% viewport area with multiple children
    if (tag !== 'IFRAME') {
      try {
        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (rect.width >= vw * 0.8 && rect.height >= vh * 0.8 && el.children && el.children.length >= 2) {
          return true;
        }
      } catch { /* noop */ }
    }
    return false;
  }

  function zapElement(el, frameInfo = null) {
    let target = el;

    // If target is missing or root/body, try frame matching
    if ((!target || target === document.documentElement || target === document.body) && frameInfo) {
      const frames = Array.from(document.querySelectorAll('iframe, embed, object'));
      if (frameInfo.frameUrl || frameInfo.srcUrl) {
        target = frames.find((f) => {
          try {
            const fsrc = f.src || f.getAttribute('src') || '';
            if (!fsrc) return false;
            if (frameInfo.frameUrl && (fsrc === frameInfo.frameUrl || frameInfo.frameUrl.startsWith(fsrc) || fsrc.startsWith(frameInfo.frameUrl))) return true;
            if (frameInfo.srcUrl && (fsrc === frameInfo.srcUrl || frameInfo.srcUrl.startsWith(fsrc))) return true;
            return false;
          } catch {
            return false;
          }
        });
      }

      // If still not found, check if last mouse position intersected any iframe
      if (!target && typeof lastMouseX === 'number' && typeof lastMouseY === 'number') {
        target = frames.find((f) => {
          try {
            const r = f.getBoundingClientRect();
            return lastMouseX >= r.left && lastMouseX <= r.right && lastMouseY >= r.top && lastMouseY <= r.bottom;
          } catch {
            return false;
          }
        });
      }
    }

    if (!target || target === document.documentElement || target === document.body) {
      if (typeof lastMouseX === 'number' && typeof lastMouseY === 'number') {
        target = document.elementFromPoint(lastMouseX, lastMouseY);
      }
    }

    if (!target || target === document.documentElement || target === document.body) return false;

    // Detect if target is an ad or inside a specific ad unit wrapper (NEVER match generic layout classes or position:fixed)
    let adWrapper = null;
    try {
      adWrapper = target.closest(
        'ins.adsbygoogle, [id^="aswift_"], [id^="google_ads_"], [id^="ad-slot"], [id^="ad_unit"], [class^="ad-slot"], [class*="ad-container-"], [class*="ads-box"], [data-ad-client], [data-ad-slot], [data-google-query-id]'
      );
    } catch { /* noop */ }

    // Safety checks: Never allow an ad wrapper to be a protected element
    if (adWrapper && isProtectedElement(adWrapper)) {
      adWrapper = null;
    }

    let finalTarget = adWrapper || target;

    // If finalTarget is protected, fall back to target if target is not protected
    if (isProtectedElement(finalTarget)) {
      if (finalTarget !== target && !isProtectedElement(target)) {
        finalTarget = target;
      } else {
        // Abort to protect user's page layout
        return false;
      }
    }

    const prevDisplay = finalTarget.style.display;
    finalTarget.style.setProperty('display', 'none', 'important');
    finalTarget.setAttribute('data-sd-zapped', 'true');
    zappedStack.push({ el: finalTarget, prevDisplay });

    try {
      const isAd = Boolean(adWrapper || finalTarget.tagName === 'IFRAME');
      showToast(isAd
        ? sdMsg('toastElementZappedAd', 'Ad / iframe hidden for this session.')
        : sdMsg('toastElementZapped', 'Element hidden for this session.'));
    } catch {
      showToast('Element hidden for this session.');
    }
    reportZapState();
    return true;
  }

  function undoZap() {
    if (zappedStack.length === 0) return;
    const item = zappedStack.pop();
    if (item && item.el) {
      item.el.style.display = item.prevDisplay || '';
      item.el.removeAttribute('data-sd-zapped');
      try {
        showToast(sdMsg('toastElementRestored', 'Element restored.'));
      } catch {
        showToast('Element restored.');
      }
      reportZapState();
    }
  }

  function resetAllZap() {
    if (zappedStack.length === 0) return;
    while (zappedStack.length > 0) {
      const item = zappedStack.pop();
      if (item && item.el) {
        item.el.style.display = item.prevDisplay || '';
        item.el.removeAttribute('data-sd-zapped');
      }
    }
    try {
      showToast(sdMsg('toastAllElementsRestored', 'All hidden elements restored.'));
    } catch {
      showToast('All hidden elements restored.');
    }
    reportZapState();
  }

  let screenshotState = null;

  function getScrollDimensions() {
    const doc = document.documentElement;
    const body = document.body;
    const scrollHeight = Math.max(
      doc.scrollHeight,
      body ? body.scrollHeight : 0,
      doc.offsetHeight,
      body ? body.offsetHeight : 0,
      doc.clientHeight
    );
    const scrollWidth = Math.max(
      doc.scrollWidth,
      body ? body.scrollWidth : 0,
      doc.offsetWidth,
      body ? body.offsetWidth : 0,
      doc.clientWidth
    );
    const innerHeight = window.innerHeight || doc.clientHeight;
    const innerWidth = window.innerWidth || doc.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    return { scrollHeight, scrollWidth, innerHeight, innerWidth, dpr };
  }

  function prepareScreenshot() {
    const origScrollY = window.scrollY || document.documentElement.scrollTop || (document.body ? document.body.scrollTop : 0);

    // Remove any extension toast immediately so it never appears in screenshots
    const toast = document.getElementById('__sd_toast_notification');
    if (toast) toast.remove();

    let styleEl = document.getElementById('__sd_hide_scrollbar');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = '__sd_hide_scrollbar';
      styleEl.textContent = '::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; } * { scrollbar-width: none !important; }';
      document.documentElement.appendChild(styleEl);
    }

    const modifiedEls = new Map();
    screenshotState = { origScrollY, modifiedEls };
    return getScrollDimensions();
  }

  function isSidebarOrDrawer(el, rect) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const tagName = el.tagName.toLowerCase();
    const idOrClass = ((el.id || '') + ' ' + (el.className || '')).toLowerCase();
    if (
      tagName.includes('drawer') ||
      tagName.includes('guide') ||
      tagName.includes('sidebar') ||
      tagName.includes('sidenav') ||
      tagName.includes('aside') ||
      idOrClass.includes('drawer') ||
      idOrClass.includes('guide') ||
      idOrClass.includes('sidebar') ||
      idOrClass.includes('sidenav') ||
      idOrClass.includes('side-menu') ||
      idOrClass.includes('navigation-rail') ||
      idOrClass.includes('nav-rail')
    ) {
      return true;
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // A vertical column panel attached to an edge (e.g. YouTube left guide or docs sidebar)
    if (rect.height > vh * 0.35 && rect.width < vw * 0.45 && (rect.left <= 30 || rect.right >= vw - 30)) {
      return true;
    }
    return false;
  }

  function shouldHideRepeatingSticky(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el.id === '__sd_hide_scrollbar' || el.id === '__sd_toast_notification' || el.id === '__sd_fps_progress') return false;
    if (el.id && el.id.startsWith('__sd_')) return true;

    const pos = window.getComputedStyle(el).position;
    if (pos !== 'fixed' && pos !== 'sticky') return false;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Fullscreen wrappers or overlays
    if (rect.width >= vw * 0.95 && rect.height >= vh * 0.95) return false;

    // NEVER hide sidebars, navigation drawers, or anything inside them
    if (isSidebarOrDrawer(el, rect)) return false;
    if (el.closest('tp-yt-app-drawer, ytd-mini-guide-renderer, aside, [id*="guide"], [id*="sidebar"], [class*="sidebar"], [class*="drawer"]')) {
      return false;
    }

    // Top horizontal bars / navbars (e.g. YouTube masthead, site navbars)
    if (rect.top <= 15 && rect.height <= 220 && rect.width >= vw * 0.4) {
      return true;
    }

    // Bottom horizontal bars (e.g. cookie notices, bottom toolbars)
    if (rect.bottom >= vh - 15 && rect.height <= 220 && rect.width >= vw * 0.4) {
      return true;
    }

    // Small floating corner buttons / badges (e.g. chat bubbles, back-to-top) on step >= 1
    if (rect.width <= 140 && rect.height <= 140) {
      return true;
    }

    return false;
  }

  function hideSticky() {
    if (!screenshotState || !screenshotState.modifiedEls) return;
    try {
      const all = document.querySelectorAll('*');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (shouldHideRepeatingSticky(el)) {
          if (!screenshotState.modifiedEls.has(el)) {
            screenshotState.modifiedEls.set(el, { vis: el.style.visibility, op: el.style.opacity });
          }
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
        }
      }
    } catch { /* noop */ }
  }

  function finishScreenshot() {
    if (!screenshotState) return;
    if (screenshotState.modifiedEls) {
      for (const [el, orig] of screenshotState.modifiedEls) {
        el.style.visibility = orig.vis || '';
        el.style.opacity = orig.op || '';
      }
    }
    const styleEl = document.getElementById('__sd_hide_scrollbar');
    if (styleEl) styleEl.remove();

    window.scrollTo({ top: screenshotState.origScrollY, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = screenshotState.origScrollY;
    if (document.body) document.body.scrollTop = screenshotState.origScrollY;
    screenshotState = null;
  }

  // Offline archive budget: embeds as much as fits, links the rest absolutely.
  const ARCHIVE_MAX_FILE = 15 * 1024 * 1024;
  const ARCHIVE_MAX_TOTAL = 80 * 1024 * 1024;

  function createAssetInliner() {
    const cache = new Map();
    let total = 0;
    return async function inline(url) {
      if (!url || /^(data|blob|javascript|about):/i.test(url)) return null;
      let abs;
      try { abs = new URL(url, window.location.href).href; } catch { return null; }
      if (!cache.has(abs)) {
        cache.set(abs, (async () => {
          try {
            const res = await fetch(abs);
            if (!res.ok) return null;
            const blob = await res.blob();
            if (blob.size > ARCHIVE_MAX_FILE || total + blob.size > ARCHIVE_MAX_TOTAL) return null;
            total += blob.size;
            return await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
          } catch {
            return null;
          }
        })());
      }
      return cache.get(abs);
    };
  }

  async function mapLimit(items, limit, fn) {
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    });
    await Promise.all(workers);
  }

  // Rewrites url(...) references in CSS text: absolute first, then embedded.
  async function inlineCssUrls(cssText, baseUrl, inline) {
    const refs = new Map();
    cssText.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (m, raw) => {
      const ref = raw.trim();
      if (!ref.startsWith('data:') && !ref.startsWith('#')) {
        try { refs.set(ref, new URL(ref, baseUrl).href); } catch { /* noop */ }
      }
      return m;
    });
    const embedded = new Map();
    await mapLimit([...refs.values()], 6, async (abs) => {
      embedded.set(abs, (await inline(abs)) || abs);
    });
    return cssText.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (m, raw) => {
      const abs = refs.get(raw.trim());
      return abs ? `url("${embedded.get(abs) || abs}")` : m;
    });
  }

  // Builds a single-file HTML copy of the page. Works on a clone only — the
  // live page is never modified.
  async function buildSingleFileHtml() {
    const clone = document.documentElement.cloneNode(true);
    const inline = createAssetInliner();

    // Pair cloned <img> with live ones (same order) to read currentSrc, which
    // reflects the srcset candidate the browser actually loaded.
    const livePairs = Array.from(clone.querySelectorAll('img')).map((img, i) => [img, document.images[i]]);

    // Remove zapped elements
    clone.querySelectorAll('[data-sd-zapped]').forEach((el) => el.remove());

    // Remove extension UI if present
    clone.querySelectorAll('[id^="__sd_"]').forEach((el) => el.remove());

    // Ensure <base href="..."> is present in head so relative links stay navigable
    let head = clone.querySelector('head');
    if (!head) {
      head = document.createElement('head');
      clone.insertBefore(head, clone.firstChild);
    }
    let base = head.querySelector('base');
    if (!base) {
      base = document.createElement('base');
      head.insertBefore(base, head.firstChild);
    }
    base.setAttribute('href', window.location.href);

    // 1. Inline external stylesheets (fonts and background images embedded)
    const linkStyles = Array.from(clone.querySelectorAll('link[rel~="stylesheet"]'));
    for (const link of linkStyles) {
      const href = link.href;
      if (!href) continue;
      let cssText = null;
      try {
        const res = await fetch(href);
        if (res.ok) cssText = await res.text();
      } catch { /* fetch failed */ }
      if (cssText === null) {
        try {
          for (const sheet of document.styleSheets) {
            if (sheet.href === href && sheet.cssRules) {
              cssText = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
              break;
            }
          }
        } catch { /* cross-origin CSSOM protected */ }
      }
      if (cssText === null) continue;
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-sd-inlined', 'true');
      styleEl.textContent = await inlineCssUrls(cssText, new URL(href, window.location.href), inline);
      link.parentNode.replaceChild(styleEl, link);
    }
    for (const styleEl of clone.querySelectorAll('style:not([data-sd-inlined])')) {
      styleEl.textContent = await inlineCssUrls(styleEl.textContent || '', window.location.href, inline);
    }

    // 2. Embed images (all of them, within the size budget)
    await mapLimit(livePairs, 6, async ([img, live]) => {
      if (!img.isConnected && !clone.contains(img)) return;
      const src = (live && live.currentSrc) || img.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) return;
      const dataUri = await inline(src);
      try {
        img.setAttribute('src', dataUri || new URL(src, window.location.href).href);
      } catch { /* noop */ }
      if (dataUri) {
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        img.removeAttribute('loading');
        const picture = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : null;
        if (picture) picture.querySelectorAll('source').forEach((s) => s.remove());
      }
    });

    // 3. Inline style="background-image: url(...)" and similar
    const styled = Array.from(clone.querySelectorAll('[style*="url("]'));
    await mapLimit(styled, 6, async (el) => {
      el.setAttribute('style', await inlineCssUrls(el.getAttribute('style') || '', window.location.href, inline));
    });

    // 4. Favicons
    await mapLimit(Array.from(clone.querySelectorAll('link[rel~="icon"][href], link[rel="apple-touch-icon"][href]')), 4, async (link) => {
      const dataUri = await inline(link.getAttribute('href'));
      if (dataUri) link.setAttribute('href', dataUri);
    });

    // Scroll-reveal content is shown in the copy only (never on the live page).
    clone.querySelectorAll('.reveal, [data-aos], .animate, .fade-in, [class*="reveal"]').forEach((el) => {
      el.classList.add('visible', 'aos-animate', 'revealed', 'active');
    });

    // 4. Inject Reveal Fallback CSS so scroll-triggered elements are immediately visible offline
    const revealStyle = document.createElement('style');
    revealStyle.setAttribute('data-sd-reveal-fallback', 'true');
    revealStyle.textContent = `
      /* Source Download: Ensure all scroll-revealed, fade-in and animated elements are 100% visible offline */
      .reveal, [data-aos], .animate, .fade-in, .fade-up, [class*="reveal"], [style*="opacity: 0"] {
        opacity: 1 !important;
        visibility: visible !important;
        transform: none !important;
        transition: none !important;
      }
    `;
    head.appendChild(revealStyle);

    // 5. Neutralize all client-side scripts to text/plain.
    // This prevents complex SPA routers & hydrators (YouTube Polymer, React, Next.js, Angular)
    // from crashing on missing backend APIs and blanking or wiping out the offline DOM.
    clone.querySelectorAll('script').forEach((s) => {
      s.setAttribute('type', 'text/plain');
      s.setAttribute('data-sd-neutralized', 'true');
    });

    const headerNotice = `<!-- Archived with Source Download (https://2run.dev) on ${new Date().toISOString()} -->\n`;
    return '<!DOCTYPE html>\n' + headerNotice + clone.outerHTML;
  }

  // Counts towards the panel's review banner.
  function sdRecordValue() {
    try {
      chrome.runtime.sendMessage({ type: 'recordMilestone' }, () => void chrome.runtime.lastError);
    } catch { /* noop */ }
  }

  function triggerDownload(url, filename) {
    sdRecordValue();
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
    }, 200);
  }

  const SD_RTL_LOCALES = SourceDownloadLocale.RTL;
  let sdStoredLang = 'auto';

  try {
    chrome.storage.local.get({ lang: 'auto' }, (data) => {
      void chrome.runtime.lastError;
      sdStoredLang = (data && data.lang) || 'auto';
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.lang) sdStoredLang = changes.lang.newValue || 'auto';
    });
  } catch { /* noop */ }

  function sdNormalizeLocale(code) {
    return SourceDownloadLocale.normalize(code);
  }

  function resolveDict(langCode) {
    const i18n = (typeof window !== 'undefined' && window.SourceDownloadI18n) || (typeof globalScope !== 'undefined' && globalScope.SourceDownloadI18n);
    let code = langCode;
    if (!code || code === 'auto') code = sdStoredLang;
    const resolved = SourceDownloadLocale.resolve(code);
    const base = (i18n && i18n.en) || {};
    const own = (i18n && i18n[resolved]) || {};
    const dict = Object.assign({}, base, own);
    return { dict, lang: resolved };
  }

  function sdFill(template, vars) {
    return SourceDownloadLocale.fill(template, vars);
  }

  // Gives an injected panel dialog semantics: role + name, focus moved into it,
  // Tab kept inside (modal only) and focus returned to the page when it closes.
  function sdDialog(el, label, { modal = false } = {}) {
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', label);
    if (modal) el.setAttribute('aria-modal', 'true');
    const previous = document.activeElement;
    const focusables = () => Array.from(el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((n) => !n.disabled && n.offsetParent !== null);
    requestAnimationFrame(() => {
      const first = focusables()[0];
      if (first) first.focus({ preventScroll: true });
    });
    if (modal) {
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const list = focusables();
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });
    }
    const parent = el.parentNode;
    if (parent) {
      const watcher = new MutationObserver(() => {
        if (el.isConnected) return;
        watcher.disconnect();
        if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
      });
      watcher.observe(parent, { childList: true });
    }
  }

  function sdEsc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function sdMsg(key, fallback, vars) {
    const { dict } = resolveDict();
    return sdFill(dict[key] || fallback, vars);
  }

  function drawArrow(targetCtx, x1, y1, x2, y2, color, strokeWidth) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return;
    targetCtx.save();
    targetCtx.strokeStyle = color;
    targetCtx.fillStyle = color;
    targetCtx.lineWidth = strokeWidth;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';

    const angle = Math.atan2(dy, dx);
    const headLength = Math.min(dist * 0.45, Math.max(14, strokeWidth * 4.2));
    const headAngle = Math.PI / 6; // 30 degrees

    // Main stem
    targetCtx.beginPath();
    targetCtx.moveTo(x1, y1);
    targetCtx.lineTo(x2 - headLength * 0.4 * Math.cos(angle), y2 - headLength * 0.4 * Math.sin(angle));
    targetCtx.stroke();

    // Solid arrowhead
    targetCtx.beginPath();
    targetCtx.moveTo(x2, y2);
    targetCtx.lineTo(
      x2 - headLength * Math.cos(angle - headAngle),
      y2 - headLength * Math.sin(angle - headAngle)
    );
    targetCtx.lineTo(
      x2 - headLength * 0.6 * Math.cos(angle),
      y2 - headLength * 0.6 * Math.sin(angle)
    );
    targetCtx.lineTo(
      x2 - headLength * Math.cos(angle + headAngle),
      y2 - headLength * Math.sin(angle + headAngle)
    );
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.restore();
  }

  function drawRect(targetCtx, rx, ry, rw, rh, color, strokeWidth) {
    targetCtx.save();
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = strokeWidth;
    targetCtx.lineJoin = 'round';
    targetCtx.strokeRect(rx, ry, rw, rh);
    targetCtx.restore();
  }

  function drawText(targetCtx, text, tx, ty, color, fontSize, sx = 1, sy = 1) {
    targetCtx.save();
    const scaledFontSize = Math.max(10, Math.round(fontSize * sy));
    targetCtx.font = `bold ${scaledFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    targetCtx.fillStyle = color;
    targetCtx.textBaseline = 'top';
    const lines = String(text).split('\n');
    const lineHeight = Math.round(scaledFontSize * 1.25);
    lines.forEach((line, idx) => {
      targetCtx.fillText(line, tx, ty + idx * lineHeight);
    });
    targetCtx.restore();
  }

  function startAreaCapture(dataUrl, langCode) {
    sdEnsureTheme();
    const existing = document.getElementById('__sd_area_overlay');
    if (existing) existing.remove();
    const existingRec = document.getElementById('__sd_video_rec_overlay');
    if (existingRec) existingRec.remove();

    // 1. Pause any active playing media to freeze audio & video
    const pausedMedia = [];
    try {
      document.querySelectorAll('video, audio').forEach((m) => {
        if (!m.paused) {
          try {
            m.pause();
            pausedMedia.push(m);
          } catch { /* noop */ }
        }
      });
    } catch { /* noop */ }

    function restoreMedia() {
      for (const m of pausedMedia) {
        try { m.play().catch(() => {}); } catch { /* noop */ }
      }
    }

    // 2. Resolve translations
    const { dict, lang } = resolveDict(langCode);
    const labelDownload = dict.btnAreaDownload || 'Download';
    const labelCopy = dict.btnAreaCopy || 'Copy to clipboard';
    const labelCancel = dict.btnAreaCancel || 'Cancel';
    const msgCopied = dict.toastAreaCopied || 'Area screenshot copied to clipboard';
    const msgDownloaded = dict.toastAreaDownloaded || 'Area screenshot saved';
    const labelArrow = dict.toolArrow || 'Arrow';
    const labelRect = dict.toolRect || 'Rectangle';
    const labelText = dict.toolText || 'Text';
    const labelUndo = dict.toolUndo || 'Undo';
    const labelRedo = dict.toolRedo || 'Redo';
    const labelColor = dict.toolColor || 'Color';
    const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
    const keyCopy = isMac ? '⌘C' : 'Ctrl+C';
    const keySave = isMac ? '⌘S' : 'Ctrl+S';

    // 3. Create fullscreen container
    const overlay = document.createElement('div');
    overlay.id = '__sd_area_overlay';
    overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483646;cursor:crosshair;user-select:none;-webkit-user-select:none;overflow:hidden;margin:0;padding:0;box-sizing:border-box;outline:none;';

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    const ctx = canvas.getContext('2d');
    overlay.appendChild(canvas);

    // Floating action bar
    const bar = document.createElement('div');
    bar.id = '__sd_area_toolbar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', dict.contextMenuCaptureArea || 'Capture area screenshot');
    bar.style.cssText = 'position:absolute;display:none;align-items:center;gap:6px;padding:6px 10px;background:var(--sd-surface);border:1px solid var(--sd-border);border-radius:8px;box-shadow:var(--sd-shadow);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);z-index:2147483647;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12.5px;color:var(--sd-text);';

    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:3px;">
        <button type="button" id="__sd_tool_arrow" title="${sdEsc(labelArrow)}" class="__sd_tb_tool" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;background:transparent;color:var(--sd-text);border:1px solid transparent;border-radius:6px;cursor:pointer;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"></line><polyline points="9 5 19 5 19 15"></polyline></svg>
        </button>
        <button type="button" id="__sd_tool_rect" title="${sdEsc(labelRect)}" class="__sd_tb_tool" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;background:transparent;color:var(--sd-text);border:1px solid transparent;border-radius:6px;cursor:pointer;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>
        </button>
        <button type="button" id="__sd_tool_text" title="${sdEsc(labelText)}" class="__sd_tb_tool" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;background:transparent;color:var(--sd-text);border:1px solid transparent;border-radius:6px;cursor:pointer;font-weight:700;font-size:14px;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
        </button>
      </div>

      <div style="position:relative;display:flex;align-items:center;margin:0 2px;">
        <button type="button" id="__sd_tool_color" title="${sdEsc(labelColor)}" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;background:var(--sd-surface-2);border:1px solid var(--sd-border-strong);border-radius:7px;cursor:pointer;">
          <span id="__sd_color_preview" style="width:16px;height:16px;border-radius:4px;background:#ff3b30;display:block;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.15);"></span>
        </button>
        <input type="color" id="__sd_color_input" value="#ff3b30" style="opacity:0;position:absolute;left:0;top:0;width:100%;height:100%;cursor:pointer;">
      </div>

      <div style="display:flex;align-items:center;gap:3px;">
        <button type="button" id="__sd_tool_undo" title="${sdEsc(labelUndo)}" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;background:transparent;color:var(--sd-muted);border:none;border-radius:6px;cursor:default;opacity:0.35;transition:all 0.15s;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
        </button>
        <button type="button" id="__sd_tool_redo" title="${sdEsc(labelRedo)}" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;background:transparent;color:var(--sd-muted);border:none;border-radius:6px;cursor:default;opacity:0.35;transition:all 0.15s;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path></svg>
        </button>
      </div>

      <div style="width:1px;height:18px;background:var(--sd-border-strong);margin:0 3px;"></div>

      <button type="button" id="__sd_btn_download" title="${sdEsc(labelDownload)} (${keySave})" style="display:flex;align-items:center;gap:5px;padding:6px 12px;background:var(--sd-accent);color:#fff;border:none;border-radius:6px;font-weight:600;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>${labelDownload}</span>
      </button>
      <button type="button" id="__sd_btn_copy" title="${sdEsc(labelCopy)} (${keyCopy})" style="display:flex;align-items:center;gap:5px;padding:6px 12px;background:var(--sd-surface-2);color:var(--sd-text);border:1px solid var(--sd-border);border-radius:6px;font-weight:500;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>${labelCopy}</span>
      </button>
      <button type="button" id="__sd_btn_cancel" title="${sdEsc(labelCancel)}" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;background:transparent;color:var(--sd-muted);border:none;border-radius:6px;cursor:pointer;font-size:15px;line-height:1;transition:color 0.15s;">
        ✕
      </button>
    `;
    if (SD_RTL_LOCALES.includes(lang)) bar.dir = 'rtl';
    overlay.appendChild(bar);

    // Dimension badge
    const badge = document.createElement('div');
    badge.id = '__sd_area_badge';
    badge.style.cssText = 'position:absolute;display:none;padding:3px 8px;background:var(--sd-accent);color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,monospace;font-size:11.5px;font-weight:600;border-radius:4px;pointer-events:none;z-index:2147483647;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:1px solid var(--sd-border);';
    overlay.appendChild(badge);

    // Floating wheel tooltip badge
    const wheelBadge = document.createElement('div');
    wheelBadge.id = '__sd_wheel_badge';
    wheelBadge.style.cssText = 'position:absolute;display:none;padding:4px 8px;background:var(--sd-accent);color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:11px;font-weight:600;border-radius:4px;pointer-events:none;z-index:2147483647;box-shadow:0 3px 10px rgba(0,0,0,0.5);border:1px solid var(--sd-border);white-space:nowrap;';
    overlay.appendChild(wheelBadge);

    // Hint at the top: what to do, the shortcuts, and the auto-copy switch.
    // While auto-copy is on it says so every time, so it is never a surprise.
    const hint = document.createElement('div');
    hint.id = '__sd_area_hint';
    hint.style.cssText = 'position:absolute;top:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:7px 8px 7px 14px;background:var(--sd-surface);color:var(--sd-text);border:1px solid var(--sd-border);border-radius:999px;box-shadow:var(--sd-shadow);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12.5px;white-space:nowrap;z-index:2147483647;pointer-events:auto;cursor:default;max-width:calc(100vw - 32px);overflow:hidden;';
    if (SD_RTL_LOCALES.includes(lang)) hint.dir = 'rtl';
    overlay.appendChild(hint);
    let autoCopy = false;
    const kbd = (k) => `<kbd style="font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;padding:1px 6px;border:1px solid var(--sd-border-strong);border-bottom-width:2px;border-radius:5px;background:var(--sd-surface-2);color:var(--sd-text);">${k}</kbd>`;
    function renderHint() {
      if (autoCopy) {
        hint.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:7px;"><span style="width:8px;height:8px;border-radius:50%;background:#16a34a;"></span><b>${sdEsc(dict.areaAutoCopyOn || 'Auto-copy is on')}</b></span>
          <span style="color:var(--sd-muted);">${sdEsc(dict.areaAutoCopyOnHint || 'Let go of the selection and it is on the clipboard.')}</span>
          <button type="button" id="__sd_area_autocopy" style="padding:4px 12px;background:var(--sd-surface-2);color:var(--sd-text);border:1px solid var(--sd-border);border-radius:999px;font:inherit;font-weight:600;cursor:pointer;">${sdEsc(dict.areaAutoCopyTurnOff || 'Turn off')}</button>`;
      } else {
        hint.innerHTML = `
          <b>${sdEsc(dict.areaHintSelect || 'Drag to select an area')}</b>
          <span style="color:var(--sd-muted);display:inline-flex;align-items:center;gap:5px;">${kbd(keyCopy)} ${sdEsc(dict.areaHintCopy || 'copy')} · ${kbd(keySave)} ${sdEsc(dict.areaHintSave || 'save')} · ${kbd('Esc')} ${sdEsc(dict.areaHintExit || 'exit')}</span>
          <button type="button" id="__sd_area_autocopy" role="switch" aria-checked="false" style="display:inline-flex;align-items:center;gap:7px;padding:4px 10px 4px 6px;background:var(--sd-surface-2);color:var(--sd-text);border:1px solid var(--sd-border);border-radius:999px;font:inherit;cursor:pointer;">
            <span aria-hidden="true" style="position:relative;width:26px;height:15px;border-radius:999px;background:var(--sd-border-strong);"><span style="position:absolute;top:2px;left:2px;width:11px;height:11px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.25);"></span></span>
            ${sdEsc(dict.areaAutoCopyLabel || 'Copy automatically')}
          </button>`;
      }
      hint.querySelector('#__sd_area_autocopy').addEventListener('click', (e) => {
        e.stopPropagation();
        autoCopy = !autoCopy;
        try { chrome.storage.local.set({ areaAutoCopy: autoCopy }); } catch { /* noop */ }
        renderHint();
      });
    }
    hint.addEventListener('mousedown', (e) => e.stopPropagation());
    renderHint();
    try {
      chrome.storage.local.get({ areaAutoCopy: false }, (v) => {
        autoCopy = !!(v && v.areaAutoCopy);
        renderHint();
      });
    } catch { /* noop */ }

    let wheelTimer = null;
    function showWheelBadge(text, x, y) {
      wheelBadge.textContent = text;
      let bx = x + 14;
      let by = y - 28;
      if (by < 10) by = y + 20;
      if (bx + 110 > window.innerWidth) bx = x - 110;
      wheelBadge.style.left = `${bx}px`;
      wheelBadge.style.top = `${by}px`;
      wheelBadge.style.display = 'block';
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        wheelBadge.style.display = 'none';
      }, 1100);
    }

    // Load frozen snapshot
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      canvas.width = vw * dpr;
      canvas.height = vh * dpr;
      ctx.scale(dpr, dpr);

      // Annotation State
      let activeTool = null; // null | 'arrow' | 'rect' | 'text'
      let currentColor = '#ff3b30';
      let currentStrokeWidth = 3;
      let currentFontSize = 18;
      const annotations = [];
      const redoStack = [];
      let drawingShape = null;
      let activeTextarea = null;

      function drawBase() {
        ctx.clearRect(0, 0, vw, vh);
        ctx.drawImage(img, 0, 0, vw, vh);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, vw, vh);
      }
      drawBase();

      let mode = 'NONE'; // 'NONE' | 'CREATING' | 'MOVING' | 'RESIZING' | 'DRAWING_ARROW' | 'DRAWING_RECT'
      let startX = 0, startY = 0;
      let moveOffsetX = 0, moveOffsetY = 0;
      let resizeHandle = null;
      let anchorX = 0, anchorY = 0;
      let curRect = null;

      const HANDLE_RADIUS = 8;
      const HANDLE_CURSORS = {
        nw: 'nwse-resize',
        n:  'ns-resize',
        ne: 'nesw-resize',
        e:  'ew-resize',
        se: 'nwse-resize',
        s:  'ns-resize',
        sw: 'nesw-resize',
        w:  'ew-resize',
      };

      function getHandleAt(mx, my) {
        if (!curRect || curRect.w < 8 || curRect.h < 8) return null;
        const { x, y, w, h } = curRect;
        const handles = {
          nw: [x, y],
          n:  [x + w / 2, y],
          ne: [x + w, y],
          e:  [x + w, y + h / 2],
          se: [x + w, y + h],
          s:  [x + w / 2, y + h],
          sw: [x, y + h],
          w:  [x, y + h / 2],
        };
        for (const [name, [hx, hy]] of Object.entries(handles)) {
          if (Math.abs(mx - hx) <= HANDLE_RADIUS && Math.abs(my - hy) <= HANDLE_RADIUS) {
            return name;
          }
        }
        return null;
      }

      function isInsideRect(mx, my) {
        if (!curRect || curRect.w < 8 || curRect.h < 8) return false;
        return mx >= curRect.x && mx <= curRect.x + curRect.w &&
               my >= curRect.y && my <= curRect.y + curRect.h;
      }

      function renderSelection(rect) {
        drawBase();
        if (!rect || rect.w < 2 || rect.h < 2) {
          badge.style.display = 'none';
          return;
        }
        const { x, y, w, h } = rect;

        // 1. Draw clear unshaded rectangle with clipped annotations
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.drawImage(img, 0, 0, vw, vh);

        // Render committed annotations
        for (const ann of annotations) {
          if (ann.type === 'arrow') {
            drawArrow(ctx, ann.x1, ann.y1, ann.x2, ann.y2, ann.color, ann.width);
          } else if (ann.type === 'rect') {
            drawRect(ctx, ann.x, ann.y, ann.w, ann.h, ann.color, ann.width);
          } else if (ann.type === 'text') {
            drawText(ctx, ann.text, ann.x, ann.y, ann.color, ann.fontSize);
          }
        }

        // Render in-progress drawing shape
        if (drawingShape) {
          if (drawingShape.type === 'arrow') {
            drawArrow(ctx, drawingShape.x1, drawingShape.y1, drawingShape.x2, drawingShape.y2, drawingShape.color, drawingShape.width);
          } else if (drawingShape.type === 'rect') {
            const rx = Math.min(drawingShape.x1, drawingShape.x2);
            const ry = Math.min(drawingShape.y1, drawingShape.y2);
            const rw = Math.abs(drawingShape.x2 - drawingShape.x1);
            const rh = Math.abs(drawingShape.y2 - drawingShape.y1);
            drawRect(ctx, rx, ry, rw, rh, drawingShape.color, drawingShape.width);
          }
        }
        ctx.restore();

        // 2. High-contrast border with subtle glow
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2f63e0';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 4;
        ctx.strokeRect(x, y, w, h);
        ctx.shadowColor = 'transparent';

        // 3. 8 Grab handles (Lightshot style)
        const hs = 7;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2f63e0';
        ctx.lineWidth = 1.5;
        const handles = [
          [x - hs / 2, y - hs / 2],
          [x + w / 2 - hs / 2, y - hs / 2],
          [x + w - hs / 2, y - hs / 2],
          [x - hs / 2, y + h / 2 - hs / 2],
          [x + w - hs / 2, y + h / 2 - hs / 2],
          [x - hs / 2, y + h - hs / 2],
          [x + w / 2 - hs / 2, y + h - hs / 2],
          [x + w - hs / 2, y + h - hs / 2],
        ];
        for (const [hx, hy] of handles) {
          ctx.fillRect(hx, hy, hs, hs);
          ctx.strokeRect(hx, hy, hs, hs);
        }

        // 4. Update dimension badge
        badge.style.display = 'block';
        const scaleX = img.naturalWidth / vw;
        const scaleY = img.naturalHeight / vh;
        const realW = Math.round(w * scaleX);
        const realH = Math.round(h * scaleY);
        badge.textContent = `${realW} × ${realH} px`;
        let badgeTop = y - 26;
        if (badgeTop < 6) badgeTop = y + 6;
        badge.style.top = `${badgeTop}px`;
        badge.style.left = `${x}px`;
      }

      function updateRender(x1, y1, x2, y2) {
        const x = Math.max(0, Math.min(x1, x2));
        const y = Math.max(0, Math.min(y1, y2));
        const w = Math.min(vw - x, Math.abs(x2 - x1));
        const h = Math.min(vh - y, Math.abs(y2 - y1));
        curRect = { x, y, w, h };
        renderSelection(curRect);
      }

      function positionToolbar(r) {
        if (!r || r.w < 10 || r.h < 10) {
          bar.style.display = 'none';
          return;
        }
        bar.style.display = 'flex';
        const barWidth = 430;
        const barHeight = 44;
        let left = r.x + r.w - barWidth;
        if (left < 10) left = Math.max(10, r.x);
        if (left + barWidth > vw - 10) left = vw - barWidth - 10;

        let top = r.y + r.h + 10;
        if (top + barHeight > vh - 10) {
          top = r.y - barHeight - 10;
          if (top < 10) top = r.y + 10;
        }
        bar.style.left = `${left}px`;
        bar.style.top = `${top}px`;
      }

      // Tool buttons
      const btnArrow = bar.querySelector('#__sd_tool_arrow');
      const btnRect = bar.querySelector('#__sd_tool_rect');
      const btnText = bar.querySelector('#__sd_tool_text');
      const btnColor = bar.querySelector('#__sd_tool_color');
      const colorInput = bar.querySelector('#__sd_color_input');
      const colorPreview = bar.querySelector('#__sd_color_preview');
      const btnUndo = bar.querySelector('#__sd_tool_undo');
      const btnRedo = bar.querySelector('#__sd_tool_redo');

      function updateUndoRedoUI() {
        btnUndo.style.opacity = annotations.length > 0 ? '1' : '0.35';
        btnUndo.style.cursor = annotations.length > 0 ? 'pointer' : 'default';
        btnRedo.style.opacity = redoStack.length > 0 ? '1' : '0.35';
        btnRedo.style.cursor = redoStack.length > 0 ? 'pointer' : 'default';
      }

      function setActiveTool(tool) {
        if (activeTextarea) commitTextInput();
        activeTool = (activeTool === tool ? null : tool);
        btnArrow.style.background = activeTool === 'arrow' ? 'var(--sd-accent)' : 'transparent';
        btnArrow.style.color = activeTool === 'arrow' ? '#ffffff' : 'var(--sd-text)';
        btnRect.style.background = activeTool === 'rect' ? 'var(--sd-accent)' : 'transparent';
        btnRect.style.color = activeTool === 'rect' ? '#ffffff' : 'var(--sd-text)';
        btnText.style.background = activeTool === 'text' ? 'var(--sd-accent)' : 'transparent';
        btnText.style.color = activeTool === 'text' ? '#ffffff' : 'var(--sd-text)';

        if (activeTool) {
          overlay.style.cursor = activeTool === 'text' ? 'text' : 'crosshair';
        } else {
          overlay.style.cursor = 'crosshair';
        }
      }

      btnArrow.addEventListener('click', (e) => { e.stopPropagation(); setActiveTool('arrow'); });
      btnRect.addEventListener('click', (e) => { e.stopPropagation(); setActiveTool('rect'); });
      btnText.addEventListener('click', (e) => { e.stopPropagation(); setActiveTool('text'); });

      btnColor.addEventListener('click', (e) => {
        e.stopPropagation();
        colorInput.click();
      });
      colorInput.addEventListener('input', (e) => {
        currentColor = e.target.value;
        colorPreview.style.background = currentColor;
        if (activeTextarea) {
          activeTextarea.el.style.color = currentColor;
          activeTextarea.el.style.borderColor = currentColor;
          activeTextarea.color = currentColor;
        }
      });

      function undo() {
        if (annotations.length > 0) {
          redoStack.push(annotations.pop());
          updateUndoRedoUI();
          renderSelection(curRect);
        }
      }

      function redo() {
        if (redoStack.length > 0) {
          annotations.push(redoStack.pop());
          updateUndoRedoUI();
          renderSelection(curRect);
        }
      }

      btnUndo.addEventListener('click', (e) => { e.stopPropagation(); undo(); });
      btnRedo.addEventListener('click', (e) => { e.stopPropagation(); redo(); });

      // Inline text editing
      function commitTextInput() {
        if (!activeTextarea) return;
        const text = (activeTextarea.el.value || '').trim();
        if (text) {
          annotations.push({
            type: 'text',
            x: activeTextarea.x,
            y: activeTextarea.y,
            text: text,
            color: activeTextarea.color,
            fontSize: activeTextarea.fontSize,
          });
          redoStack.length = 0;
          updateUndoRedoUI();
        }
        activeTextarea.el.remove();
        activeTextarea = null;
        renderSelection(curRect);
      }

      function createTextInput(x, y) {
        if (activeTextarea) commitTextInput();
        const ta = document.createElement('textarea');
        ta.spellcheck = false;
        ta.placeholder = '';
        const maxW = Math.max(100, curRect.x + curRect.w - x - 10);
        ta.style.cssText = `position:absolute;left:${x}px;top:${y}px;min-width:60px;min-height:28px;max-width:${maxW}px;color:${currentColor};font-size:${currentFontSize}px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-weight:700;line-height:1.2;outline:none;border:1.5px dashed ${currentColor};padding:4px 6px;border-radius:4px;background:rgba(0,0,0,0.55);z-index:2147483647;white-space:pre-wrap;word-break:break-word;resize:both;box-sizing:border-box;pointer-events:auto;user-select:text;-webkit-user-select:text;`;

        overlay.appendChild(ta);
        setTimeout(() => {
          try {
            ta.focus();
            ta.select();
          } catch { /* noop */ }
        }, 20);
        activeTextarea = { el: ta, x, y, color: currentColor, fontSize: currentFontSize };

        // Stop all propagation so typing/clicking inside the textarea doesn't affect canvas
        ['mousedown', 'mouseup', 'click', 'dblclick', 'pointerdown', 'pointerup'].forEach((evt) => {
          ta.addEventListener(evt, (e) => e.stopPropagation());
        });
        ta.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

        ta.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commitTextInput();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            ta.remove();
            activeTextarea = null;
            renderSelection(curRect);
          }
        });

        ta.addEventListener('blur', () => {
          commitTextInput();
        });
      }

      // Mouse Wheel scaling for arrow/rect stroke & text font size
      overlay.addEventListener('wheel', (e) => {
        if (!curRect) return;
        if (isInsideRect(e.clientX, e.clientY) || activeTool) {
          e.preventDefault();
          if (activeTool === 'text' || activeTextarea) {
            const delta = e.deltaY < 0 ? 2 : -2;
            currentFontSize = Math.max(12, Math.min(72, currentFontSize + delta));
            const textMsg = sdFill(dict.badgeFontSize || 'Font size: $size$px', { size: currentFontSize });
            showWheelBadge(textMsg, e.clientX, e.clientY);
            if (activeTextarea) {
              activeTextarea.el.style.fontSize = `${currentFontSize}px`;
              activeTextarea.fontSize = currentFontSize;
            }
          } else {
            const delta = e.deltaY < 0 ? 1 : -1;
            currentStrokeWidth = Math.max(1, Math.min(32, currentStrokeWidth + delta));
            const strokeMsg = sdFill(dict.badgeStrokeSize || 'Stroke size: $size$px', { size: currentStrokeWidth });
            showWheelBadge(strokeMsg, e.clientX, e.clientY);
          }
        }
      }, { passive: false });

      overlay.addEventListener('mousedown', (e) => {
        if (e.target.closest('#__sd_area_toolbar')) return;

        if (activeTextarea) {
          commitTextInput();
        }

        // Active drawing tool clicked inside curRect
        if (activeTool && isInsideRect(e.clientX, e.clientY)) {
          if (activeTool === 'arrow') {
            mode = 'DRAWING_ARROW';
            drawingShape = {
              type: 'arrow',
              x1: e.clientX,
              y1: e.clientY,
              x2: e.clientX,
              y2: e.clientY,
              color: currentColor,
              width: currentStrokeWidth,
            };
            return;
          }
          if (activeTool === 'rect') {
            mode = 'DRAWING_RECT';
            drawingShape = {
              type: 'rect',
              x1: e.clientX,
              y1: e.clientY,
              x2: e.clientX,
              y2: e.clientY,
              color: currentColor,
              width: currentStrokeWidth,
            };
            return;
          }
          if (activeTool === 'text') {
            createTextInput(e.clientX, e.clientY);
            return;
          }
        }

        const handle = getHandleAt(e.clientX, e.clientY);
        if (handle && curRect) {
          // RESIZE MODE
          mode = 'RESIZING';
          resizeHandle = handle;
          const { x, y, w, h } = curRect;
          if (handle === 'nw') { anchorX = x + w; anchorY = y + h; }
          else if (handle === 'n') { anchorX = x; anchorY = y + h; }
          else if (handle === 'ne') { anchorX = x; anchorY = y + h; }
          else if (handle === 'e') { anchorX = x; anchorY = y; }
          else if (handle === 'se') { anchorX = x; anchorY = y; }
          else if (handle === 's') { anchorX = x; anchorY = y; }
          else if (handle === 'sw') { anchorX = x + w; anchorY = y; }
          else if (handle === 'w') { anchorX = x + w; anchorY = y; }
          bar.style.display = 'none';
          return;
        }

        if (isInsideRect(e.clientX, e.clientY)) {
          // MOVE MODE
          mode = 'MOVING';
          moveOffsetX = e.clientX - curRect.x;
          moveOffsetY = e.clientY - curRect.y;
          bar.style.display = 'none';
          return;
        }

        // CREATE MODE
        mode = 'CREATING';
        startX = e.clientX;
        startY = e.clientY;
        bar.style.display = 'none';
        hint.style.visibility = 'hidden';
        updateRender(startX, startY, startX, startY);
      });

      window.addEventListener('mousemove', (e) => {
        if (mode === 'DRAWING_ARROW' && drawingShape) {
          drawingShape.x2 = Math.max(curRect.x, Math.min(curRect.x + curRect.w, e.clientX));
          drawingShape.y2 = Math.max(curRect.y, Math.min(curRect.y + curRect.h, e.clientY));
          renderSelection(curRect);
          return;
        }

        if (mode === 'DRAWING_RECT' && drawingShape) {
          drawingShape.x2 = Math.max(curRect.x, Math.min(curRect.x + curRect.w, e.clientX));
          drawingShape.y2 = Math.max(curRect.y, Math.min(curRect.y + curRect.h, e.clientY));
          renderSelection(curRect);
          return;
        }

        if (mode === 'MOVING' && curRect) {
          let nx = e.clientX - moveOffsetX;
          let ny = e.clientY - moveOffsetY;
          nx = Math.max(0, Math.min(nx, vw - curRect.w));
          ny = Math.max(0, Math.min(ny, vh - curRect.h));
          const dx = nx - curRect.x;
          const dy = ny - curRect.y;
          curRect.x = nx;
          curRect.y = ny;
          // Shift existing annotations along with moved box
          for (const ann of annotations) {
            if (ann.type === 'arrow') {
              ann.x1 += dx; ann.y1 += dy;
              ann.x2 += dx; ann.y2 += dy;
            } else if (ann.type === 'rect' || ann.type === 'text') {
              ann.x += dx; ann.y += dy;
            }
          }
          renderSelection(curRect);
          overlay.style.cursor = 'move';
          return;
        }

        if (mode === 'RESIZING' && curRect) {
          const mx = Math.max(0, Math.min(e.clientX, vw));
          const my = Math.max(0, Math.min(e.clientY, vh));
          if (resizeHandle === 'nw') updateRender(mx, my, anchorX, anchorY);
          else if (resizeHandle === 'n') updateRender(curRect.x, my, curRect.x + curRect.w, anchorY);
          else if (resizeHandle === 'ne') updateRender(anchorX, anchorY, mx, my);
          else if (resizeHandle === 'e') updateRender(anchorX, curRect.y, mx, curRect.y + curRect.h);
          else if (resizeHandle === 'se') updateRender(anchorX, anchorY, mx, my);
          else if (resizeHandle === 's') updateRender(curRect.x, anchorY, curRect.x + curRect.w, my);
          else if (resizeHandle === 'sw') updateRender(mx, anchorY, anchorX, curRect.y);
          else if (resizeHandle === 'w') updateRender(mx, curRect.y, anchorX, curRect.y + curRect.h);
          overlay.style.cursor = HANDLE_CURSORS[resizeHandle] || 'crosshair';
          return;
        }

        if (mode === 'CREATING') {
          updateRender(startX, startY, e.clientX, e.clientY);
          overlay.style.cursor = 'crosshair';
          return;
        }

        // Hover cursor management when idle
        if (activeTool) {
          overlay.style.cursor = activeTool === 'text' ? 'text' : 'crosshair';
          return;
        }

        const handle = getHandleAt(e.clientX, e.clientY);
        if (handle) {
          overlay.style.cursor = HANDLE_CURSORS[handle];
        } else if (isInsideRect(e.clientX, e.clientY)) {
          overlay.style.cursor = 'move';
        } else {
          overlay.style.cursor = 'crosshair';
        }
      });

      window.addEventListener('mouseup', () => {
        if (mode === 'DRAWING_ARROW') {
          if (drawingShape && Math.hypot(drawingShape.x2 - drawingShape.x1, drawingShape.y2 - drawingShape.y1) > 5) {
            annotations.push({ ...drawingShape });
            redoStack.length = 0;
            updateUndoRedoUI();
          }
          drawingShape = null;
          mode = 'NONE';
          renderSelection(curRect);
          positionToolbar(curRect);
          return;
        }

        if (mode === 'DRAWING_RECT') {
          if (drawingShape) {
            const rx = Math.min(drawingShape.x1, drawingShape.x2);
            const ry = Math.min(drawingShape.y1, drawingShape.y2);
            const rw = Math.abs(drawingShape.x2 - drawingShape.x1);
            const rh = Math.abs(drawingShape.y2 - drawingShape.y1);
            if (rw > 5 && rh > 5) {
              annotations.push({
                type: 'rect',
                x: rx,
                y: ry,
                w: rw,
                h: rh,
                color: drawingShape.color,
                width: drawingShape.width,
              });
              redoStack.length = 0;
              updateUndoRedoUI();
            }
          }
          drawingShape = null;
          mode = 'NONE';
          renderSelection(curRect);
          positionToolbar(curRect);
          return;
        }

        if (mode === 'NONE') return;
        const wasCreating = mode === 'CREATING';
        mode = 'NONE';
        hint.style.visibility = 'visible';
        if (curRect && curRect.w > 10 && curRect.h > 10) {
          positionToolbar(curRect);
          if (wasCreating && autoCopy) copySelection(true);
        } else {
          bar.style.display = 'none';
          badge.style.display = 'none';
          curRect = null;
          drawBase();
        }
      });

      function cleanUp() {
        if (activeTextarea) {
          activeTextarea.el.remove();
          activeTextarea = null;
        }
        overlay.remove();
        restoreMedia();
        document.removeEventListener('keydown', onKeyDown);
      }

      function onKeyDown(e) {
        if (e.key === 'Escape') {
          if (activeTextarea) {
            activeTextarea.el.remove();
            activeTextarea = null;
            renderSelection(curRect);
          } else {
            cleanUp();
          }
        } else if (activeTextarea) {
          // Typing an annotation: leave the shortcuts to the text box.
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && curRect) {
          e.preventDefault();
          copySelection(false);
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && curRect) {
          e.preventDefault();
          btnDownload.click();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
          e.preventDefault();
          redo();
        }
      }
      document.addEventListener('keydown', onKeyDown);

      function getCroppedCanvas() {
        if (!curRect || curRect.w < 4 || curRect.h < 4) return null;
        const scaleX = img.naturalWidth / vw;
        const scaleY = img.naturalHeight / vh;
        const sx = curRect.x * scaleX;
        const sy = curRect.y * scaleY;
        const sw = curRect.w * scaleX;
        const sh = curRect.h * scaleY;

        const offscreen = document.createElement('canvas');
        offscreen.width = Math.round(sw);
        offscreen.height = Math.round(sh);
        const octx = offscreen.getContext('2d');
        octx.drawImage(img, sx, sy, sw, sh, 0, 0, offscreen.width, offscreen.height);

        // Render annotations onto exported canvas
        for (const ann of annotations) {
          if (ann.type === 'arrow') {
            const x1 = (ann.x1 - curRect.x) * scaleX;
            const y1 = (ann.y1 - curRect.y) * scaleY;
            const x2 = (ann.x2 - curRect.x) * scaleX;
            const y2 = (ann.y2 - curRect.y) * scaleY;
            const w = ann.width * scaleX;
            drawArrow(octx, x1, y1, x2, y2, ann.color, w);
          } else if (ann.type === 'rect') {
            const rx = (ann.x - curRect.x) * scaleX;
            const ry = (ann.y - curRect.y) * scaleY;
            const rw = ann.w * scaleX;
            const rh = ann.h * scaleY;
            const w = ann.width * scaleX;
            drawRect(octx, rx, ry, rw, rh, ann.color, w);
          } else if (ann.type === 'text') {
            const tx = (ann.x - curRect.x) * scaleX;
            const ty = (ann.y - curRect.y) * scaleY;
            drawText(octx, ann.text, tx, ty, ann.color, ann.fontSize, scaleX, scaleY);
          }
        }

        return offscreen;
      }

      // Button: Download
      const btnDownload = overlay.querySelector('#__sd_btn_download');
      btnDownload.addEventListener('click', async () => {
        const off = getCroppedCanvas();
        if (!off) return;
        const stored = await chrome.storage.local.get({ namingPatterns: {} });
        const pattern = (stored.namingPatterns && stored.namingPatterns.screenshot) || '{domain}-{type}-{date}_{time}';
        const namingHelper = (typeof SourceDownloadNaming !== 'undefined') ? SourceDownloadNaming : null;
        let domain = 'webpage';
        try { domain = window.location.hostname.replace(/[^a-z0-9.-]/gi, '_'); } catch {}
        const filename = namingHelper
          ? namingHelper.formatFilename(pattern, { domain, title: document.title, type: 'screenshot-area' }, '.png')
          : `screenshot-area-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
        const data = off.toDataURL('image/png');
        triggerDownload(data, filename);
        cleanUp();
        showToast(msgDownloaded);
      });

      // Copy the selection as PNG. `auto` comes from auto-copy: when the page
      // does not allow the clipboard, the toolbar stays open with a note
      // instead of silently downloading a file the user did not ask for.
      function copySelection(auto) {
        const off = getCroppedCanvas();
        if (!off) return;
        off.toBlob(async (blob) => {
          if (!blob) return;
          try {
            if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('clipboard unavailable');
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            sdRecordValue();
            cleanUp();
            showToast(auto ? (dict.toastAreaAutoCopied || msgCopied) : msgCopied);
          } catch (err) {
            console.warn('Direct clipboard.write failed:', err);
            if (auto) {
              showToast(dict.toastAreaCopyBlocked || 'This page does not allow copying to the clipboard. Use Download instead.');
              return;
            }
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            triggerDownload(off.toDataURL('image/png'), `screenshot-area-${ts}.png`);
            cleanUp();
            showToast(msgDownloaded);
          }
        }, 'image/png');
      }

      // Button: Copy to clipboard
      const btnCopy = overlay.querySelector('#__sd_btn_copy');
      btnCopy.addEventListener('click', () => copySelection(false));

      // Button: Cancel
      const btnCancel = overlay.querySelector('#__sd_btn_cancel');
      btnCancel.addEventListener('click', () => {
        cleanUp();
      });
    };
    img.src = dataUrl;
    document.body.appendChild(overlay);
  }

  /* ============================================================
   * Area Screen Video Recording (startAreaVideoRecord)
   * Screen is 100% natural and bright (no dark overlay masks).
   * Box is smoothly movable via drag header, resizable via 8 handles.
   * Full page interaction (scroll, click, type) is preserved.
   * Once recording starts, box clicks pass through directly to page.
   * Smartly docked/positioned recording toolbar.
   * ============================================================ */
  function startAreaVideoRecord(langCode) {
    sdEnsureTheme();
    const existingRec = document.getElementById('__sd_video_rec_overlay');
    if (existingRec) existingRec.remove();
    const existingArea = document.getElementById('__sd_area_overlay');
    if (existingArea) existingArea.remove();

    // 1. Resolve i18n
    const { dict, lang } = resolveDict(langCode);
    const labelStart = dict.btnRecStart || 'Start Recording';
    const labelPause = dict.btnRecPause || 'Pause';
    const labelResume = dict.btnRecResume || 'Resume';
    const labelStop = dict.btnRecStop || 'Finish & Download';
    const labelCancel = dict.btnRecCancel || 'Cancel';
    const msgSaved = dict.toastRecSaved || 'Recording saved';
    const msgCancelled = dict.toastRecCancelled || 'Recording cancelled';
    const msgPermissionDenied = dict.toastRecPermissionDenied || 'Screen recording permission denied';

    // 2. Fullscreen overlay with pointer-events: none so clicks pass through to page!
    const overlay = document.createElement('div');
    overlay.id = '__sd_video_rec_overlay';
    overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483646;pointer-events:none;overflow:hidden;margin:0;padding:0;box-sizing:border-box;';

    // The crop window frame (no dark masks anywhere on the screen)
    const cropBox = document.createElement('div');
    cropBox.id = '__sd_rec_box';
    cropBox.style.cssText = 'position:absolute;display:block;outline:2px dashed #ff3b30;outline-offset:0px;border:none;box-sizing:border-box;z-index:2147483647;pointer-events:none;background:transparent;';
    overlay.appendChild(cropBox);

    // Dedicated drag header bar placed OUTSIDE crop box
    const dragHeader = document.createElement('div');
    dragHeader.id = '__sd_rec_drag_header';
    dragHeader.style.cssText = 'position:absolute;top:-28px;left:0;right:0;height:26px;background:var(--sd-surface);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:space-between;padding:0 10px;cursor:move;user-select:none;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:11.5px;font-weight:600;color:var(--sd-text);border-radius:5px 5px 0 0;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:1px solid var(--sd-border);border-bottom:none;';
    dragHeader.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;pointer-events:none;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
        <span id="__sd_rec_dims_text"></span>
      </div>
      <div style="display:flex;align-items:center;gap:3px;opacity:0.6;font-size:12px;pointer-events:none;">
        <span>⋮⋮</span>
      </div>
    `;
    cropBox.appendChild(dragHeader);
    const dimsText = dragHeader.querySelector('#__sd_rec_dims_text');

    // 8 grab handles
    const HANDLE_NAMES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    const HANDLE_CURSORS = {
      nw: 'nwse-resize',
      n:  'ns-resize',
      ne: 'nesw-resize',
      e:  'ew-resize',
      se: 'nwse-resize',
      s:  'ns-resize',
      sw: 'nesw-resize',
      w:  'ew-resize',
    };
    const handles = {};
    for (const hname of HANDLE_NAMES) {
      const h = document.createElement('div');
      h.className = '__sd_rec_handle';
      h.dataset.handle = hname;
      h.style.cssText = `position:absolute;width:10px;height:10px;background:#ffffff;border:1.5px solid #ff3b30;border-radius:2px;cursor:${HANDLE_CURSORS[hname]};pointer-events:auto;z-index:2147483647;box-shadow:0 1px 4px rgba(0,0,0,0.4);`;
      cropBox.appendChild(h);
      handles[hname] = h;
    }

    // Docked recording toolbar
    const bar = document.createElement('div');
    bar.id = '__sd_rec_toolbar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', dict.contextMenuRecordArea || 'Record area as video / GIF');
    bar.style.cssText = 'position:absolute;display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--sd-surface);border:1px solid var(--sd-border);border-radius:8px;box-shadow:var(--sd-shadow);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);z-index:2147483647;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12.5px;color:var(--sd-text);user-select:none;';

    bar.innerHTML = `
      <div id="__sd_rec_bar_drag" title="${sdEsc(dict.tipRecDragToolbar || 'Drag toolbar')}" style="cursor:move;padding:2px 4px;color:var(--sd-muted);display:flex;align-items:center;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="2"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/></svg>
      </div>
      <span id="__sd_rec_timer" style="display:none;align-items:center;gap:5px;font-variant-numeric:tabular-nums;font-weight:700;color:#ff4d4f;background:rgba(255,77,79,0.18);padding:3px 8px;border-radius:5px;font-size:12px;letter-spacing:0.5px;">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff4d4f;box-shadow:0 0 6px #ff4d4f;"></span>
        <span id="__sd_rec_time_text">00:00</span>
      </span>
      <button type="button" id="__sd_rec_btn_start" style="display:flex;align-items:center;gap:6px;padding:6px 14px;background:#ff3b30;color:#fff;border:none;border-radius:6px;font-weight:600;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
        <span>${labelStart}</span>
      </button>
      <button type="button" id="__sd_rec_btn_pause" style="display:none;align-items:center;gap:6px;padding:6px 12px;background:var(--sd-surface-2);color:var(--sd-text);border:1px solid var(--sd-border);border-radius:6px;font-weight:600;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        <span>${labelPause}</span>
      </button>
      <button type="button" id="__sd_rec_btn_resume" style="display:none;align-items:center;gap:6px;padding:6px 12px;background:var(--sd-surface-2);color:var(--sd-text);border:1px solid var(--sd-border);border-radius:6px;font-weight:600;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>${labelResume}</span>
      </button>
      <button type="button" id="__sd_rec_btn_stop" style="display:none;align-items:center;gap:6px;padding:6px 14px;background:#34c759;color:#fff;border:none;border-radius:6px;font-weight:600;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        <span>${labelStop}</span>
      </button>
      <button type="button" id="__sd_rec_btn_format" title="${sdEsc(dict.tipRecToggleFormat || 'Toggle format: MP4 / GIF / WebM')}" style="display:flex;align-items:center;padding:4px 8px;background:var(--sd-chip);border:1px solid var(--sd-border);border-radius:5px;color:var(--sd-accent);font-weight:700;font-size:11.5px;cursor:pointer;line-height:1;transition:all 0.15s;">
        <span id="__sd_rec_format_text">MP4</span>
      </button>
      <button type="button" id="__sd_rec_btn_res" title="${sdEsc(dict.tipRecGifResolution || 'GIF resolution: 1080p / 720p / 480p')}" style="display:none;align-items:center;padding:4px 8px;background:var(--sd-chip);border:1px solid var(--sd-border);border-radius:5px;color:#0f8a5f;font-weight:700;font-size:11.5px;cursor:pointer;line-height:1;transition:all 0.15s;">
        <span id="__sd_rec_res_text">720p</span>
      </button>
      <button type="button" id="__sd_rec_btn_fps" title="${sdEsc(dict.tipRecGifFps || 'GIF frame rate: 15 / 10 / 5 / 2 / 1 FPS')}" style="display:none;align-items:center;padding:4px 8px;background:var(--sd-chip);border:1px solid var(--sd-border);border-radius:5px;color:#a96800;font-weight:700;font-size:11.5px;cursor:pointer;line-height:1;transition:all 0.15s;">
        <span id="__sd_rec_fps_text">10 FPS</span>
      </button>
      <span id="__sd_rec_gif_estimate" style="display:none;align-items:center;padding:3px 7px;background:var(--sd-chip);border:1px solid var(--sd-border);border-radius:5px;color:var(--sd-muted);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:help;">
        <span id="__sd_rec_estimate_text">~12 MB</span>
      </span>
      <button type="button" id="__sd_rec_btn_cancel" title="${sdEsc(labelCancel)}" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;background:transparent;color:var(--sd-muted);border:none;border-radius:6px;cursor:pointer;font-size:15px;line-height:1;transition:color 0.15s;">
        ✕
      </button>
    `;
    if (SD_RTL_LOCALES.includes(lang)) bar.dir = 'rtl';
    overlay.appendChild(bar);

    let curRect = null;
    let mode = 'NONE'; // 'NONE' | 'MOVING' | 'RESIZING' | 'TOOLBAR_DRAG'
    let moveOffsetX = 0, moveOffsetY = 0;
    let barOffsetX = 0, barOffsetY = 0;
    let isBarUserPositioned = false;
    let resizeHandle = null;
    let anchorX = 0, anchorY = 0;

    // Video / GIF Format, Resolution & FPS Preference
    let selectedFormat = 'mp4';
    // 'original' (up to 4K) was removed: raw 4K frames could exhaust the tab's memory.
    let selectedGifResolution = '720p'; // '1080p' | '720p' | '480p'
    let selectedGifFps = 10; // 15 | 10 | 5 | 2 | 1 FPS
    let gifDelayCentisec = 10;
    const GIF_RESOLUTIONS = ['1080p', '720p', '480p'];
    const GIF_MAX_BYTES = 200 * 1024 * 1024; // stop before the output gets unwieldy
    const GIF_MAX_QUEUE = 4; // raw frames waiting for the encoder at most
    function gifMaxDim(res) {
      return res === '1080p' ? 1920 : res === '480p' ? 854 : 1280;
    }
    const isMp4Supported = typeof MediaRecorder !== 'undefined' && (
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ||
      MediaRecorder.isTypeSupported('video/mp4')
    );
    if (!isMp4Supported) {
      selectedFormat = 'gif';
    }

    const btnFormat = bar.querySelector('#__sd_rec_btn_format');
    const btnResolution = bar.querySelector('#__sd_rec_btn_res');
    const resText = bar.querySelector('#__sd_rec_res_text');
    const btnFps = bar.querySelector('#__sd_rec_btn_fps');
    const fpsText = bar.querySelector('#__sd_rec_fps_text');
    const gifEstimateEl = bar.querySelector('#__sd_rec_gif_estimate');
    const estimateTextEl = bar.querySelector('#__sd_rec_estimate_text');

    function updateGifEstimate() {
      if (!gifEstimateEl || !estimateTextEl || !curRect) return;
      if (selectedFormat !== 'gif' || isRecording) {
        gifEstimateEl.style.display = 'none';
        return;
      }
      gifEstimateEl.style.display = 'inline-flex';

      const dpr = window.devicePixelRatio || 1;
      let targetW = Math.round(curRect.w * dpr);
      let targetH = Math.round(curRect.h * dpr);

      const maxDim = gifMaxDim(selectedGifResolution);

      if (targetW > maxDim || targetH > maxDim) {
        const sc = Math.min(maxDim / targetW, maxDim / targetH);
        targetW = Math.round(targetW * sc);
        targetH = Math.round(targetH * sc);
      }
      if (targetW % 2 !== 0) targetW++;
      if (targetH % 2 !== 0) targetH++;

      // Empirical GIF size estimation: ~0.18 bytes per pixel per frame with median-cut LZW
      const fps = Math.max(1, Math.min(30, selectedGifFps || 10));
      const bytesPerSec = targetW * targetH * 0.18 * fps;
      const mb10s = Math.max(0.1, Math.round((bytesPerSec * 10 / (1024 * 1024)) * 10) / 10);
      const maxMb = Math.max(0.5, Math.round((bytesPerSec * 60 / (1024 * 1024))));

      const labelMax1Min = dict.labelGifMaxDuration || 'Max 1 min (60s)';
      estimateTextEl.textContent = `~${mb10s} MB/10s (${labelMax1Min})`;
      gifEstimateEl.title = sdFill(
        dict.tipGifEstimate || 'Estimated GIF size: ~$size$ MB (for 10 s), up to ~$max$ MB for the 60 s maximum.\nFrame rate: $fps$ FPS.\nGIF recording is limited to a maximum of 1 minute (60 s).',
        { size: mb10s, max: maxMb, fps }
      );
    }

    function updateResDisplay() {
      if (!resText) return;
      resText.textContent = GIF_RESOLUTIONS.includes(selectedGifResolution) ? selectedGifResolution : '720p';
      updateGifEstimate();
    }

    function updateFpsDisplay() {
      if (!fpsText) return;
      fpsText.textContent = `${selectedGifFps} FPS`;
      if (btnFps) {
        if (selectedGifFps === 2) {
          btnFps.title = dict.optGifFps2 || '2 FPS: Stop-Motion / Slow ("Click-click" step-by-step, tiny size)';
        } else if (selectedGifFps === 1) {
          btnFps.title = dict.optGifFps1 || '1 FPS: Presentation (1 frame per sec, minimal size)';
        } else if (selectedGifFps === 5) {
          btnFps.title = dict.optGifFps5 || '5 FPS: Compact / Meme (Stepped motion, small size)';
        } else if (selectedGifFps === 15) {
          btnFps.title = dict.optGifFps15 || '15 FPS: Smooth (High fluidity, larger size)';
        } else {
          btnFps.title = dict.optGifFps10 || '10 FPS: Standard (Recommended for web & balance)';
        }
      }
      updateGifEstimate();
    }

    function updateResVisibility() {
      const isGif = (selectedFormat === 'gif' && !isRecording);
      if (btnResolution) btnResolution.style.display = isGif ? 'flex' : 'none';
      if (btnFps) btnFps.style.display = isGif ? 'flex' : 'none';
      updateGifEstimate();
    }

    chrome.storage.local.get({ videoFormat: isMp4Supported ? 'mp4' : 'gif', gifResolution: 'original', gifFps: 10 }, (data) => {
      if (data && data.videoFormat && (data.videoFormat === 'webm' || data.videoFormat === 'gif' || (data.videoFormat === 'mp4' && isMp4Supported))) {
        selectedFormat = data.videoFormat;
        const fmtText = bar.querySelector('#__sd_rec_format_text');
        if (fmtText) fmtText.textContent = selectedFormat.toUpperCase();
      }
      if (data && GIF_RESOLUTIONS.includes(data.gifResolution)) {
        selectedGifResolution = data.gifResolution; // a saved 'original' falls back to 720p
      }
      if (data && data.gifFps) {
        selectedGifFps = parseInt(data.gifFps, 10) || 10;
      }
      updateResDisplay();
      updateFpsDisplay();
      updateResVisibility();
    });

    if (btnFormat) {
      btnFormat.title = dict.tipRecToggleFormat || 'Toggle format: MP4 / GIF / WebM';
      const fmtText = bar.querySelector('#__sd_rec_format_text');
      if (fmtText) fmtText.textContent = selectedFormat.toUpperCase();
      btnFormat.addEventListener('click', () => {
        if (isRecording) return;
        if (selectedFormat === 'mp4') {
          selectedFormat = 'gif';
        } else if (selectedFormat === 'gif') {
          selectedFormat = 'webm';
        } else {
          selectedFormat = isMp4Supported ? 'mp4' : 'gif';
        }
        if (fmtText) fmtText.textContent = selectedFormat.toUpperCase();
        updateResVisibility();
      });
    }

    if (btnResolution) {
      btnResolution.addEventListener('click', () => {
        if (isRecording) return;
        const idx = GIF_RESOLUTIONS.indexOf(selectedGifResolution);
        selectedGifResolution = GIF_RESOLUTIONS[(idx + 1) % GIF_RESOLUTIONS.length];
        updateResDisplay();
        chrome.storage.local.set({ gifResolution: selectedGifResolution });
      });
    }

    if (btnFps) {
      btnFps.addEventListener('click', () => {
        if (isRecording) return;
        if (selectedGifFps === 10) {
          selectedGifFps = 5;
        } else if (selectedGifFps === 5) {
          selectedGifFps = 2; // stop-motion / slide-show
        } else if (selectedGifFps === 2) {
          selectedGifFps = 1;
        } else if (selectedGifFps === 1) {
          selectedGifFps = 15;
        } else {
          selectedGifFps = 10;
        }
        updateFpsDisplay();
        chrome.storage.local.set({ gifFps: selectedGifFps });
      });
    }

    function updateCropBox(r) {
      if (!r) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const x = Math.max(0, Math.min(r.x, vw - 40));
      const y = Math.max(0, Math.min(r.y, vh - 40));
      const w = Math.max(40, Math.min(r.w, vw - x));
      const h = Math.max(40, Math.min(r.h, vh - y));

      cropBox.style.left = `${x}px`;
      cropBox.style.top = `${y}px`;
      cropBox.style.width = `${w}px`;
      cropBox.style.height = `${h}px`;

      // Position dragHeader strictly OUTSIDE crop box (flip below if near screen top)
      if (y < 32) {
        dragHeader.style.top = 'auto';
        dragHeader.style.bottom = '-28px';
        dragHeader.style.borderRadius = '0 0 5px 5px';
        dragHeader.style.borderTop = 'none';
        dragHeader.style.borderBottom = '1px solid rgba(255,255,255,0.18)';
      } else {
        dragHeader.style.bottom = 'auto';
        dragHeader.style.top = '-28px';
        dragHeader.style.borderRadius = '5px 5px 0 0';
        dragHeader.style.borderBottom = 'none';
        dragHeader.style.borderTop = '1px solid rgba(255,255,255,0.18)';
      }

      // Position 8 grab handles
      const hs = 10;
      const h2 = hs / 2;
      handles.nw.style.left = `${-h2}px`; handles.nw.style.top = `${-h2}px`;
      handles.n.style.left = `${w / 2 - h2}px`; handles.n.style.top = `${-h2}px`;
      handles.ne.style.left = `${w - h2}px`; handles.ne.style.top = `${-h2}px`;
      handles.e.style.left = `${w - h2}px`; handles.e.style.top = `${h / 2 - h2}px`;
      handles.se.style.left = `${w - h2}px`; handles.se.style.top = `${h - h2}px`;
      handles.s.style.left = `${w / 2 - h2}px`; handles.s.style.top = `${h - h2}px`;
      handles.sw.style.left = `${-h2}px`; handles.sw.style.top = `${h - h2}px`;
      handles.w.style.left = `${-h2}px`; handles.w.style.top = `${h / 2 - h2}px`;

      if (dimsText) dimsText.textContent = `${w} × ${h} px`;
      updateGifEstimate();
    }

    function positionToolbar(r) {
      if (isBarUserPositioned || !r) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const barWidth = Math.max(500, bar.offsetWidth || 500);
      const barHeight = 44;

      let left = r.x + Math.round((r.w - barWidth) / 2);
      if (left < 10) left = 10;
      if (left + barWidth > vw - 10) left = vw - barWidth - 10;

      // Try docked 24px below crop box to guarantee no overlap with outline
      let top = r.y + r.h + 24;
      // If bottom overflows screen, dock above crop box
      if (top + barHeight > vh - 10) {
        top = r.y - barHeight - 34;
      }
      // If top also overflows, dock at top-right corner to avoid overlapping crop area
      if (top < 10) {
        top = 16;
        left = Math.max(10, vw - barWidth - 20);
      }

      bar.style.left = `${left}px`;
      bar.style.top = `${top}px`;
    }

    // Default crop box: centered 65% of viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const defW = Math.min(800, Math.max(320, Math.round(vw * 0.65)));
    const defH = Math.min(480, Math.max(240, Math.round(vh * 0.65)));
    const defX = Math.round((vw - defW) / 2);
    const defY = Math.round((vh - defH) / 2);
    curRect = { x: defX, y: defY, w: defW, h: defH };
    updateCropBox(curRect);
    positionToolbar(curRect);

    // Move box via drag header
    dragHeader.addEventListener('mousedown', (e) => {
      if (isRecording) return;
      mode = 'MOVING';
      moveOffsetX = e.clientX - curRect.x;
      moveOffsetY = e.clientY - curRect.y;
      e.stopPropagation();
      e.preventDefault();
    });

    // Resize box via 8 handles
    for (const hname of HANDLE_NAMES) {
      const h = handles[hname];
      h.addEventListener('mousedown', (e) => {
        if (isRecording) return;
        mode = 'RESIZING';
        resizeHandle = hname;
        const { x, y, w, h: rectH } = curRect;
        if (hname === 'nw') { anchorX = x + w; anchorY = y + rectH; }
        else if (hname === 'n') { anchorX = x; anchorY = y + rectH; }
        else if (hname === 'ne') { anchorX = x; anchorY = y + rectH; }
        else if (hname === 'e') { anchorX = x; anchorY = y; }
        else if (hname === 'se') { anchorX = x; anchorY = y; }
        else if (hname === 's') { anchorX = x; anchorY = y; }
        else if (hname === 'sw') { anchorX = x + w; anchorY = y; }
        else if (hname === 'w') { anchorX = x + w; anchorY = y; }
        e.stopPropagation();
        e.preventDefault();
      });
    }

    // Toolbar drag handle
    const barDragEl = bar.querySelector('#__sd_rec_bar_drag');
    barDragEl.addEventListener('mousedown', (e) => {
      mode = 'TOOLBAR_DRAG';
      const bRect = bar.getBoundingClientRect();
      barOffsetX = e.clientX - bRect.left;
      barOffsetY = e.clientY - bRect.top;
      isBarUserPositioned = true;
      e.stopPropagation();
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (mode === 'MOVING' && curRect) {
        let nx = e.clientX - moveOffsetX;
        let ny = e.clientY - moveOffsetY;
        nx = Math.max(0, Math.min(nx, window.innerWidth - curRect.w));
        ny = Math.max(0, Math.min(ny, window.innerHeight - curRect.h));
        curRect.x = nx;
        curRect.y = ny;
        updateCropBox(curRect);
        positionToolbar(curRect);
        return;
      }

      if (mode === 'RESIZING' && curRect) {
        const mx = Math.max(0, Math.min(e.clientX, window.innerWidth));
        const my = Math.max(0, Math.min(e.clientY, window.innerHeight));
        let x1 = curRect.x, y1 = curRect.y, x2 = curRect.x + curRect.w, y2 = curRect.y + curRect.h;
        if (resizeHandle === 'nw') { x1 = mx; y1 = my; x2 = anchorX; y2 = anchorY; }
        else if (resizeHandle === 'n') { y1 = my; y2 = anchorY; }
        else if (resizeHandle === 'ne') { x2 = mx; y1 = my; x1 = anchorX; y2 = anchorY; }
        else if (resizeHandle === 'e') { x2 = mx; x1 = anchorX; }
        else if (resizeHandle === 'se') { x2 = mx; y2 = my; x1 = anchorX; y1 = anchorY; }
        else if (resizeHandle === 's') { y2 = my; y1 = anchorY; }
        else if (resizeHandle === 'sw') { x1 = mx; y2 = my; x2 = anchorX; y1 = anchorY; }
        else if (resizeHandle === 'w') { x1 = mx; x2 = anchorX; }

        const rx = Math.min(x1, x2);
        const ry = Math.min(y1, y2);
        const rw = Math.max(40, Math.abs(x2 - x1));
        const rh = Math.max(40, Math.abs(y2 - y1));
        curRect = { x: rx, y: ry, w: rw, h: rh };
        updateCropBox(curRect);
        positionToolbar(curRect);
        return;
      }

      if (mode === 'TOOLBAR_DRAG') {
        const bWidth = bar.offsetWidth || 450;
        const nx = Math.max(10, Math.min(window.innerWidth - bWidth - 10, e.clientX - barOffsetX));
        const ny = Math.max(10, Math.min(window.innerHeight - 54, e.clientY - barOffsetY));
        bar.style.left = `${nx}px`;
        bar.style.top = `${ny}px`;
        return;
      }
    });

    window.addEventListener('mouseup', () => {
      mode = 'NONE';
    });

    // Recording State
    let activeStream = null;
    let mediaRecorder = null;
    let animLoopId = null;
    let timerInterval = null;
    let recordedSeconds = 0;
    let isPaused = false;
    let isRecording = false;

    // GIF Recording State
    let gifInterval = null;
    let gifFrames = []; // short queue of raw frames waiting for gifEncoder
    let gifEncoder = null;
    let gifPumping = false;

    // Encodes queued frames one per task so the page stays responsive.
    function pumpGifEncoder() {
      if (gifPumping || !gifEncoder) return;
      gifPumping = true;
      setTimeout(function step() {
        const next = gifFrames.shift();
        if (next && gifEncoder) {
          try {
            gifEncoder.addFrame(next.data, next.delay);
          } catch (err) {
            console.error('GIF encoding error:', err);
          }
          if (isRecording && gifEncoder.byteLength > GIF_MAX_BYTES) {
            showToast(dict.msgGifMaxSizeReached || 'GIF reached 200 MB. Saving what was recorded…');
            stopRecording(false);
          }
        }
        if (gifFrames.length && gifEncoder) setTimeout(step, 0);
        else gifPumping = false;
      }, 0);
    }

    async function drainGifEncoder(onProgress) {
      const total = gifFrames.length;
      while (gifFrames.length) {
        const next = gifFrames.shift();
        gifEncoder.addFrame(next.data, next.delay);
        if (onProgress) onProgress(total - gifFrames.length, total);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    let gifWidth = 0;
    let gifHeight = 0;

    const btnStart = bar.querySelector('#__sd_rec_btn_start');
    const btnPause = bar.querySelector('#__sd_rec_btn_pause');
    const btnResume = bar.querySelector('#__sd_rec_btn_resume');
    const btnStop = bar.querySelector('#__sd_rec_btn_stop');
    const btnCancel = bar.querySelector('#__sd_rec_btn_cancel');
    const timerDisplay = bar.querySelector('#__sd_rec_timer');
    const timerText = bar.querySelector('#__sd_rec_time_text');

    function cleanUp() {
      if (animLoopId) cancelAnimationFrame(animLoopId);
      if (timerInterval) clearInterval(timerInterval);
      if (gifInterval) clearInterval(gifInterval);
      gifFrames = [];
      gifEncoder = null;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
        activeStream = null;
      }
      overlay.remove();
      document.removeEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (isRecording) {
          stopRecording(true);
        } else {
          cleanUp();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);

    function formatTimer(sec) {
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      return `${m}:${s}`;
    }

    async function startRecording() {
      // 1. Immediately hide handles, header, and switch UI BEFORE opening browser picker
      // This guarantees zero setup handles, drag headers, or start buttons are ever captured in the stream!
      dragHeader.style.display = 'none';
      Object.values(handles).forEach((h) => { h.style.display = 'none'; });

      // Crop box recording border: OUTLINE strictly OUTSIDE the crop box with 6px offset
      cropBox.style.pointerEvents = 'none';
      cropBox.style.border = 'none';
      cropBox.style.boxShadow = 'none';
      cropBox.style.outline = '2px solid #ff3b30';
      cropBox.style.outlineOffset = '6px';

      // Update UI state immediately before dialog opens
      btnStart.style.display = 'none';
      if (btnFormat) btnFormat.style.display = 'none';
      if (btnResolution) btnResolution.style.display = 'none';
      if (btnFps) btnFps.style.display = 'none';
      if (gifEstimateEl) gifEstimateEl.style.display = 'none';
      btnPause.style.display = 'flex';
      btnStop.style.display = 'flex';
      timerDisplay.style.display = 'inline-flex';

      // Ensure toolbar does not overlap crop box
      positionToolbar(curRect);

      // Force Chromium compositor to commit the painted changes BEFORE opening share modal
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 60);
          });
        });
      });

      try {
        const displayOptions = {
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
          surfaceSwitching: 'exclude', // switching tabs mid-recording would break the crop
          systemAudio: 'include',
          video: {
            displaySurface: 'browser'
          },
          audio: true
        };
        activeStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
        // The crop is computed from this tab's layout, so another tab, window
        // or screen would record the wrong area. Region Capture rejects cropTo
        // unless the captured surface is this very tab.
        const track = activeStream.getVideoTracks()[0];
        let sameTab = !track || track.getSettings().displaySurface === 'browser';
        if (sameTab && track && typeof window.CropTarget !== 'undefined' && typeof track.cropTo === 'function') {
          try {
            await track.cropTo(await window.CropTarget.fromElement(document.documentElement));
            await track.cropTo(undefined);
          } catch {
            sameTab = false;
          }
        }
        if (!sameTab) {
          activeStream.getTracks().forEach((t) => t.stop());
          activeStream = null;
          throw Object.assign(new Error('wrong surface'), { sdWrongSurface: true });
        }
      } catch (err) {
        // Restore setup UI on cancellation
        dragHeader.style.display = 'flex';
        Object.values(handles).forEach((h) => { h.style.display = 'block'; });
        btnStart.style.display = 'flex';
        if (btnFormat) btnFormat.style.display = 'flex';
        updateResVisibility();
        btnPause.style.display = 'none';
        btnStop.style.display = 'none';
        timerDisplay.style.display = 'none';
        cropBox.style.outline = '2px dashed #ff3b30';
        cropBox.style.outlineOffset = '0px';
        positionToolbar(curRect);
        console.warn('Screen recording rejected or failed:', err);
        showToast(err && err.sdWrongSurface
          ? (dict.toastRecWrongTab || 'To record an area of this page, choose “This tab” in the sharing dialog.')
          : msgPermissionDenied);
        return;
      }

      isRecording = true;
      isPaused = false;

      // Hidden video to receive stream
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = activeStream;
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve).catch(resolve);
        };
      });

      // Stream stabilization delay: flushes any frames captured while picker was closing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Start timer
      recordedSeconds = 0;
      const isGif = (selectedFormat === 'gif');
      timerText.textContent = isGif ? `${formatTimer(0)} / 01:00` : formatTimer(0);
      timerInterval = setInterval(() => {
        if (!isPaused) {
          recordedSeconds += 1;
          timerText.textContent = isGif ? `${formatTimer(recordedSeconds)} / 01:00` : formatTimer(recordedSeconds);
          if (isGif && recordedSeconds >= 60) {
            showToast(dict.msgGifMaxDurationReached || 'Maximum GIF duration of 1 minute (60s) reached. Generating GIF...');
            stopRecording(false);
          }
        }
      }, 1000);

      // Surface detection and geometry calibration
      const vTrack = activeStream.getVideoTracks()[0];
      const trackSettings = (vTrack && typeof vTrack.getSettings === 'function') ? vTrack.getSettings() : {};
      const surface = trackSettings.displaySurface || 'browser';

      // Canvas cropping dimensions
      const videoW = video.videoWidth || window.innerWidth;
      const videoH = video.videoHeight || window.innerHeight;
      let initialScaleX = videoW / window.innerWidth;
      let initialScaleY = videoH / window.innerHeight;
      if (surface === 'window') {
        initialScaleX = videoW / (window.outerWidth || window.innerWidth);
        initialScaleY = videoH / (window.outerHeight || window.innerHeight);
      } else if (surface === 'monitor') {
        initialScaleX = videoW / ((window.screen && window.screen.width) || window.outerWidth);
        initialScaleY = videoH / ((window.screen && window.screen.height) || window.outerHeight);
      }

      let cw = Math.round(curRect.w * initialScaleX);
      let ch = Math.round(curRect.h * initialScaleY);
      if (cw % 2 !== 0) cw += 1;
      if (ch % 2 !== 0) ch += 1;
      cw = Math.max(4, cw);
      ch = Math.max(4, ch);

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cw;
      cropCanvas.height = ch;
      const cctx = cropCanvas.getContext('2d');

      function loop() {
        if (!isRecording) return;
        if (!isPaused && video.readyState >= 2) {
          const curVW = video.videoWidth || window.innerWidth;
          const curVH = video.videoHeight || window.innerHeight;

          let originX = 0;
          let originY = 0;
          let sX = curVW / window.innerWidth;
          let sY = curVH / window.innerHeight;

          if (surface === 'window') {
            const chromeTop = Math.max(0, window.outerHeight - window.innerHeight);
            const chromeLeft = Math.max(0, Math.round((window.outerWidth - window.innerWidth) / 2));
            originX = chromeLeft;
            originY = chromeTop;
            sX = curVW / (window.outerWidth || window.innerWidth);
            sY = curVH / (window.outerHeight || window.innerHeight);
          } else if (surface === 'monitor') {
            const chromeTop = Math.max(0, window.outerHeight - window.innerHeight);
            const chromeLeft = Math.max(0, Math.round((window.outerWidth - window.innerWidth) / 2));
            const scrX = (typeof window.screenX !== 'undefined' ? window.screenX : window.screenLeft) || 0;
            const scrY = (typeof window.screenY !== 'undefined' ? window.screenY : window.screenTop) || 0;
            originX = scrX + chromeLeft;
            originY = chromeTop;
            const sWidth = (window.screen && window.screen.width) || window.outerWidth;
            const sHeight = (window.screen && window.screen.height) || window.outerHeight;
            sX = curVW / sWidth;
            sY = curVH / sHeight;
          }

          // Inset 4px to guarantee 10px total gap from external 6px red outline
          const inset = 4;
          let sx = (originX + curRect.x + inset) * sX;
          let sy = (originY + curRect.y + inset) * sY;
          let sw = Math.max(2, (curRect.w - inset * 2) * sX);
          let sh = Math.max(2, (curRect.h - inset * 2) * sY);

          sx = Math.max(0, Math.min(sx, curVW - 4));
          sy = Math.max(0, Math.min(sy, curVH - 4));
          sw = Math.min(sw, curVW - sx);
          sh = Math.min(sh, curVH - sy);

          cctx.drawImage(video, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height);
        }
        animLoopId = requestAnimationFrame(loop);
      }
      animLoopId = requestAnimationFrame(loop);

      // GIF Branch vs MediaRecorder Branch
      gifFrames = [];
      gifEncoder = null;
      if (selectedFormat === 'gif') {
        const maxDim = gifMaxDim(selectedGifResolution);

        gifWidth = cw;
        gifHeight = ch;
        if (gifWidth > maxDim || gifHeight > maxDim) {
          const gifScale = Math.min(maxDim / gifWidth, maxDim / gifHeight);
          gifWidth = Math.max(4, Math.round(gifWidth * gifScale));
          gifHeight = Math.max(4, Math.round(gifHeight * gifScale));
        }
        if (gifWidth % 2 !== 0) gifWidth++;
        if (gifHeight % 2 !== 0) gifHeight++;

        const fps = Math.max(1, Math.min(30, selectedGifFps || 10));
        const intervalMs = Math.round(1000 / fps);
        gifDelayCentisec = Math.max(1, Math.round(100 / fps));
        const maxFrames = fps * 60; // Exact 60 seconds max
        let captured = 0;

        const gifHelper = (typeof SourceDownloadGif !== 'undefined') ? SourceDownloadGif : window.SourceDownloadGif;
        gifEncoder = gifHelper.createGifEncoder(gifWidth, gifHeight, gifDelayCentisec);

        const gifSampleCanvas = document.createElement('canvas');
        gifSampleCanvas.width = gifWidth;
        gifSampleCanvas.height = gifHeight;
        const gifSampleCtx = gifSampleCanvas.getContext('2d', { willReadFrequently: true });

        // Frames are encoded as they arrive (gifFrames is only a short queue).
        // If encoding falls behind, the frame is skipped and its time is added
        // to the previous one, so the GIF keeps real-time speed.
        gifInterval = setInterval(() => {
          if (isPaused || !isRecording || video.readyState < 2) return;
          captured++;
          if (gifFrames.length >= GIF_MAX_QUEUE) {
            gifFrames[gifFrames.length - 1].delay += gifDelayCentisec;
          } else {
            gifSampleCtx.drawImage(cropCanvas, 0, 0, gifWidth, gifHeight);
            gifFrames.push({ data: gifSampleCtx.getImageData(0, 0, gifWidth, gifHeight).data, delay: gifDelayCentisec });
            pumpGifEncoder();
          }
          if (captured >= maxFrames) {
            showToast(dict.msgGifMaxDurationReached || 'Maximum GIF duration of 1 minute (60s) reached. Generating GIF...');
            stopRecording(false);
          }
        }, intervalMs);
      } else {
        const croppedStream = cropCanvas.captureStream(30);
        activeStream.getAudioTracks().forEach((at) => croppedStream.addTrack(at));

        let mimeType = 'video/webm;codecs=vp9';
        let fileExt = 'webm';
        if (selectedFormat === 'mp4') {
          if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
            mimeType = 'video/mp4;codecs=avc1';
            fileExt = 'mp4';
          } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
            fileExt = 'mp4';
          } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mimeType = 'video/webm;codecs=vp9';
            fileExt = 'webm';
          } else {
            mimeType = 'video/webm';
            fileExt = 'webm';
          }
        } else {
          if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mimeType = 'video/webm;codecs=vp9';
            fileExt = 'webm';
          } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
            fileExt = 'webm';
          }
        }

        const chunks = [];
        mediaRecorder = new MediaRecorder(croppedStream, { mimeType });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          if (animLoopId) cancelAnimationFrame(animLoopId);
          video.remove();
          if (activeStream) {
            activeStream.getTracks().forEach((t) => t.stop());
            activeStream = null;
          }

          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: mimeType });
            const stored = await chrome.storage.local.get({ namingPatterns: {} });
            const pattern = (stored.namingPatterns && stored.namingPatterns.recording) || '{domain}-{type}-{date}_{time}';
            const namingHelper = (typeof SourceDownloadNaming !== 'undefined') ? SourceDownloadNaming : (typeof window !== 'undefined' && window.SourceDownloadNaming);
            let domain = 'webpage';
            try { domain = window.location.hostname.replace(/[^a-z0-9.-]/gi, '_'); } catch {}
            const filename = namingHelper
              ? namingHelper.formatFilename(pattern, { domain, title: document.title, type: 'video-recording' }, '.' + fileExt)
              : `recording-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${fileExt}`;
            const url = URL.createObjectURL(blob);
            triggerDownload(url, filename);
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            showToast(msgSaved);
          }
          cleanUp();
        };

        mediaRecorder.start(200);
      }

      activeStream.getVideoTracks()[0].onended = () => {
        if (isRecording) stopRecording(false);
      };
    }

    function pauseRecording() {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
      }
      isPaused = true;
      btnPause.style.display = 'none';
      btnResume.style.display = 'flex';
    }

    function resumeRecording() {
      if (mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
      }
      isPaused = false;
      btnResume.style.display = 'none';
      btnPause.style.display = 'flex';
    }

    async function stopRecording(cancelled = false) {
      isRecording = false;
      if (timerInterval) clearInterval(timerInterval);
      if (cancelled) {
        if (gifInterval) clearInterval(gifInterval);
        cleanUp();
        showToast(msgCancelled);
        return;
      }

      if (selectedFormat === 'gif') {
        if (gifInterval) clearInterval(gifInterval);
        if (animLoopId) cancelAnimationFrame(animLoopId);
        btnStop.disabled = true;
        btnStop.style.opacity = '0.7';
        btnStop.innerHTML = `<span>${dict.toastRecGeneratingGif || 'Generating GIF...'}</span>`;
        showToast(dict.toastRecGeneratingGif || 'Generating GIF, please wait...');

        // Allow browser to render progress toast before finishing the encode
        await new Promise((r) => setTimeout(r, 50));

        if (gifEncoder) {
          try {
            await drainGifEncoder((cur, tot) => {
              btnStop.innerHTML = `<span>GIF: ${Math.round((cur / Math.max(1, tot)) * 100)}%</span>`;
            });
            if (gifEncoder.frameCount === 0 && cropCanvas) {
              const fallbackCanvas = document.createElement('canvas');
              fallbackCanvas.width = gifWidth;
              fallbackCanvas.height = gifHeight;
              const fbCtx = fallbackCanvas.getContext('2d');
              fbCtx.drawImage(cropCanvas, 0, 0, gifWidth, gifHeight);
              gifEncoder.addFrame(fbCtx.getImageData(0, 0, gifWidth, gifHeight).data);
            }
            const blob = gifEncoder.finish();
            gifEncoder = null;
            const stored = await chrome.storage.local.get({ namingPatterns: {} });
            const pattern = (stored.namingPatterns && stored.namingPatterns.recording) || '{domain}-{type}-{date}_{time}';
            const namingHelper = (typeof SourceDownloadNaming !== 'undefined') ? SourceDownloadNaming : (typeof window !== 'undefined' && window.SourceDownloadNaming);
            let domain = 'webpage';
            try { domain = window.location.hostname.replace(/[^a-z0-9.-]/gi, '_'); } catch {}
            const filename = namingHelper
              ? namingHelper.formatFilename(pattern, { domain, title: document.title, type: 'video-recording' }, '.gif')
              : `recording-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.gif`;
            const url = URL.createObjectURL(blob);
            triggerDownload(url, filename);
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            showToast(msgSaved);
          } catch (err) {
            console.error('GIF encoding error:', err);
          }
        }
        cleanUp();
        return;
      }

      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      } else {
        cleanUp();
      }
    }

    btnStart.addEventListener('click', () => {
      startRecording();
    });

    btnPause.addEventListener('click', () => {
      pauseRecording();
    });

    btnResume.addEventListener('click', () => {
      resumeRecording();
    });

    btnStop.addEventListener('click', () => {
      stopRecording(false);
    });

    btnCancel.addEventListener('click', () => {
      if (isRecording) {
        stopRecording(true);
      } else {
        cleanUp();
      }
    });

    document.body.appendChild(overlay);
  }

  /* ============================================================
   * Screen Color Picker (startColorPicker & showColorInspector)
   * Samples pixel color using EyeDropper API and displays
   * floating Color Inspector modal with HEX, RGB, RGBA, HSL,
   * HSLA, CMYK, HSV values and copy buttons.
   * ============================================================ */
  async function startColorPicker(langCode) {
    const existing = document.getElementById('__sd_color_inspector');
    if (existing) existing.remove();

    const { dict, lang } = resolveDict(langCode);

    if (!('EyeDropper' in window)) {
      showToast(dict.toastEyeDropperUnsupported || 'Your browser does not support the EyeDropper API.');
      return;
    }

    try {
      await openEyeDropper(langCode);
    } catch (err) {
      if (isEyeDropperAbort(err)) return; // User pressed ESC to cancel eye dropper
      if (err && err.name === 'NotAllowedError') {
        // EyeDropper needs a click on the page. A right-click provides one;
        // the popup or the panel do not, so ask for a single click here.
        showColorPickerPrompt(langCode, dict);
        return;
      }
      console.warn('Color picker failed:', err);
    }
  }

  function isEyeDropperAbort(err) {
    return Boolean(err && (err.name === 'AbortError' || String(err).includes('AbortError')));
  }

  async function openEyeDropper(langCode) {
    const eyeDropper = new window.EyeDropper();
    const result = await eyeDropper.open();
    if (result && result.sRGBHex) showColorInspector(result.sRGBHex, langCode);
  }

  function showColorPickerPrompt(langCode, dict) {
    sdEnsureTheme();
    const old = document.getElementById('__sd_color_prompt');
    if (old) old.remove();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = '__sd_color_prompt';
    btn.textContent = dict.colorPickerClickToStart || 'Click here, then pick any color on the page';
    btn.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:10px 18px;border:0;border-radius:8px;background:var(--sd-accent);color:#fff;font:600 13px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 25px -5px rgba(0,0,0,0.4);cursor:pointer;';
    const close = () => {
      btn.remove();
      document.removeEventListener('keydown', onKey, true);
      clearTimeout(timer);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    const timer = setTimeout(close, 15000);
    btn.addEventListener('click', async () => {
      close();
      try {
        await openEyeDropper(langCode);
      } catch (err) {
        if (!isEyeDropperAbort(err)) console.warn('Color picker failed:', err);
      }
    }, { once: true });
    document.addEventListener('keydown', onKey, true);
    document.documentElement.appendChild(btn);
    btn.focus();
  }

  function showColorInspector(hexInput, langCode) {
    sdEnsureTheme();
    const existing = document.getElementById('__sd_color_inspector');
    if (existing) existing.remove();

    const { dict, lang } = resolveDict(langCode);
    const labelTitle = dict.colorPickerTitle || 'Color Picker';
    const labelPickAgain = dict.btnColorPickAgain || 'Pick Again';
    const msgCopied = dict.toastColorCopied || 'Color copied to clipboard';

    // Parse R, G, B
    let cleanHex = hexInput.replace(/^#/, '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(cleanHex.slice(0, 6), 16) || 0;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;

    // Formats
    const hex = '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join('');
    const rgb = `rgb(${r}, ${g}, ${b})`;
    const rgba = `rgba(${r}, ${g}, ${b}, 1)`;

    // HSL / HSLA
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    let h = 0, s = 0, l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h /= 6;
    }
    const hDeg = Math.round(h * 360);
    const sPct = Math.round(s * 100);
    const lPct = Math.round(l * 100);
    const hsl = `hsl(${hDeg}, ${sPct}%, ${lPct}%)`;
    const hsla = `hsla(${hDeg}, ${sPct}%, ${lPct}%, 1)`;

    // CMYK
    const k = 1 - Math.max(rn, gn, bn);
    let c = 0, m = 0, y = 0;
    if (k < 1) {
      c = (1 - rn - k) / (1 - k);
      m = (1 - gn - k) / (1 - k);
      y = (1 - bn - k) / (1 - k);
    }
    const cPct = Math.round(c * 100);
    const mPct = Math.round(m * 100);
    const yPct = Math.round(y * 100);
    const kPct = Math.round(k * 100);
    const cmyk = `cmyk(${cPct}%, ${mPct}%, ${yPct}%, ${kPct}%)`;

    // HSV
    const v = max;
    const sHsv = max === 0 ? 0 : d / max;
    const sHsvPct = Math.round(sHsv * 100);
    const vPct = Math.round(v * 100);
    const hsv = `hsv(${hDeg}, ${sHsvPct}%, ${vPct}%)`;

    const formats = [
      { name: 'HEX', val: hex },
      { name: 'RGB', val: rgb },
      { name: 'RGBA', val: rgba },
      { name: 'HSL', val: hsl },
      { name: 'HSLA', val: hsla },
      { name: 'CMYK', val: cmyk },
      { name: 'HSV', val: hsv },
    ];

    const inspector = document.createElement('div');
    inspector.id = '__sd_color_inspector';
    inspector.style.cssText = 'position:fixed;top:24px;right:24px;width:340px;background:var(--sd-surface);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--sd-border);border-radius:12px;box-shadow:var(--sd-shadow);z-index:2147483647;color:var(--sd-text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;overflow:hidden;box-sizing:border-box;user-select:none;';

    // Header with drag capability
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--sd-chip);border-bottom:1px solid var(--sd-border);cursor:move;';
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--sd-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>
        <span>${labelTitle}</span>
      </div>
      <button type="button" id="__sd_ci_close" style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;background:transparent;border:none;color:var(--sd-muted);cursor:pointer;border-radius:4px;font-size:16px;line-height:1;transition:color 0.15s;">✕</button>
    `;
    if (SD_RTL_LOCALES.includes(lang)) inspector.dir = 'rtl';
    inspector.appendChild(header);

    // Hero Swatch & Hex
    const hero = document.createElement('div');
    hero.style.cssText = 'padding:14px 14px 10px;display:flex;align-items:center;gap:14px;';
    hero.innerHTML = `
      <div style="width:52px;height:52px;border-radius:10px;background:${hex};border:2px solid var(--sd-border-strong);box-shadow:0 4px 14px rgba(0,0,0,0.4);flex-shrink:0;"></div>
      <div style="display:flex;flex-direction:column;gap:3px;overflow:hidden;">
        <span style="font-size:18px;font-weight:700;font-family:monospace;letter-spacing:0.5px;color:var(--sd-text);">${hex}</span>
        <span style="font-size:12px;color:var(--sd-muted);font-family:monospace;">${rgb}</span>
      </div>
    `;
    inspector.appendChild(hero);

    // Rows Container
    const rowsCont = document.createElement('div');
    rowsCont.style.cssText = 'padding:6px 14px 12px;display:flex;flex-direction:column;gap:6px;';

    const copySvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    const checkSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34c759" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    formats.forEach((fmt) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--sd-chip);border:1px solid var(--sd-border);border-radius:6px;gap:8px;';

      row.innerHTML = `
        <span style="width:46px;font-size:11px;font-weight:700;color:var(--sd-muted);letter-spacing:0.3px;flex-shrink:0;">${fmt.name}</span>
        <span style="flex:1;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;color:var(--sd-text);text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${sdEsc(fmt.val)}">${fmt.val}</span>
        <button type="button" class="__sd_ci_copy" title="${sdEsc(sdFill(dict.tipColorCopyFormat || 'Copy $format$', { format: fmt.name }))}" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:var(--sd-chip);border:1px solid var(--sd-border);border-radius:5px;color:var(--sd-text);cursor:pointer;flex-shrink:0;transition:all 0.15s;">
          ${copySvg}
        </button>
      `;

      const btnCopy = row.querySelector('.__sd_ci_copy');
      btnCopy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(fmt.val);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = fmt.val;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        btnCopy.innerHTML = checkSvg;
        btnCopy.style.borderColor = '#34c759';
        showToast(msgCopied);
        setTimeout(() => {
          btnCopy.innerHTML = copySvg;
          btnCopy.style.borderColor = 'var(--sd-border)';
        }, 1200);
      });

      rowsCont.appendChild(row);
    });
    inspector.appendChild(rowsCont);

    // Footer actions
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:10px 14px;background:var(--sd-surface-2);border-top:1px solid var(--sd-border);display:flex;align-items:center;justify-content:space-between;gap:8px;';
    footer.innerHTML = `
      <button type="button" id="__sd_ci_again" style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--sd-accent);border:none;border-radius:6px;color:#fff;font-weight:600;font-size:12px;cursor:pointer;transition:background 0.15s;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>
        <span>${labelPickAgain}</span>
      </button>
      <button type="button" id="__sd_ci_dismiss" style="padding:6px 12px;background:transparent;border:1px solid var(--sd-border);border-radius:6px;color:var(--sd-muted);font-size:12px;cursor:pointer;transition:color 0.15s;">
        ${dict.btnAreaCancel || 'Cancel'}
      </button>
    `;
    inspector.appendChild(footer);

    // Drag header logic
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let initLeft = 0, initTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.id === '__sd_ci_close') return;
      isDragging = true;
      const rect = inspector.getBoundingClientRect();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initLeft = rect.left;
      initTop = rect.top;
      inspector.style.right = 'auto';
      inspector.style.left = `${initLeft}px`;
      inspector.style.top = `${initTop}px`;
      e.preventDefault();
    });

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      inspector.style.left = `${Math.max(10, Math.min(window.innerWidth - 350, initLeft + dx))}px`;
      inspector.style.top = `${Math.max(10, Math.min(window.innerHeight - 300, initTop + dy))}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    function closeInspector() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onEsc);
      inspector.remove();
    }

    function onEsc(e) {
      if (e.key === 'Escape') closeInspector();
    }
    document.addEventListener('keydown', onEsc);

    header.querySelector('#__sd_ci_close').addEventListener('click', closeInspector);
    footer.querySelector('#__sd_ci_dismiss').addEventListener('click', closeInspector);
    footer.querySelector('#__sd_ci_again').addEventListener('click', () => {
      closeInspector();
      startColorPicker(langCode);
    });

    document.body.appendChild(inspector);
    sdDialog(inspector, labelTitle);
  }

  /* ============================================================
   * Full Page Screenshot Progress & Multi-Format Export Modal
   * ============================================================ */
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

  function showFullPageProgress(current, total, percent, langCode) {
    sdEnsureTheme();
    let el = document.getElementById('__sd_fps_progress');
    const { dict, lang } = resolveDict(langCode);
    let msgTemplate = dict.toastProgressCapturing || 'Capturing full page... $PERCENT$% ($CURRENT$/$TOTAL$)';
    let text = msgTemplate
      .replace(/\$PERCENT\$/gi, String(percent))
      .replace(/\$CURRENT\$/gi, String(current))
      .replace(/\$TOTAL\$/gi, String(total));
    if (!/\$CURRENT\$/i.test(msgTemplate)) {
      text = text.trim() + ` (${current}/${total})`;
    }

    if (!el) {
      el = document.createElement('div');
      el.id = '__sd_fps_progress';
      el.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:2147483647;background:var(--sd-surface);color:var(--sd-text);padding:10px 22px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;font-weight:600;box-shadow:var(--sd-shadow);border:1px solid var(--sd-border);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;gap:14px;pointer-events:none;transition:all 0.2s ease;';
      document.body.appendChild(el);
    }
    if (SD_RTL_LOCALES.includes(lang)) el.dir = 'rtl';
    el.style.setProperty('display', 'flex', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.innerHTML = `
      <div style="width:16px;height:16px;border:2.5px solid var(--sd-border);border-top-color:var(--sd-accent);border-radius:50%;animation:__sd_spin 0.8s linear infinite;flex-shrink:0;"></div>
      <span style="letter-spacing:0.3px;">${text}</span>
    `;
    if (!document.getElementById('__sd_spin_style')) {
      const style = document.createElement('style');
      style.id = '__sd_spin_style';
      style.textContent = '@keyframes __sd_spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
  }

  function showFullPageStitching(langCode) {
    const el = document.getElementById('__sd_fps_progress');
    const { dict, lang } = resolveDict(langCode);
    const text = dict.toastProgressStitching || 'Stitching image...';
    if (el) {
      el.style.setProperty('display', 'flex', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.innerHTML = `
        <div style="width:16px;height:16px;border:2.5px solid var(--sd-border);border-top-color:#34c759;border-radius:50%;animation:__sd_spin 0.8s linear infinite;flex-shrink:0;"></div>
        <span style="letter-spacing:0.3px;">${text}</span>
      `;
    }
  }

  function hideFullPageProgress() {
    const el = document.getElementById('__sd_fps_progress');
    if (el) el.remove();
  }

  function showFullPageExportModal(params) {
    sdEnsureTheme();
    hideFullPageProgress();
    const existing = document.getElementById('__sd_fps_export_modal');
    if (existing) existing.remove();

    const { dataUrl, width, height, domain, title, baseFilename, lang: langCode } = params;
    const { dict, lang } = resolveDict(langCode);

    const titleText = dict.modalExportTitle || 'Full Page Screenshot Ready';
    const labelPng = dict.btnExportPng || 'Download PNG';
    const labelJpg = dict.btnExportJpg || 'Download JPG';
    const labelPdf = dict.btnExportPdf || 'Save as PDF';
    const labelCopy = dict.btnExportCopy || 'Copy to Clipboard';
    const labelGenerating = dict.btnExportGenerating || 'Generating...';
    const msgPdfSaved = dict.toastPdfGenerated || 'PDF document saved.';
    const msgCopied = dict.toastImageCopied || 'Image copied to clipboard';
    const msgDownloaded = dict.toastAreaDownloaded || 'Screenshot downloaded';
    const labelClose = dict.guideClose || 'Close (Esc)';

    const backdrop = document.createElement('div');
    backdrop.id = '__sd_fps_export_modal';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(15,20,35,0.42);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;padding:16px;box-sizing:border-box;';

    const modal = document.createElement('div');
    modal.style.cssText = 'width:520px;max-width:94vw;max-height:92vh;background:var(--sd-surface);border:1px solid var(--sd-border);border-radius:14px;box-shadow:var(--sd-shadow-lg);display:flex;flex-direction:column;overflow:hidden;color:var(--sd-text);box-sizing:border-box;animation:__sd_pop 0.18s ease-out;';

    if (!document.getElementById('__sd_pop_style')) {
      const style = document.createElement('style');
      style.id = '__sd_pop_style';
      style.textContent = '@keyframes __sd_pop { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }';
      document.head.appendChild(style);
    }

    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:var(--sd-chip);border-bottom:1px solid var(--sd-border);">
        <div style="display:flex;align-items:center;gap:9px;font-weight:600;font-size:14px;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--sd-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span>${titleText}</span>
        </div>
        <button type="button" id="__sd_modal_close" title="${sdEsc(labelClose)}" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:transparent;border:none;color:var(--sd-muted);cursor:pointer;border-radius:6px;font-size:17px;line-height:1;transition:color 0.15s;">✕</button>
      </div>

      <div style="padding:16px 18px 12px;display:flex;flex-direction:column;gap:12px;background:var(--sd-surface-2);">
        <div style="width:100%;height:200px;background:var(--sd-canvas);border:1px solid var(--sd-border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:inset 0 1px 3px rgba(16,24,40,0.08);">
          <img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;" alt="${sdEsc(dict.altScreenshotPreview || 'Screenshot preview')}">
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--sd-muted);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;">
          <span>${width} × ${height} px</span>
          <span style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${sdEsc(title || domain)}">${sdEsc(title || domain)}</span>
        </div>
      </div>

      <div style="padding:16px 18px 20px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button type="button" id="__sd_btn_png" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;background:var(--sd-accent);border:none;border-radius:8px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;transition:background 0.15s;box-shadow:0 2px 8px rgba(47,99,224,0.28);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span>${labelPng}</span>
        </button>
        <button type="button" id="__sd_btn_jpg" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;background:var(--sd-surface-2);border:1px solid var(--sd-border);border-radius:8px;color:var(--sd-text);font-weight:600;font-size:13px;cursor:pointer;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>${labelJpg}</span>
        </button>
        <button type="button" id="__sd_btn_pdf" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;background:var(--sd-surface-2);border:1px solid var(--sd-border);border-radius:8px;color:var(--sd-text);font-weight:600;font-size:13px;cursor:pointer;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>${labelPdf}</span>
        </button>
        <button type="button" id="__sd_btn_copy" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;background:var(--sd-surface-2);border:1px solid var(--sd-border);border-radius:8px;color:var(--sd-text);font-weight:600;font-size:13px;cursor:pointer;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>${labelCopy}</span>
        </button>
      </div>
    `;

    if (SD_RTL_LOCALES.includes(lang)) modal.dir = 'rtl';
    backdrop.appendChild(modal);

    function closeModal() {
      document.removeEventListener('keydown', onEscModal);
      backdrop.remove();
    }

    function onEscModal(e) {
      if (e.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', onEscModal);

    modal.querySelector('#__sd_modal_close').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    // 1. Export PNG
    const btnPng = modal.querySelector('#__sd_btn_png');
    btnPng.addEventListener('click', () => {
      const pngName = baseFilename.endsWith('.png') ? baseFilename : baseFilename + '.png';
      triggerDownload(dataUrl, pngName);
      showToast(msgDownloaded);
      closeModal();
    });

    // 2. Export JPG
    const btnJpg = modal.querySelector('#__sd_btn_jpg');
    btnJpg.addEventListener('click', () => {
      btnJpg.disabled = true;
      btnJpg.innerHTML = `<span>${labelGenerating}</span>`;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || width;
        canvas.height = img.naturalHeight || height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const jpgName = baseFilename.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
        triggerDownload(jpgDataUrl, jpgName);
        showToast(msgDownloaded);
        closeModal();
      };
      img.onerror = () => {
        btnJpg.disabled = false;
        btnJpg.innerHTML = `<span>${labelJpg}</span>`;
      };
      img.src = dataUrl;
    });

    // 3. Export PDF
    const btnPdf = modal.querySelector('#__sd_btn_pdf');
    btnPdf.addEventListener('click', async () => {
      btnPdf.disabled = true;
      btnPdf.innerHTML = `<span>${labelGenerating}</span>`;
      const pdfHelper = (typeof SourceDownloadPdf !== 'undefined') ? SourceDownloadPdf : (typeof window !== 'undefined' && window.SourceDownloadPdf);
      if (pdfHelper && typeof pdfHelper.createPdfBlobFromDataUrl === 'function') {
        try {
          const blob = await pdfHelper.createPdfBlobFromDataUrl(dataUrl);
          const pdfUrl = URL.createObjectURL(blob);
          const pdfName = baseFilename.replace(/\.[a-z0-9]+$/i, '') + '.pdf';
          triggerDownload(pdfUrl, pdfName);
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);
          showToast(msgPdfSaved);
          closeModal();
        } catch (err) {
          console.error('PDF export failed:', err);
          btnPdf.disabled = false;
          btnPdf.innerHTML = `<span>${labelPdf}</span>`;
        }
      } else {
        btnPdf.disabled = false;
        btnPdf.innerHTML = `<span>${labelPdf}</span>`;
      }
    });

    // 4. Copy to Clipboard
    const btnCopy = modal.querySelector('#__sd_btn_copy');
    btnCopy.addEventListener('click', async () => {
      btnCopy.disabled = true;
      btnCopy.innerHTML = `<span>${labelGenerating}</span>`;
      try {
        const blob = dataUrlToBlob(dataUrl);
        sdRecordValue();
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast(msgCopied);
        btnCopy.disabled = false;
        btnCopy.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34c759" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${labelCopy}</span>
        `;
      } catch (err) {
        console.warn('Clipboard copy failed:', err);
        btnCopy.disabled = false;
        btnCopy.innerHTML = `<span>${labelCopy}</span>`;
      }
    });

    document.body.appendChild(backdrop);
    sdDialog(backdrop, titleText, { modal: true });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return false;

    if (msg.type === 'startAreaCapture') {
      startAreaCapture(msg.dataUrl, msg.lang);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'startAreaVideoRecord') {
      startAreaVideoRecord(msg.lang);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'startColorPicker') {
      startColorPicker(msg.lang);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'fullPageScreenshotStart') {
      showFullPageProgress(1, msg.totalSteps, 0, msg.lang);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'fullPageProgress') {
      showFullPageProgress(msg.current, msg.total, msg.percent, msg.lang);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'fullPageStitching') {
      showFullPageStitching(msg.lang);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'showFullPageExportModal') {
      showFullPageExportModal(msg);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'ping') {
      sendResponse({ pong: true });
      return false;
    }
    if (msg.type === 'zapLastElement') {
      const ctx = window.__sdContext || {};
      if (ctx.target) lastRightClickTarget = ctx.target;
      if (typeof ctx.x === 'number') {
        lastMouseX = ctx.x;
        lastMouseY = ctx.y;
      }
      const ok = zapElement(lastRightClickTarget, msg);
      sendResponse({ ok, zappedCount: zappedStack.length });
      return false;
    }
    if (msg.type === 'undoZapElement') {
      undoZap();
      sendResponse({ ok: true, zappedCount: zappedStack.length });
      return false;
    }
    if (msg.type === 'resetAllZap') {
      resetAllZap();
      sendResponse({ ok: true, zappedCount: 0 });
      return false;
    }
    if (msg.type === 'prepareFullPageScreenshot') {
      const dims = prepareScreenshot();
      sendResponse(dims);
      return false;
    }
    if (msg.type === 'hideStickyElements') {
      hideSticky();
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'hideProgressForSlice') {
      const el = document.getElementById('__sd_fps_progress');
      if (el) {
        el.style.setProperty('display', 'none', 'important');
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          sendResponse({ ok: true });
        });
      });
      return true;
    }
    if (msg.type === 'hideFullPageProgress') {
      hideFullPageProgress();
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'scrollToY') {
      window.scrollTo({ top: msg.y, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = msg.y;
      if (document.body) document.body.scrollTop = msg.y;
      sendResponse({ ok: true, y: window.scrollY || document.documentElement.scrollTop || 0 });
      return false;
    }
    if (msg.type === 'finishFullPageScreenshot') {
      finishScreenshot();
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'triggerDownload') {
      triggerDownload(msg.url, msg.filename);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'showToast') {
      showToast(msg.text);
      sendResponse({ ok: true });
      return false;
    }
    if (msg.type === 'getDomAndAssets') {
      buildSingleFileHtml().then((html) => {
        sendResponse({ html, title: document.title, location: window.location.href });
      }).catch((err) => {
        console.error('Archive build error:', err);
        sendResponse({ html: '<!DOCTYPE html><html><body>Error archiving page</body></html>', title: document.title, location: window.location.href });
      });
      return true; // Keep message channel open for async response
    }
    return false;
  });
})();
