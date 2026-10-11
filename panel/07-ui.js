/* Source Download — DevTools panel (7/8).
 * Context menu and feedback UI (toast, progress, status).
 */

'use strict';

/* ============================================================
 * 10. Context menu
 * ============================================================ */

function openContextMenu(e, res) {
  e.preventDefault();
  e.stopPropagation();
  closeExportMenu();
  closeLangMenu();
  closeContextMenu();

  const menu = document.createElement('div');
  menu.id = 'context-menu';
  menu.className = 'context-menu';
  const existing = document.getElementById('context-menu');
  if (existing) existing.remove();
  document.body.appendChild(menu);

  const items = [
    { label: t('inspectorDownloadFile', 'Download'), icon: ICONS.download, action: () => downloadSingle(res) },
    { label: t('inspectorOpenTab', 'Open in new tab'), icon: ICONS.open, action: () => openResourceTab(res) },
    {
      label: t('inspectorCopyUrl', 'Copy URL'),
      icon: ICONS.copy,
      action: () => {
        copyText(res.url);
        toast(t('toastUrlCopied', 'URL copied to clipboard'), 'success');
      },
    },
  ];
  if (state.failed.has(res.id)) {
    items.splice(1, 0, {
      label: t('contextMenuRetryDownload', 'Retry download'),
      icon: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8A5.5 5.5 0 1 1 11 3.7"/><path d="M13.5 2v2.5H11"/></svg>',
      action: () => downloadSingle(res),
    });
  }
  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = 'context-menu__item';
    btn.innerHTML = item.icon + '<span>' + item.label + '</span>';
    btn.addEventListener('click', () => {
      closeContextMenu();
      item.action();
    });
    menu.appendChild(btn);
  }

  const x = Math.min(e.clientX, window.innerWidth - 200);
  const y = Math.min(e.clientY, window.innerHeight - items.length * 40 - 24);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.hidden = false;
}

function closeContextMenu() {
  document.getElementById('context-menu').hidden = true;
  closeExportMenu();
}

function openResourceTab(res) {
  chrome.tabs.create({ url: res.url }, () => {
    if (chrome.runtime.lastError) window.open(res.url, '_blank');
  });
}

/* ============================================================
 * 11. Feedback UI (toast, progress, status message)
 * ============================================================ */

let toastTimer = null;
function toast(message, type, action) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.innerHTML = '';
  const span = document.createElement('span');
  span.className = 'toast__msg';
  span.textContent = message;
  el.appendChild(span);
  if (action && action.label) {
    const btn = document.createElement('button');
    btn.className = 'toast__action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      el.hidden = true;
      clearTimeout(toastTimer);
      action.fn();
    });
    el.appendChild(btn);
  }
  el.className = 'toast' + (type ? ' toast--' + type : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 6500);
}

function showProgress(label) {
  document.getElementById('progress-wrap').hidden = false;
  updateProgress(0, label);
}

function updateProgress(fraction, label) {
  const fill = document.getElementById('progress-fill');
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  fill.style.width = pct + '%';
  const bar = document.getElementById('progress-bar');
  if (bar) bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  document.getElementById('progress-label').textContent = label;
}

function hideProgress() {
  document.getElementById('progress-wrap').hidden = true;
}

function setStatusMessage(msg) {
  document.getElementById('status-message').textContent = msg || '';
}

/* ============================================================
 * 11b. Toolbar dropdown menus (Download options, More)
 * ============================================================ */

const MENUS = { 'download-menu': 'btn-download-caret', 'more-menu': 'btn-more' };

function closeMenus(except) {
  for (const [menuId, btnId] of Object.entries(MENUS)) {
    if (menuId === except) continue;
    const menu = document.getElementById(menuId);
    if (menu) menu.hidden = true;
    const btn = document.getElementById(btnId);
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

function toggleMenu(menuId) {
  const menu = document.getElementById(menuId);
  const btn = document.getElementById(MENUS[menuId]);
  if (!menu || !btn) return;
  const open = menu.hidden;
  closeMenus(menuId);
  closeExportMenu();
  closeLangMenu();
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  if (open) {
    const first = menu.querySelector('.menu__item:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }
}

function setupMenus() {
  for (const [menuId, btnId] of Object.entries(MENUS)) {
    document.getElementById(btnId).addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(menuId);
    });
    // Picking an item closes the menu (sub-menus re-open anchored to the button).
    document.getElementById(menuId).addEventListener('click', (e) => {
      if (e.target.closest('.menu__item')) closeMenus();
    });
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu, [aria-haspopup="menu"]')) closeMenus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = Object.keys(MENUS).find((id) => !document.getElementById(id).hidden);
    if (open) {
      closeMenus();
      document.getElementById(MENUS[open]).focus();
    }
  });
  // Arrow keys move between items inside an open menu.
  for (const menuId of Object.keys(MENUS)) {
    document.getElementById(menuId).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [...e.currentTarget.querySelectorAll('.menu__item:not([disabled])')];
      const i = items.indexOf(document.activeElement);
      const next = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
      if (next) next.focus();
    });
  }
  // The main button runs the most useful download for the current view.
  document.getElementById('btn-download-main').addEventListener('click', () => {
    const target = downloadMainTarget();
    document.getElementById(target).click();
  });
  try {
    document.getElementById('menu-version').textContent = 'v' + chrome.runtime.getManifest().version;
  } catch { /* noop */ }
}

// Selected items first, then the current view (category / search / filters),
// otherwise everything.
function downloadMainTarget() {
  if (state.selected.size) return 'btn-download-selected';
  if (state.activeTab === 'text') return 'btn-download-all';
  if (hasActiveFilters() || filteredResources().length < state.resources.length) return 'btn-download-view';
  return 'btn-download-all';
}
