/* Source Download — content script.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Counts the resources present on the inspected page
 * (Resource Timing API + DOM scan) and reports per-category counts to the
 * background service worker, which updates the toolbar badge. */

(() => {
  const EXT_TYPES = {
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
    ico: 'image', avif: 'image', bmp: 'image', jxl: 'image', jfif: 'image',
    svg: 'svg', svgz: 'svg',
    mp4: 'video', webm: 'video', mkv: 'video', mov: 'video', m4v: 'video', ogv: 'video',
    ts: 'video', m3u8: 'video', m3u: 'video',
    mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', m4a: 'audio', aac: 'audio',
    flac: 'audio', opus: 'audio', weba: 'audio',
    vtt: 'caption', srt: 'caption', ttml: 'caption', sbv: 'caption', ass: 'caption', ssa: 'caption',
    css: 'css',
    js: 'js', mjs: 'js', cjs: 'js', jsx: 'js', ts: 'js', tsx: 'js',
    woff: 'font', woff2: 'font', ttf: 'font', otf: 'font', eot: 'font',
    pdf: 'document', doc: 'document', docx: 'document', xls: 'document', xlsx: 'document',
    ppt: 'document', pptx: 'document', txt: 'document', xml: 'document',
    html: 'document', htm: 'document', csv: 'document', md: 'document', rtf: 'document',
    zip: 'document', gz: 'document',
    json: 'json', json5: 'json', geojson: 'json',
    map: 'sourcemap',
    wasm: 'wasm',
    webmanifest: 'manifest', manifest: 'manifest',
  };

  const BLOCKED = /^(chrome|chrome-extension|chromium|devtools|about|edge|moz-extension|vivaldi|brave|opera):/i;
  const seen = new Map(); // url -> category

  function getExt(url) {
    try {
      const m = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
      return m ? m[1].toLowerCase() : '';
    } catch {
      const m = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
      return m ? m[1].toLowerCase() : '';
    }
  }

  function classify(url, initiator) {
    if (!url || typeof url !== 'string') return null;
    if (BLOCKED.test(url)) return null;
    const ext = getExt(url);
    if (EXT_TYPES[ext]) return EXT_TYPES[ext];
    switch (initiator) {
      case 'img': return 'image';
      case 'video': return 'video';
      case 'audio': return 'audio';
      case 'track': return 'caption';
      case 'script': return 'js';
      case 'css': return 'css';
      case 'fetch':
      case 'xmlhttprequest': return 'api';
      default: return 'other';
    }
  }

  function add(url, initiator) {
    const t = classify(url, initiator);
    if (t && !seen.has(url)) seen.set(url, t);
  }

  function collectPerformance() {
    let entries = [];
    try {
      entries = performance.getEntriesByType('resource');
    } catch {
      /* noop */
    }
    for (const e of entries) add(e.name, e.initiatorType);
  }

  function collectDom() {
    const doc = document;
    doc.querySelectorAll('img').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      const u = el.currentSrc || el.src;
      if (u) add(u, 'img');
    });
    doc.querySelectorAll('img[srcset], source[srcset]').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      (el.srcset || '').split(',').forEach((part) => {
        const u = part.trim().split(/\s+/)[0];
        if (u) add(u, 'img');
      });
    });
    doc.querySelectorAll('video').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      const s = el.querySelector('source');
      const u = el.currentSrc || (s && s.src);
      if (u) add(u, 'video');
    });
    doc.querySelectorAll('video source').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      add(el.src, 'video');
    });
    doc.querySelectorAll('audio').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      const s = el.querySelector('source');
      const u = el.currentSrc || (s && s.src);
      if (u) add(u, 'audio');
    });
    doc.querySelectorAll('audio source').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      add(el.src, 'audio');
    });
    doc.querySelectorAll('script[src]').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      add(el.src, 'script');
    });
    doc.querySelectorAll('link[rel~="stylesheet"]').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      add(el.href, 'css');
    });
    doc.querySelectorAll('link[rel~="icon"]').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      add(el.href, 'link');
    });
    doc.querySelectorAll('iframe[src]').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      add(el.src, 'document');
    });
    doc.querySelectorAll('track[src]').forEach((el) => {
      if (el.closest('[data-sd-zapped]')) return;
      add(el.src, 'track');
    });
  }

  function computeCounts() {
    const counts = { all: 0, api: 0, image: 0, svg: 0, video: 0, audio: 0, caption: 0, css: 0, js: 0, sourcemap: 0, font: 0, document: 0, json: 0, wasm: 0, manifest: 0, other: 0 };
    for (const t of seen.values()) if (counts[t] !== undefined) counts[t]++;
    counts.all = seen.size;
    return counts;
  }

  function send() {
    collectPerformance();
    collectDom();
    try {
      chrome.runtime.sendMessage({ type: 'resourceCounts', counts: computeCounts() }, () => {
        void chrome.runtime.lastError; // popup/background may be idle
      });
    } catch {
      /* noop */
    }
  }

  send();
  window.addEventListener('load', send);

  let domTimer = null;
  const observer = new MutationObserver(() => {
    if (domTimer) return;
    domTimer = setTimeout(() => {
      domTimer = null;
      send();
    }, 800);
  });
  try {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch {
    /* noop */
  }
  setInterval(send, 5000);

  /* ============================================================
   * Element Zapper & Full Page Screenshot Integration
   * ============================================================ */

  let lastRightClickTarget = null;
  let lastMouseX = window.innerWidth / 2;
  let lastMouseY = window.innerHeight / 2;

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

  function showToast(text) {
    let toast = document.getElementById('__sd_toast_notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = '__sd_toast_notification';
      toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);color:#f8fafc;padding:9px 18px;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:13px;font-weight:500;box-shadow:0 10px 25px -5px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.1);z-index:2147483647;pointer-events:none;transition:opacity 0.25s ease, transform 0.25s ease;opacity:0;';
      document.documentElement.appendChild(toast);
    }
    toast.textContent = text;
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
      const msg = isAd
        ? (chrome.i18n.getMessage('toastElementZappedAd') || 'Ad / iframe hidden for this session.')
        : (chrome.i18n.getMessage('toastElementZapped') || 'Element hidden for this session.');
      showToast(msg);
    } catch {
      showToast('Element hidden for this session.');
    }
    send();
    return true;
  }

  function undoZap() {
    if (zappedStack.length === 0) return;
    const item = zappedStack.pop();
    if (item && item.el) {
      item.el.style.display = item.prevDisplay || '';
      item.el.removeAttribute('data-sd-zapped');
      try {
        showToast(chrome.i18n.getMessage('toastElementRestored') || 'Element restored.');
      } catch {
        showToast('Element restored.');
      }
      send();
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
      showToast(chrome.i18n.getMessage('toastAllElementsRestored') || 'All hidden elements restored.');
    } catch {
      showToast('All hidden elements restored.');
    }
    send();
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

  async function buildSingleFileHtml() {
    const clone = document.documentElement.cloneNode(true);

    // Remove zapped elements
    clone.querySelectorAll('[data-sd-zapped]').forEach((el) => el.remove());

    // Remove extension toast if present
    const toast = clone.querySelector('#__sd_toast_notification');
    if (toast) toast.remove();

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

    // 1. Inline External Stylesheets
    const linkStyles = Array.from(clone.querySelectorAll('link[rel~="stylesheet"]'));
    for (const link of linkStyles) {
      const href = link.href;
      if (!href) continue;
      let inlined = false;
      try {
        const res = await fetch(href);
        if (res.ok) {
          let cssText = await res.text();
          const baseUrl = new URL(href, window.location.href);
          cssText = cssText.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, relUrl) => {
            const trimmed = relUrl.trim();
            if (trimmed.startsWith('data:') || trimmed.startsWith('#')) return match;
            try {
              const absUrl = new URL(trimmed, baseUrl).href;
              return `url("${absUrl}")`;
            } catch {
              return match;
            }
          });
          const styleEl = document.createElement('style');
          styleEl.setAttribute('data-sd-inlined', 'true');
          styleEl.textContent = cssText;
          link.parentNode.replaceChild(styleEl, link);
          inlined = true;
        }
      } catch { /* fetch failed */ }

      if (!inlined) {
        try {
          for (const sheet of document.styleSheets) {
            if (sheet.href === href && sheet.cssRules) {
              const cssText = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
              const styleEl = document.createElement('style');
              styleEl.setAttribute('data-sd-inlined', 'true');
              styleEl.textContent = cssText;
              link.parentNode.replaceChild(styleEl, link);
              break;
            }
          }
        } catch { /* cross-origin CSSOM protected */ }
      }
    }

    // 2. Inline Images as Base64 Data URIs (up to 60 images to prevent hangs)
    const images = Array.from(clone.querySelectorAll('img'));
    const imageLimit = Math.min(images.length, 60);
    for (let i = 0; i < imageLimit; i++) {
      const img = images[i];
      const src = img.getAttribute('src') || img.currentSrc;
      if (!src || src.startsWith('data:')) continue;
      try {
        const absSrc = new URL(src, window.location.href).href;
        const res = await fetch(absSrc);
        if (res.ok) {
          const blob = await res.blob();
          const dataUri = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          img.setAttribute('src', dataUri);
          img.removeAttribute('srcset');
        }
      } catch {
        try {
          img.setAttribute('src', new URL(src, window.location.href).href);
        } catch { /* noop */ }
      }
    }

    // 3. Ensure all reveal/animated elements are marked visible in live DOM and clone
    document.querySelectorAll('.reveal, [data-aos], .animate, .fade-in, [class*="reveal"]').forEach((el) => {
      el.classList.add('visible', 'aos-animate', 'revealed', 'active');
    });
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

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
    }, 200);
  }

  function resolveDict(langCode) {
    const i18n = (typeof window !== 'undefined' && window.SourceDownloadI18n) || (typeof globalScope !== 'undefined' && globalScope.SourceDownloadI18n);
    let resolved = 'en';
    if (langCode === 'auto' || !langCode) {
      const navLang = (navigator.language || 'en').toLowerCase().replace('-', '_');
      if (navLang.startsWith('tr')) resolved = 'tr';
      else if (navLang.startsWith('de')) resolved = 'de';
      else if (navLang.startsWith('es')) resolved = 'es';
      else if (navLang.startsWith('zh')) resolved = 'zh_CN';
      else if (navLang.startsWith('ja')) resolved = 'ja';
      else if (navLang.startsWith('ru')) resolved = 'ru';
    } else {
      const code = String(langCode).toLowerCase().replace('-', '_');
      if (code.startsWith('tr')) resolved = 'tr';
      else if (code.startsWith('de')) resolved = 'de';
      else if (code.startsWith('es')) resolved = 'es';
      else if (code.startsWith('zh')) resolved = 'zh_CN';
      else if (code.startsWith('ja')) resolved = 'ja';
      else if (code.startsWith('ru')) resolved = 'ru';
    }
    const dict = (i18n && i18n[resolved]) || (i18n && i18n['en']) || {};
    return { dict, lang: resolved };
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
    const labelDownload = dict.btnAreaDownload || (lang === 'tr' ? 'İndir' : 'Download');
    const labelCopy = dict.btnAreaCopy || (lang === 'tr' ? 'Panoya kopyala' : 'Copy to clipboard');
    const labelCancel = dict.btnAreaCancel || (lang === 'tr' ? 'İptal' : 'Cancel');
    const msgCopied = dict.toastAreaCopied || (lang === 'tr' ? 'Bölgesel ekran görüntüsü panoya kopyalandı' : 'Area screenshot copied to clipboard');
    const msgDownloaded = dict.toastAreaDownloaded || (lang === 'tr' ? 'Bölgesel ekran görüntüsü kaydedildi' : 'Area screenshot saved');
    const labelArrow = dict.toolArrow || (lang === 'tr' ? 'Ok çiz' : 'Arrow');
    const labelRect = dict.toolRect || (lang === 'tr' ? 'Kutucuk çiz' : 'Rectangle');
    const labelText = dict.toolText || (lang === 'tr' ? 'Yazı yaz' : 'Text');
    const labelUndo = dict.toolUndo || (lang === 'tr' ? 'Geri al' : 'Undo');
    const labelRedo = dict.toolRedo || (lang === 'tr' ? 'İleri al' : 'Redo');
    const labelColor = dict.toolColor || (lang === 'tr' ? 'Renk' : 'Color');

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
    bar.style.cssText = 'position:absolute;display:none;align-items:center;gap:6px;padding:6px 10px;background:rgba(26,27,34,0.96);border:1px solid rgba(255,255,255,0.18);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.6);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);z-index:2147483647;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12.5px;color:#fff;';

    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:3px;">
        <button type="button" id="__sd_tool_arrow" title="${labelArrow}" class="__sd_tb_tool" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;background:transparent;color:#e8eaf0;border:1px solid transparent;border-radius:6px;cursor:pointer;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"></line><polyline points="9 5 19 5 19 15"></polyline></svg>
        </button>
        <button type="button" id="__sd_tool_rect" title="${labelRect}" class="__sd_tb_tool" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;background:transparent;color:#e8eaf0;border:1px solid transparent;border-radius:6px;cursor:pointer;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>
        </button>
        <button type="button" id="__sd_tool_text" title="${labelText}" class="__sd_tb_tool" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;background:transparent;color:#e8eaf0;border:1px solid transparent;border-radius:6px;cursor:pointer;font-weight:700;font-size:14px;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
        </button>
      </div>

      <div style="position:relative;display:flex;align-items:center;margin:0 2px;">
        <button type="button" id="__sd_tool_color" title="${labelColor}" style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;background:transparent;border:2px solid #ffffff;border-radius:50%;cursor:pointer;box-shadow:0 0 4px rgba(0,0,0,0.5);">
          <span id="__sd_color_preview" style="width:14px;height:14px;border-radius:50%;background:#ff3b30;display:block;"></span>
        </button>
        <input type="color" id="__sd_color_input" value="#ff3b30" style="opacity:0;position:absolute;left:0;top:0;width:100%;height:100%;cursor:pointer;">
      </div>

      <div style="display:flex;align-items:center;gap:3px;">
        <button type="button" id="__sd_tool_undo" title="${labelUndo}" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;background:transparent;color:#9aa0ae;border:none;border-radius:6px;cursor:default;opacity:0.35;transition:all 0.15s;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
        </button>
        <button type="button" id="__sd_tool_redo" title="${labelRedo}" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;background:transparent;color:#9aa0ae;border:none;border-radius:6px;cursor:default;opacity:0.35;transition:all 0.15s;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path></svg>
        </button>
      </div>

      <div style="width:1px;height:18px;background:rgba(255,255,255,0.18);margin:0 3px;"></div>

      <button type="button" id="__sd_btn_download" style="display:flex;align-items:center;gap:5px;padding:6px 12px;background:#4f8cff;color:#fff;border:none;border-radius:6px;font-weight:600;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>${labelDownload}</span>
      </button>
      <button type="button" id="__sd_btn_copy" style="display:flex;align-items:center;gap:5px;padding:6px 12px;background:#2d313d;color:#e8eaf0;border:1px solid rgba(255,255,255,0.15);border-radius:6px;font-weight:500;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span>${labelCopy}</span>
      </button>
      <button type="button" id="__sd_btn_cancel" title="${labelCancel}" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;background:transparent;color:#9aa0ae;border:none;border-radius:6px;cursor:pointer;font-size:15px;line-height:1;transition:color 0.15s;">
        ✕
      </button>
    `;
    overlay.appendChild(bar);

    // Dimension badge
    const badge = document.createElement('div');
    badge.id = '__sd_area_badge';
    badge.style.cssText = 'position:absolute;display:none;padding:3px 8px;background:rgba(0,0,0,0.82);color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,monospace;font-size:11.5px;font-weight:600;border-radius:4px;pointer-events:none;z-index:2147483647;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.12);';
    overlay.appendChild(badge);

    // Floating wheel tooltip badge
    const wheelBadge = document.createElement('div');
    wheelBadge.id = '__sd_wheel_badge';
    wheelBadge.style.cssText = 'position:absolute;display:none;padding:4px 8px;background:rgba(0,0,0,0.85);color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:11px;font-weight:600;border-radius:4px;pointer-events:none;z-index:2147483647;box-shadow:0 3px 10px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);white-space:nowrap;';
    overlay.appendChild(wheelBadge);

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
        ctx.strokeStyle = '#4f8cff';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 4;
        ctx.strokeRect(x, y, w, h);
        ctx.shadowColor = 'transparent';

        // 3. 8 Grab handles (Lightshot style)
        const hs = 7;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4f8cff';
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
        btnArrow.style.background = activeTool === 'arrow' ? '#4f8cff' : 'transparent';
        btnArrow.style.color = activeTool === 'arrow' ? '#ffffff' : '#e8eaf0';
        btnRect.style.background = activeTool === 'rect' ? '#4f8cff' : 'transparent';
        btnRect.style.color = activeTool === 'rect' ? '#ffffff' : '#e8eaf0';
        btnText.style.background = activeTool === 'text' ? '#4f8cff' : 'transparent';
        btnText.style.color = activeTool === 'text' ? '#ffffff' : '#e8eaf0';

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
            const textMsg = (dict.badgeFontSize || 'Font: $SIZE$px').replace('$SIZE$', currentFontSize);
            showWheelBadge(textMsg, e.clientX, e.clientY);
            if (activeTextarea) {
              activeTextarea.el.style.fontSize = `${currentFontSize}px`;
              activeTextarea.fontSize = currentFontSize;
            }
          } else {
            const delta = e.deltaY < 0 ? 1 : -1;
            currentStrokeWidth = Math.max(1, Math.min(32, currentStrokeWidth + delta));
            const strokeMsg = (dict.badgeStrokeSize || 'Stroke: $SIZE$px').replace('$SIZE$', currentStrokeWidth);
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
        mode = 'NONE';
        if (curRect && curRect.w > 10 && curRect.h > 10) {
          positionToolbar(curRect);
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

      // Button: Copy to clipboard
      const btnCopy = overlay.querySelector('#__sd_btn_copy');
      btnCopy.addEventListener('click', async () => {
        const off = getCroppedCanvas();
        if (!off) return;
        off.toBlob(async (blob) => {
          if (!blob) return;
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            cleanUp();
            showToast(msgCopied);
          } catch (err) {
            console.warn('Direct clipboard.write failed, falling back:', err);
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            triggerDownload(off.toDataURL('image/png'), `screenshot-area-${ts}.png`);
            cleanUp();
            showToast(msgDownloaded);
          }
        }, 'image/png');
      });

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
   * Regional Screen Video Recording (startAreaVideoRecord)
   * Screen is 100% natural and bright (no dark overlay masks).
   * Box is smoothly movable via drag header, resizable via 8 handles.
   * Full page interaction (scroll, click, type) is preserved.
   * Once recording starts, box clicks pass through directly to page.
   * Smartly docked/positioned recording toolbar.
   * ============================================================ */
  function startAreaVideoRecord(langCode) {
    const existingRec = document.getElementById('__sd_video_rec_overlay');
    if (existingRec) existingRec.remove();
    const existingArea = document.getElementById('__sd_area_overlay');
    if (existingArea) existingArea.remove();

    // 1. Resolve i18n
    const { dict, lang } = resolveDict(langCode);
    const labelStart = dict.btnRecStart || (lang === 'tr' ? 'Kaydı Başlat' : 'Start Recording');
    const labelPause = dict.btnRecPause || (lang === 'tr' ? 'Durdur' : 'Pause');
    const labelResume = dict.btnRecResume || (lang === 'tr' ? 'Devam Ettir' : 'Resume');
    const labelStop = dict.btnRecStop || (lang === 'tr' ? 'Kaydı İndir' : 'Finish & Download');
    const labelCancel = dict.btnRecCancel || (lang === 'tr' ? 'İptal' : 'Cancel');
    const msgSaved = dict.toastRecSaved || (lang === 'tr' ? 'Bölgesel ekran videosu indirildi' : 'Regional video recording saved');
    const msgCancelled = dict.toastRecCancelled || (lang === 'tr' ? 'Kayıt iptal edildi' : 'Recording cancelled');
    const msgPermissionDenied = dict.toastRecPermissionDenied || (lang === 'tr' ? 'Ekran kaydı izni verilmedi' : 'Screen recording permission denied');

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
    dragHeader.style.cssText = 'position:absolute;top:-28px;left:0;right:0;height:26px;background:rgba(26,27,34,0.94);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:space-between;padding:0 10px;cursor:move;user-select:none;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:11.5px;font-weight:600;color:#fff;border-radius:5px 5px 0 0;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.18);border-bottom:none;';
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
    bar.style.cssText = 'position:absolute;display:flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(26,27,34,0.96);border:1px solid rgba(255,255,255,0.18);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.6);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);z-index:2147483647;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12.5px;color:#fff;user-select:none;';

    bar.innerHTML = `
      <div id="__sd_rec_bar_drag" title="Drag toolbar" style="cursor:move;padding:2px 4px;color:#9aa0ae;display:flex;align-items:center;">
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
      <button type="button" id="__sd_rec_btn_pause" style="display:none;align-items:center;gap:6px;padding:6px 12px;background:#2d313d;color:#e8eaf0;border:1px solid rgba(255,255,255,0.15);border-radius:6px;font-weight:600;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        <span>${labelPause}</span>
      </button>
      <button type="button" id="__sd_rec_btn_resume" style="display:none;align-items:center;gap:6px;padding:6px 12px;background:#2d313d;color:#e8eaf0;border:1px solid rgba(255,255,255,0.15);border-radius:6px;font-weight:600;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>${labelResume}</span>
      </button>
      <button type="button" id="__sd_rec_btn_stop" style="display:none;align-items:center;gap:6px;padding:6px 14px;background:#34c759;color:#fff;border:none;border-radius:6px;font-weight:600;font-size:12.5px;cursor:pointer;line-height:1.2;transition:background 0.15s;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        <span>${labelStop}</span>
      </button>
      <button type="button" id="__sd_rec_btn_format" title="Toggle format: MP4 / GIF / WebM" style="display:flex;align-items:center;padding:4px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:5px;color:#93c5fd;font-weight:700;font-size:11.5px;cursor:pointer;line-height:1;transition:all 0.15s;">
        <span id="__sd_rec_format_text">MP4</span>
      </button>
      <button type="button" id="__sd_rec_btn_res" title="GIF Resolution: 1:1 / 1080p / 720p / 480p" style="display:none;align-items:center;padding:4px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:5px;color:#a7f3d0;font-weight:700;font-size:11.5px;cursor:pointer;line-height:1;transition:all 0.15s;">
        <span id="__sd_rec_res_text">1:1</span>
      </button>
      <button type="button" id="__sd_rec_btn_fps" title="GIF Frame Rate: 15 / 10 / 5 / 2 / 1 FPS" style="display:none;align-items:center;padding:4px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:5px;color:#fcd34d;font-weight:700;font-size:11.5px;cursor:pointer;line-height:1;transition:all 0.15s;">
        <span id="__sd_rec_fps_text">10 FPS</span>
      </button>
      <span id="__sd_rec_gif_estimate" style="display:none;align-items:center;padding:3px 7px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);border-radius:5px;color:#e2e8f0;font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:help;">
        <span id="__sd_rec_estimate_text">~12 MB (Maks 1 dk)</span>
      </span>
      <button type="button" id="__sd_rec_btn_cancel" title="${labelCancel}" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;background:transparent;color:#9aa0ae;border:none;border-radius:6px;cursor:pointer;font-size:15px;line-height:1;transition:color 0.15s;">
        ✕
      </button>
    `;
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
    let selectedGifResolution = 'original'; // 'original' (1:1) | '1080p' | '720p' | '480p'
    let selectedGifFps = 10; // 15 | 10 | 5 | 2 | 1 FPS
    let gifDelayCentisec = 10;
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

      let maxDim = 3840; // 4K UHD safety ceiling for original
      if (selectedGifResolution === '1080p') maxDim = 1920;
      else if (selectedGifResolution === '720p') maxDim = 1280;
      else if (selectedGifResolution === '480p') maxDim = 854;

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

      const labelMax1Min = dict.labelGifMaxDuration || (lang === 'tr' ? 'Maks 1 dk (60 sn)' : 'Max 1 min (60s)');
      estimateTextEl.textContent = `~${mb10s} MB/10s (${labelMax1Min})`;
      gifEstimateEl.title = lang === 'tr'
        ? `Tahmini GIF boyutu: ~${mb10s} MB (10 sn için), maksimum 60 sn için ~${maxMb} MB.\nSeçilen Kare Hızı: ${fps} FPS.\nGIF kayıt süresi en fazla 1 dakika (60 sn) ile sınırlıdır.`
        : `Estimated GIF size: ~${mb10s} MB (for 10s), up to ~${maxMb} MB for max 60s.\nFrame rate: ${fps} FPS.\nGIF recording duration is limited to a maximum of 1 minute (60s).`;
    }

    function updateResDisplay() {
      if (!resText) return;
      if (selectedGifResolution === 'original') resText.textContent = '1:1';
      else if (selectedGifResolution === '1080p') resText.textContent = '1080p';
      else if (selectedGifResolution === '720p') resText.textContent = '720p';
      else if (selectedGifResolution === '480p') resText.textContent = '480p';
      else resText.textContent = '1:1';
      updateGifEstimate();
    }

    function updateFpsDisplay() {
      if (!fpsText) return;
      fpsText.textContent = `${selectedGifFps} FPS`;
      if (btnFps) {
        if (selectedGifFps === 2) {
          btnFps.title = dict.optGifFps2 || (lang === 'tr' ? '2 FPS: Stop-Motion / Yavaş ("Tık-tık" adım adım, minik boyut)' : '2 FPS: Stop-Motion / Slow ("Click-click" step-by-step, tiny size)');
        } else if (selectedGifFps === 1) {
          btnFps.title = dict.optGifFps1 || (lang === 'tr' ? '1 FPS: Sunum / Slayt (Saniyede 1 kare, minimum boyut)' : '1 FPS: Presentation (1 frame per sec, minimal size)');
        } else if (selectedGifFps === 5) {
          btnFps.title = dict.optGifFps5 || (lang === 'tr' ? '5 FPS: Kompakt / Meme (Hafif kademeli, küçük boyut)' : '5 FPS: Compact / Meme (Stepped motion, small size)');
        } else if (selectedGifFps === 15) {
          btnFps.title = dict.optGifFps15 || (lang === 'tr' ? '15 FPS: Akıcı (Yüksek akıcılık, büyük dosya)' : '15 FPS: Smooth (High fluidity, larger size)');
        } else {
          btnFps.title = dict.optGifFps10 || (lang === 'tr' ? '10 FPS: Standart (Web için önerilen dengeli hız)' : '10 FPS: Standard (Recommended for web & balance)');
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
      if (data && data.gifResolution) {
        selectedGifResolution = data.gifResolution;
      }
      if (data && data.gifFps) {
        selectedGifFps = parseInt(data.gifFps, 10) || 10;
      }
      updateResDisplay();
      updateFpsDisplay();
      updateResVisibility();
    });

    if (btnFormat) {
      btnFormat.title = 'Toggle format: MP4 / GIF / WebM';
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
        if (selectedGifResolution === 'original') {
          selectedGifResolution = '1080p';
        } else if (selectedGifResolution === '1080p') {
          selectedGifResolution = '720p';
        } else if (selectedGifResolution === '720p') {
          selectedGifResolution = '480p';
        } else {
          selectedGifResolution = 'original';
        }
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
          selectedGifFps = 2; // "Tık-tık" stop-motion / slide-show
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
    let gifFrames = [];
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
          surfaceSwitching: 'include',
          systemAudio: 'include',
          video: {
            displaySurface: 'browser'
          },
          audio: true
        };
        activeStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
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
        showToast(msgPermissionDenied);
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
            showToast(dict.msgGifMaxDurationReached || (lang === 'tr' ? 'Maksimum GIF süresi olan 1 dakikaya (60 sn) ulaşıldı. GIF oluşturuluyor...' : 'Maximum GIF duration of 1 minute (60s) reached. Generating GIF...'));
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
      if (selectedFormat === 'gif') {
        let maxDim = 3840; // 4K UHD ceiling for original
        if (selectedGifResolution === '1080p') maxDim = 1920;
        else if (selectedGifResolution === '720p') maxDim = 1280;
        else if (selectedGifResolution === '480p') maxDim = 854;

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

        const gifSampleCanvas = document.createElement('canvas');
        gifSampleCanvas.width = gifWidth;
        gifSampleCanvas.height = gifHeight;
        const gifSampleCtx = gifSampleCanvas.getContext('2d', { willReadFrequently: true });

        // Capture frames at selected fps (every intervalMs), up to maxFrames (60s max)
        gifInterval = setInterval(() => {
          if (!isPaused && isRecording && video.readyState >= 2) {
            gifSampleCtx.drawImage(cropCanvas, 0, 0, gifWidth, gifHeight);
            const imgData = gifSampleCtx.getImageData(0, 0, gifWidth, gifHeight);
            gifFrames.push(imgData);
            if (gifFrames.length >= maxFrames) {
              showToast(dict.msgGifMaxDurationReached || (lang === 'tr' ? 'Maksimum GIF süresi olan 1 dakikaya (60 sn) ulaşıldı. GIF oluşturuluyor...' : 'Maximum GIF duration of 1 minute (60s) reached. Generating GIF...'));
              stopRecording(false);
            }
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
        btnStop.innerHTML = `<span>${dict.toastRecGeneratingGif || (lang === 'tr' ? 'GIF oluşturuluyor...' : 'Generating GIF...')}</span>`;
        showToast(dict.toastRecGeneratingGif || (lang === 'tr' ? 'GIF oluşturuluyor, lütfen bekleyin...' : 'Generating GIF, please wait...'));

        if (gifFrames.length === 0 && cropCanvas) {
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = gifWidth;
          fallbackCanvas.height = gifHeight;
          const fbCtx = fallbackCanvas.getContext('2d');
          fbCtx.drawImage(cropCanvas, 0, 0, gifWidth, gifHeight);
          gifFrames.push(fbCtx.getImageData(0, 0, gifWidth, gifHeight));
        }

        // Allow browser to render progress toast before heavy encoding
        await new Promise((r) => setTimeout(r, 50));

        const gifHelper = (typeof SourceDownloadGif !== 'undefined') ? SourceDownloadGif : (typeof window !== 'undefined' && window.SourceDownloadGif);
        if (gifHelper && typeof gifHelper.createAnimatedGifBlob === 'function' && gifFrames.length > 0) {
          try {
            const blob = await gifHelper.createAnimatedGifBlob(gifFrames, gifWidth, gifHeight, gifDelayCentisec, (cur, tot) => {
              const pct = Math.round((cur / tot) * 100);
              btnStop.innerHTML = `<span>GIF: ${pct}%</span>`;
            });
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
      showToast(lang === 'tr' ? 'Tarayıcınız renk damlalığı özelliğini desteklemiyor.' : 'EyeDropper API is not supported in this browser.');
      return;
    }

    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      if (!result || !result.sRGBHex) return;

      showColorInspector(result.sRGBHex, langCode);
    } catch (err) {
      if (err && (err.name === 'AbortError' || String(err).includes('AbortError'))) {
        return; // User pressed ESC to cancel eye dropper
      }
      console.warn('Color picker failed:', err);
    }
  }

  function showColorInspector(hexInput, langCode) {
    const existing = document.getElementById('__sd_color_inspector');
    if (existing) existing.remove();

    const { dict, lang } = resolveDict(langCode);
    const labelTitle = dict.colorPickerTitle || (lang === 'tr' ? 'Renk Seçici' : 'Color Picker');
    const labelPickAgain = dict.btnColorPickAgain || (lang === 'tr' ? 'Yeniden Seç' : 'Pick Again');
    const msgCopied = dict.toastColorCopied || (lang === 'tr' ? 'Renk panoya kopyalandı' : 'Color copied to clipboard');

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
    inspector.style.cssText = 'position:fixed;top:24px;right:24px;width:340px;background:rgba(26,27,34,0.96);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,0.18);border-radius:12px;box-shadow:0 18px 45px rgba(0,0,0,0.65);z-index:2147483647;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;overflow:hidden;box-sizing:border-box;user-select:none;';

    // Header with drag capability
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.1);cursor:move;';
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4f8cff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>
        <span>${labelTitle}</span>
      </div>
      <button type="button" id="__sd_ci_close" style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;background:transparent;border:none;color:#9aa0ae;cursor:pointer;border-radius:4px;font-size:16px;line-height:1;transition:color 0.15s;">✕</button>
    `;
    inspector.appendChild(header);

    // Hero Swatch & Hex
    const hero = document.createElement('div');
    hero.style.cssText = 'padding:14px 14px 10px;display:flex;align-items:center;gap:14px;';
    hero.innerHTML = `
      <div style="width:52px;height:52px;border-radius:10px;background:${hex};border:2px solid rgba(255,255,255,0.3);box-shadow:0 4px 14px rgba(0,0,0,0.4);flex-shrink:0;"></div>
      <div style="display:flex;flex-direction:column;gap:3px;overflow:hidden;">
        <span style="font-size:18px;font-weight:700;font-family:monospace;letter-spacing:0.5px;color:#fff;">${hex}</span>
        <span style="font-size:12px;color:#9aa0ae;font-family:monospace;">${rgb}</span>
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
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;gap:8px;';

      row.innerHTML = `
        <span style="width:46px;font-size:11px;font-weight:700;color:#9aa0ae;letter-spacing:0.3px;flex-shrink:0;">${fmt.name}</span>
        <span style="flex:1;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;color:#e8eaf0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${fmt.val}">${fmt.val}</span>
        <button type="button" class="__sd_ci_copy" title="Copy ${fmt.name}" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:5px;color:#e8eaf0;cursor:pointer;flex-shrink:0;transition:all 0.15s;">
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
          btnCopy.style.borderColor = 'rgba(255,255,255,0.12)';
        }, 1200);
      });

      rowsCont.appendChild(row);
    });
    inspector.appendChild(rowsCont);

    // Footer actions
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:10px 14px;background:rgba(0,0,0,0.25);border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;gap:8px;';
    footer.innerHTML = `
      <button type="button" id="__sd_ci_again" style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:#4f8cff;border:none;border-radius:6px;color:#fff;font-weight:600;font-size:12px;cursor:pointer;transition:background 0.15s;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>
        <span>${labelPickAgain}</span>
      </button>
      <button type="button" id="__sd_ci_dismiss" style="padding:6px 12px;background:transparent;border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#9aa0ae;font-size:12px;cursor:pointer;transition:color 0.15s;">
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
    let el = document.getElementById('__sd_fps_progress');
    const { dict, lang } = resolveDict(langCode);
    let msgTemplate = dict.toastProgressCapturing || (lang === 'tr' ? 'Tam sayfa yakalanıyor... %$PERCENT$ ($CURRENT$/$TOTAL$)' : 'Capturing full page... $PERCENT$% ($CURRENT$/$TOTAL$)');
    let text = msgTemplate
      .replace(/\$PERCENT\$/gi, String(percent))
      .replace(/\$CURRENT\$/gi, String(current))
      .replace(/\$TOTAL\$/gi, String(total));
    if (!msgTemplate.includes('$CURRENT$')) {
      text = text.trim() + ` (${current}/${total})`;
    }

    if (!el) {
      el = document.createElement('div');
      el.id = '__sd_fps_progress';
      el.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(26,27,34,0.95);color:#fff;padding:10px 22px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13px;font-weight:600;box-shadow:0 12px 36px rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.18);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;gap:14px;pointer-events:none;transition:all 0.2s ease;';
      document.body.appendChild(el);
    }
    el.style.setProperty('display', 'flex', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.innerHTML = `
      <div style="width:16px;height:16px;border:2.5px solid rgba(255,255,255,0.2);border-top-color:#4f8cff;border-radius:50%;animation:__sd_spin 0.8s linear infinite;flex-shrink:0;"></div>
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
    const text = dict.toastProgressStitching || (lang === 'tr' ? 'Görüntü birleştiriliyor...' : 'Stitching image...');
    if (el) {
      el.style.setProperty('display', 'flex', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.innerHTML = `
        <div style="width:16px;height:16px;border:2.5px solid rgba(255,255,255,0.2);border-top-color:#34c759;border-radius:50%;animation:__sd_spin 0.8s linear infinite;flex-shrink:0;"></div>
        <span style="letter-spacing:0.3px;">${text}</span>
      `;
    }
  }

  function hideFullPageProgress() {
    const el = document.getElementById('__sd_fps_progress');
    if (el) el.remove();
  }

  function showFullPageExportModal(params) {
    hideFullPageProgress();
    const existing = document.getElementById('__sd_fps_export_modal');
    if (existing) existing.remove();

    const { dataUrl, width, height, domain, title, baseFilename, lang: langCode } = params;
    const { dict, lang } = resolveDict(langCode);

    const titleText = dict.modalExportTitle || (lang === 'tr' ? 'Tam Sayfa Ekran Görüntüsü Hazır' : 'Full Page Screenshot Ready');
    const labelPng = dict.btnExportPng || (lang === 'tr' ? 'PNG İndir' : 'Download PNG');
    const labelJpg = dict.btnExportJpg || (lang === 'tr' ? 'JPG İndir' : 'Download JPG');
    const labelPdf = dict.btnExportPdf || (lang === 'tr' ? 'PDF Olarak Kaydet' : 'Save as PDF');
    const labelCopy = dict.btnExportCopy || (lang === 'tr' ? 'Panoya Kopyala' : 'Copy to Clipboard');
    const labelGenerating = dict.btnExportGenerating || (lang === 'tr' ? 'Oluşturuluyor...' : 'Generating...');
    const msgPdfSaved = dict.toastPdfGenerated || (lang === 'tr' ? 'PDF belgesi kaydedildi.' : 'PDF document saved.');
    const msgCopied = dict.toastImageCopied || (lang === 'tr' ? 'Görüntü panoya kopyalandı' : 'Image copied to clipboard');
    const msgDownloaded = dict.toastAreaDownloaded || (lang === 'tr' ? 'Ekran görüntüsü indirildi' : 'Screenshot downloaded');
    const labelClose = dict.guideClose || (lang === 'tr' ? 'Kapat (Esc)' : 'Close (Esc)');

    const backdrop = document.createElement('div');
    backdrop.id = '__sd_fps_export_modal';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.68);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;user-select:none;padding:16px;box-sizing:border-box;';

    const modal = document.createElement('div');
    modal.style.cssText = 'width:520px;max-width:94vw;max-height:92vh;background:rgba(26,27,34,0.98);border:1px solid rgba(255,255,255,0.18);border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,0.85);display:flex;flex-direction:column;overflow:hidden;color:#fff;box-sizing:border-box;animation:__sd_pop 0.18s ease-out;';

    if (!document.getElementById('__sd_pop_style')) {
      const style = document.createElement('style');
      style.id = '__sd_pop_style';
      style.textContent = '@keyframes __sd_pop { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }';
      document.head.appendChild(style);
    }

    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex;align-items:center;gap:9px;font-weight:600;font-size:14px;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4f8cff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span>${titleText}</span>
        </div>
        <button type="button" id="__sd_modal_close" title="${labelClose}" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:transparent;border:none;color:#9aa0ae;cursor:pointer;border-radius:6px;font-size:17px;line-height:1;transition:color 0.15s;">✕</button>
      </div>

      <div style="padding:16px 18px 12px;display:flex;flex-direction:column;gap:12px;background:rgba(0,0,0,0.25);">
        <div style="width:100%;height:200px;background:#0d0e12;border:1px solid rgba(255,255,255,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:inset 0 2px 8px rgba(0,0,0,0.5);">
          <img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;" alt="Screenshot preview">
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#9aa0ae;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;">
          <span>${width} × ${height} px</span>
          <span style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${title || domain}">${title || domain}</span>
        </div>
      </div>

      <div style="padding:16px 18px 20px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button type="button" id="__sd_btn_png" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;background:#4f8cff;border:none;border-radius:8px;color:#fff;font-weight:600;font-size:13px;cursor:pointer;transition:background 0.15s;box-shadow:0 2px 8px rgba(79,140,255,0.35);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span>${labelPng}</span>
        </button>
        <button type="button" id="__sd_btn_jpg" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;background:#2d313d;border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#e8eaf0;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>${labelJpg}</span>
        </button>
        <button type="button" id="__sd_btn_pdf" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;background:#2d313d;border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#e8eaf0;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>${labelPdf}</span>
        </button>
        <button type="button" id="__sd_btn_copy" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;background:#2d313d;border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#e8eaf0;font-weight:600;font-size:13px;cursor:pointer;transition:all 0.15s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>${labelCopy}</span>
        </button>
      </div>
    `;

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
