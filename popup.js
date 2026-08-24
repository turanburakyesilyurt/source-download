/* Source Download — toolbar popup.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
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

function allEnabled() {
  return CATS.every((c) => !!state.tracking[c.key]);
}

function sendTracking() {
  chrome.runtime.sendMessage({ type: 'setTracking', tracking: state.tracking }, () => {
    chrome.runtime.sendMessage({ type: 'getState' }, (res) => {
      if (res) {
        state.badgeCount = res.badgeCount || 0;
        updateBadgePreview();
      }
    });
  });
}

function renderList() {
  const list = document.getElementById('tracking-list');
  list.innerHTML = '';

  // Master toggle: on = track every category, off = none.
  const master = document.createElement('div');
  master.className = 'tracking-row tracking-row--master';
  const masterLabel = document.createElement('span');
  masterLabel.className = 'tracking-row__label';
  masterLabel.textContent = 'Track all categories';
  const masterCount = document.createElement('span');
  masterCount.className = 'tracking-row__count';
  masterCount.textContent = state.counts.all || 0;
  const masterToggle = document.createElement('button');
  masterToggle.type = 'button';
  masterToggle.className = 'toggle' + (allEnabled() ? ' toggle--on' : '');
  masterToggle.setAttribute('role', 'switch');
  masterToggle.setAttribute('aria-checked', String(allEnabled()));
  masterToggle.setAttribute('aria-label', 'Track all categories');
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
    label.textContent = c.label;
    const count = document.createElement('span');
    count.className = 'tracking-row__count';
    count.textContent = state.counts[c.key] || 0;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toggle' + (state.tracking[c.key] ? ' toggle--on' : '');
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', String(!!state.tracking[c.key]));
    toggle.setAttribute('aria-label', 'Track ' + c.label);
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
  const n = state.badgeCount;
  el.hidden = n === 0;
  if (n) el.textContent = n > 9999 ? Math.round(n / 1000) + 'K' : String(n);
}

let refreshTimer = null;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'resourceCounts') {
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      chrome.runtime.sendMessage({ type: 'getState' }, (res) => {
        if (res) {
          state.counts = res.counts || {};
          state.badgeCount = res.badgeCount || 0;
          updateCounts();
        }
      });
    }, 400);
  }
});

chrome.runtime.sendMessage({ type: 'getState' }, (res) => {
  if (res) {
    state.tracking = res.tracking || {};
    state.counts = res.counts || {};
    state.badgeCount = res.badgeCount || 0;
    renderList();
  }
});
