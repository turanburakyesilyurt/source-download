/* Source Download — DevTools panel (3/8).
 * Text & table capture (live page content) and its exports.
 */

'use strict';

/* ============================================================
 * 5. Rendering
 * ============================================================ */

/* ============================================================
 * 5b. Text & table capture (live page content)
 *
 * The "Text" category is not a resource list: it captures the live page's
 * headings, paragraphs, custom-selector matches and tables. Tables keep a
 * bounded snapshot history so a SPA that re-renders the same table every few
 * seconds can be exported without losing any intermediate state. Capture only
 * runs while the Text tab is open, polling the inspected page ~every 1.5s.
 * ============================================================ */

let textPollTimer = null;
let textIdCounter = 0;
let textPolling = false;

function nextTextId() {
  return 'tx' + (++textIdCounter);
}

function evalText(expr) {
  return new Promise((resolve) => {
    try {
      chrome.devtools.inspectedWindow.eval(expr, {}, (result, info) => {
        if (info && info.isException) resolve(null);
        else resolve(result);
      });
    } catch {
      resolve(null);
    }
  });
}

/*
 * Builds the expression evaluated inside the inspected page.
 *
 * Default mode walks the whole document in DOM order and returns every element
 * that carries its own text, tagged with its element name, so the panel can
 * present a readable version of the page and let the user narrow it down
 * afterwards. Nested duplicates are skipped: once a parent holds text, its
 * children are rejected.
 *
 * `css` and `xpath` modes resolve the query against the live page instead and
 * return only what matched, together with any error the page reported so the
 * panel can show it verbatim.
 */
function textCaptureExpr(mode, query) {
  return '(function () {' +
    'var out = [];' +
    'var err = "";' +
    'var MODE = ' + JSON.stringify(mode) + ';' +
    'var Q = ' + JSON.stringify(query) + ';' +
    'function hasDirectText(el) {' +
    '  for (var i = 0; i < el.childNodes.length; i++) {' +
    '    if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent.trim()) return true;' +
    '  }' +
    '  return false;' +
    '}' +
    'function isTable(el) {' +
    '  return el.tagName === "TABLE" || (el.getAttribute && el.getAttribute("role") === "table");' +
    '}' +
    'function sigFor(rows) {' +
    '  return JSON.stringify(rows[0] || []) + "|" + Math.max.apply(null, rows.map(function (r) { return r.length; }).concat(0));' +
    '}' +
    'function cellsOf(tr) {' +
    '  var cells = [];' +
    '  tr.querySelectorAll("th, td, [role=cell], [role=columnheader], [role=rowheader]").forEach(function (td) {' +
    '    var t = (td.innerText || "").trim();' +
    '    if (t.length > 300) t = t.slice(0, 300) + "\\u2026";' +
    '    cells.push(t);' +
    '  });' +
    '  return cells;' +
    '}' +
    // A short "where did this come from" hint shown next to each block.
    'function whereOf(el) {' +
    '  var s = el.tagName ? el.tagName.toLowerCase() : "";' +
    '  if (el.id) s += "#" + el.id;' +
    '  else if (el.classList && el.classList.length) s += "." + Array.prototype.slice.call(el.classList, 0, 2).join(".");' +
    '  return s.slice(0, 80);' +
    '}' +
    'function captureTable(el) {' +
    '  var trs = el.querySelectorAll("tr, [role=row]");' +
    '  var preview = [];' +
    '  for (var j = 0; j < Math.min(trs.length, 3); j++) {' +
    '    var c = cellsOf(trs[j]);' +
    '    if (c.length) preview.push(c);' +
    '  }' +
    '  if (preview.length) {' +
    '    out.push({ kind: "table", rowCount: trs.length, preview: preview, sig: sigFor(preview), where: whereOf(el) });' +
    '  }' +
    '}' +
    // Never page text: code and styles, templates, embedded documents.
    'var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, IFRAME: 1, OBJECT: 1 };' +
    // <input type=submit value="..."> and friends carry their text in an attribute.
    'function inputText(el) {' +
    '  if (el.tagName !== "INPUT") return "";' +
    '  var ty = (el.getAttribute && el.getAttribute("type") || "").toLowerCase();' +
    '  if (ty === "submit" || ty === "button" || ty === "reset") return (el.value || el.getAttribute("value") || "").trim();' +
    '  if (ty === "image") return (el.getAttribute("alt") || "").trim();' +
    '  return "";' +
    '}' +
    // Icon-only buttons and links are named by aria-label (or title).
    'function labelText(el) {' +
    '  if (!el.getAttribute) return "";' +
    '  var role = el.getAttribute("role");' +
    '  if (el.tagName !== "BUTTON" && el.tagName !== "A" && role !== "button" && role !== "link") return "";' +
    '  if ((el.textContent || "").trim()) return "";' +
    '  return (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();' +
    '}' +
    'function captureEl(el, forced) {' +
    '  if (!el || el.nodeType !== 1) return;' +
    '  if (SKIP[el.tagName]) return;' +
    '  if (isTable(el)) { captureTable(el); return; }' +
    '  var special = inputText(el) || labelText(el);' +
    '  var t = special || (el.innerText || el.textContent || "").trim();' +
    '  if (!t) return;' +
    '  var tag = el.tagName === "INPUT" ? "button" : el.tagName.toLowerCase();' +
    '  out.push({ kind: tag, text: t.slice(0, /^h[1-6]$/.test(tag) ? 1000 : 3000), where: whereOf(el), matched: !!forced });' +
    '}' +
    'if (MODE === "css" || MODE === "xpath") {' +
    '  var nodes = [];' +
    '  try {' +
    '    if (MODE === "css") {' +
    '      nodes = Array.prototype.slice.call(document.querySelectorAll(Q));' +
    '    } else {' +
    '      var snap = null;' +
    '      try {' +
    '        snap = document.evaluate(Q, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);' +
    '      } catch (inner) {' +
    // Expressions like count(//a) or string(//title) are not node sets; show
    // their scalar result rather than calling the query invalid.
    '        var any = document.evaluate(Q, document, null, XPathResult.ANY_TYPE, null);' +
    '        var val = any.resultType === XPathResult.NUMBER_TYPE ? any.numberValue' +
    '          : any.resultType === XPathResult.BOOLEAN_TYPE ? any.booleanValue' +
    '          : any.stringValue;' +
    '        out.push({ kind: "value", text: String(val), where: "xpath", matched: true });' +
    '        return { blocks: out, error: "", count: 1 };' +
    '      }' +
    '      for (var i = 0; i < snap.snapshotLength; i++) nodes.push(snap.snapshotItem(i));' +
    '    }' +
    '  } catch (e) {' +
    '    err = (e && e.message) || "invalid query";' +
    '  }' +
    '  for (var k = 0; k < nodes.length && k < 5000; k++) {' +
    '    var n = nodes[k];' +
    '    if (n.nodeType === 1) captureEl(n, true);' +
    '    else if (n.nodeValue && n.nodeValue.trim()) {' +
    '      out.push({ kind: n.nodeType === 2 ? "attr" : "text", text: n.nodeValue.trim().slice(0, 3000), where: n.nodeName, matched: true });' +
    '    }' +
    '  }' +
    '  return { blocks: out, error: err, count: nodes.length };' +
    '}' +
    'var F = NodeFilter;' +
    'var walker = document.createTreeWalker(document.body, F.SHOW_ELEMENT, {' +
    '  acceptNode: function (el) {' +
    '    if (SKIP[el.tagName]) return F.FILTER_REJECT;' +
    '    var p = el.parentElement;' +
    '    while (p) {' +
    '      if (isTable(p)) return F.FILTER_REJECT;' +
    '      if (hasDirectText(p)) return F.FILTER_REJECT;' +
    '      p = p.parentElement;' +
    '    }' +
    '    if (isTable(el)) return F.FILTER_ACCEPT;' +
    '    if (hasDirectText(el)) return F.FILTER_ACCEPT;' +
    '    if (inputText(el) || labelText(el)) return F.FILTER_ACCEPT;' +
    '    return F.FILTER_SKIP;' +
    '  }' +
    '});' +
    'var node;' +
    'while ((node = walker.nextNode())) captureEl(node, false);' +
    'return { blocks: out, error: "", count: out.length };' +
    '})()';
}

function tableFullExpr(sig) {
  // Locates the current page table whose header signature matches `sig` and
  // returns every row (up to 2000). Used only when a table's content changed.
  return '(function () {' +
    'const tables = document.querySelectorAll("table, [role=table]");' +
    'let target = null;' +
    'function sigFor(rows) {' +
    "  return JSON.stringify(rows[0] || []) + '|' + Math.max.apply(null, rows.map(function (r) { return r.length; }).concat(0));" +
    '}' +
    'tables.forEach(function (el) {' +
    '  if (target) return;' +
    '  const trs = el.querySelectorAll("tr, [role=row]");' +
    '  const preview = [];' +
    '  for (let j = 0; j < Math.min(trs.length, 3); j++) {' +
    '    const cells = [];' +
    '    trs[j].querySelectorAll("th, td, [role=cell], [role=columnheader], [role=rowheader]").forEach(function (td) {' +
    "      cells.push((td.innerText || '').trim());" +
    '    });' +
    '    if (cells.length) preview.push(cells);' +
    '  }' +
    "  if (preview.length && sigFor(preview) === " + JSON.stringify(sig) + ') target = el;' +
    '});' +
    'if (!target) return null;' +
    'const rows = [];' +
    'const trs = target.querySelectorAll("tr, [role=row]");' +
    'for (let j = 0; j < Math.min(trs.length, 2000); j++) {' +
    '  const cells = [];' +
    '  trs[j].querySelectorAll("th, td, [role=cell], [role=columnheader], [role=rowheader]").forEach(function (td) {' +
    "    let t = (td.innerText || '').trim();" +
    "    if (t.length > 300) t = t.slice(0, 300) + '…';" +
    '    cells.push(t);' +
    '  });' +
    '  if (cells.length) rows.push(cells);' +
    '}' +
    'return rows;' +
    '})()';
}

// CSS/XPath queries run inside the page; text and regex queries filter what
// the default whole-page walk already captured.
function pageQuery() {
  const q = state.text.query;
  const mode = q.mode === 'css' || q.mode === 'xpath' ? q.mode : 'all';
  const value = q.value.trim();
  return mode !== 'all' && value ? { mode, value } : { mode: 'all', value: '' };
}

async function pollTextOnce(silent) {
  if (textPolling) return;
  textPolling = true;
  try {
    const pq = pageQuery();
    const result = await evalText(textCaptureExpr(pq.mode, pq.value));
    const blocks = result && result.blocks ? result.blocks : null;
    const prevError = state.text.queryError;
    state.text.queryError = (result && result.error) || '';
    if (!blocks || !blocks.length) {
      // An empty result is meaningful for a query — show it instead of
      // leaving the previous matches on screen.
      if (pq.mode !== 'all' || state.text.queryError !== prevError) {
        state.text.blocks = [];
        state.text.lastSig = 'empty\u0001' + state.text.queryError;
        if (silent) renderTabs();
        else render();
      }
      return;
    }
    const now = Date.now();

    // Preserve the user's export selection across poll cycles by content key.
    const selKeys = new Set();
    for (const b of state.text.blocks) if (state.text.sel.has(b.id)) selKeys.add(b.key);

    const newBlocks = [];
    for (const b of blocks) {
      if (b.kind === 'table') {
        const key = 't\u0000' + b.sig;
        const hash = b.rowCount + '|' + JSON.stringify(b.preview);
        let hist = state.text.tables.get(b.sig);
        if (!hist) {
          hist = { snapshots: [], expanded: false };
          state.text.tables.set(b.sig, hist);
        }
        const last = hist.snapshots[hist.snapshots.length - 1];
        if (!last || last.hash !== hash) {
          const rows = await evalText(tableFullExpr(b.sig));
          if (rows) {
            hist.snapshots.push({ ts: now, hash, rows });
            if (hist.snapshots.length > 20) hist.snapshots.shift();
          }
        }
        const snap = hist.snapshots[hist.snapshots.length - 1];
        const id = nextTextId();
        if (selKeys.has(key)) state.text.sel.add(id);
        newBlocks.push({
          id, key, kind: 'table', sig: b.sig,
          rowCount: b.rowCount,
          rows: snap ? snap.rows : [],
          hist,
          where: b.where || '',
          firstSeen: hist.snapshots.length ? hist.snapshots[0].ts : now,
          ts: now,
        });
      } else {
        const key = b.kind + '\u0000' + (b.where || '') + '\u0000' + b.text;
        const id = nextTextId();
        if (selKeys.has(key)) state.text.sel.add(id);
        newBlocks.push({
          id, key, ts: now,
          kind: b.kind,
          text: b.text,
          where: b.where || '',
          matched: !!b.matched,
        });
      }
    }

    // Drop stale selection ids (blocks regenerated every poll).
    const newIds = new Set(newBlocks.map((b) => b.id));
    for (const id of [...state.text.sel]) if (!newIds.has(id)) state.text.sel.delete(id);

    // Skip re-rendering when the page content is unchanged, so the stream is
    // not rebuilt every 1.5s for idle pages.
    const sig = newBlocks
      .map((b) => b.key + (b.kind === 'table' ? '#' + b.rowCount + '|' + JSON.stringify(b.rows.slice(0, 3)) : ''))
      .join('\u0001');
    state.text.blocks = newBlocks;

    // Bound the table-history map so long sessions can't grow without limit.
    if (state.text.tables.size > 300) {
      const keys = [...state.text.tables.keys()];
      for (const k of keys.slice(0, state.text.tables.size - 300)) state.text.tables.delete(k);
    }

    if (sig !== state.text.lastSig) {
      state.text.lastSig = sig;
      // In background mode we only refresh the badge counts, never the panel
      // layout, so a category that is not currently open stays cheap.
      if (silent) renderTabs();
      else render();
    }
  } finally {
    textPolling = false;
  }
}

function ensureTextPoll() {
  if (textPollTimer || textPolling) return;
  const tick = () => {
    textPollTimer = null;
    if (state.activeTab !== 'text') return;
    pollTextOnce()
      .catch(() => { /* page context may be unavailable */ })
      .then(() => {
        if (state.activeTab === 'text' && state.text.live) {
          textPollTimer = setTimeout(tick, 1500);
        }
      });
  };
  tick();
}

function stopTextPoll() {
  if (textPollTimer) {
    clearTimeout(textPollTimer);
    textPollTimer = null;
  }
}

// A slower background poll that runs regardless of the active category so the
// Text tab badge shows a real count before the tab is even opened. It updates
// only the tab counts (silent mode) and never touches the current layout.
let bgTextTimer = null;

function ensureBgTextPoll() {
  if (bgTextTimer || textPolling) return;
  const tick = () => {
    bgTextTimer = null;
    if (state.activeTab === 'text' || !state.text.live) return;
    pollTextOnce(true)
      .catch(() => { /* page context may be unavailable */ })
      .then(() => {
        if (state.activeTab !== 'text' && state.text.live) {
          bgTextTimer = setTimeout(tick, 4000);
        }
      });
  };
  tick();
}

function stopBgTextPoll() {
  if (bgTextTimer) {
    clearTimeout(bgTextTimer);
    bgTextTimer = null;
  }
}

// Lower-case without changing length: "İ".toLowerCase() adds a combining
// dot, which would break matching between "i" and "İ".
function foldCase(str) {
  return String(str).replace(/İ/g, 'i').toLowerCase();
}

function textBlockHaystack(b) {
  return b.kind === 'table' ? b.rows.map((r) => r.join(' ')).join(' ') : b.text || '';
}

// Compiles the query box into a predicate. CSS/XPath already ran in the page,
// so those modes match everything that came back.
function compileTextQuery() {
  const { mode, value } = state.text.query;
  const v = value.trim();
  if (!v || mode === 'css' || mode === 'xpath') return { test: null, error: '' };
  if (mode === 'regex') {
    try {
      const re = new RegExp(v, 'i');
      return { test: (s) => re.test(s), error: '' };
    } catch (e) {
      return { test: null, error: e.message || 'invalid regular expression' };
    }
  }
  const lower = foldCase(v);
  return { test: (s) => foldCase(s).includes(lower), error: '' };
}

function filteredTextBlocks() {
  const t = state.text;
  const { test } = compileTextQuery();
  return t.blocks.filter((b) => {
    // The text view keeps tables in place (as pointers); the table view shows only tables.
    if (t.pill === 'tables' && b.kind !== 'table') return false;
    if (t.tag !== 'all' && textGroupOf(b.kind) !== t.tag) return false;
    if (test && !test(textBlockHaystack(b))) return false;
    return true;
  });
}

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return t('timeSecondsAgo', '$COUNT$s ago').replace('$COUNT$', s);
  const m = Math.round(s / 60);
  if (m < 60) return t('timeMinutesAgo', '$COUNT$m ago').replace('$COUNT$', m);
  return new Date(ts).toLocaleTimeString();
}

// The page text is sorted into boxes by element type — the second menu of
// the Text view. Related tags share a box so the list stays short.
const TEXT_GROUPS = {
  h1: ['h1'], h2: ['h2'], h3: ['h3'], h4: ['h4'], h5: ['h5'], h6: ['h6'],
  p: ['p'],
  a: ['a'],
  li: ['li', 'dt', 'dd'],
  button: ['button', 'summary', 'option'],
  label: ['label', 'legend', 'figcaption', 'caption'],
  span: ['span', 'small', 'strong', 'em', 'b', 'i', 'u', 'time', 'mark', 'sup', 'sub', 'abbr'],
  div: ['div', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside', 'form', 'center'],
  cell: ['td', 'th'],
  code: ['pre', 'code', 'kbd', 'samp'],
  quote: ['blockquote', 'q', 'cite'],
};
const TEXT_GROUP_OF = {};
for (const [g, kinds] of Object.entries(TEXT_GROUPS)) for (const k of kinds) TEXT_GROUP_OF[k] = g;
const TEXT_GROUP_ORDER = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'li', 'button', 'label', 'span', 'div', 'cell', 'code', 'quote'];

function textGroupOf(kind) {
  return TEXT_GROUP_OF[kind] || kind;
}

function textGroupLabel(g) {
  if (/^h[1-6]$/.test(g)) return t('textKindHeading', 'Heading') + ' ' + g[1];
  const names = {
    p: ['textKindP', 'Paragraphs'],
    a: ['textKindA', 'Links'],
    li: ['textKindLi', 'List items'],
    button: ['textKindButton', 'Buttons'],
    label: ['textKindLabel', 'Labels and captions'],
    span: ['textKindSpan', 'Inline text'],
    div: ['textKindDiv', 'Other blocks'],
    cell: ['textKindCell', 'Table cells'],
    code: ['textKindCode', 'Code'],
    quote: ['textKindQuote', 'Quotes'],
    table: ['textSegTables', 'Tables'],
  };
  return names[g] ? t(names[g][0], names[g][1]) : '<' + g + '>';
}

function textGroupBadge(g) {
  if (/^h[1-6]$/.test(g)) return g.toUpperCase();
  const badges = { a: 'A', p: 'P', li: '•', button: 'BTN', label: 'LBL', span: 'SPAN', div: 'DIV', cell: 'TD', code: '</>', quote: '“ ”' };
  return badges[g] || g.slice(0, 4).toUpperCase();
}

function textNavBox(key, badge, label, count, preview, active, onClick) {
  const box = document.createElement('button');
  box.type = 'button';
  box.className = 'tx-box' + (active ? ' tx-box--active' : '');
  box.dataset.group = key;
  box.setAttribute('aria-pressed', String(active));
  const b = document.createElement('span');
  b.className = 'tx-box__badge';
  b.textContent = badge;
  const body = document.createElement('span');
  body.className = 'tx-box__body';
  const top = document.createElement('span');
  top.className = 'tx-box__top';
  const name = document.createElement('span');
  name.className = 'tx-box__name';
  name.textContent = label;
  top.appendChild(name);
  if (count !== null) {
    const c = document.createElement('span');
    c.className = 'tx-box__count';
    c.textContent = count;
    top.appendChild(c);
  }
  body.appendChild(top);
  if (preview) {
    const pv = document.createElement('span');
    pv.className = 'tx-box__preview';
    pv.dir = 'auto';
    pv.textContent = preview;
    body.appendChild(pv);
  }
  box.append(b, body);
  box.title = label + (preview ? ' — ' + preview : '');
  box.addEventListener('click', onClick);
  return box;
}

// Rebuilds the box menu from what the page actually contains: one box per
// element group with its count and the first line it holds.
function renderTextNav() {
  const nav = document.getElementById('tx-nav');
  if (!nav) return;
  const st = state.text;
  const groups = new Map();
  let words = 0;
  for (const b of st.blocks) {
    if (b.kind === 'table') continue;
    const g = textGroupOf(b.kind);
    let entry = groups.get(g);
    if (!entry) groups.set(g, (entry = { count: 0, first: '' }));
    entry.count++;
    if (!entry.first && b.text) entry.first = b.text.replace(/\s+/g, ' ').slice(0, 80);
    if (b.text) words += b.text.trim().split(/\s+/).length;
  }
  const custom = st.query.mode === 'css' || st.query.mode === 'xpath';
  const select = (g) => () => {
    st.tag = g;
    if (custom) {
      st.query = { mode: 'text', value: '' };
      st.queryError = '';
      st.lastSig = '';
      pollTextOnce().catch(() => {});
    }
    renderTextView();
    document.getElementById('text-stream').scrollTop = 0;
  };
  nav.innerHTML = '';
  const nonTable = st.blocks.filter((b) => b.kind !== 'table').length;
  nav.appendChild(textNavBox('all', '¶', t('textKindAll', 'All page text'), nonTable,
    t('textSummaryWords', '$COUNT$ words').replace('$COUNT$', words.toLocaleString()),
    st.tag === 'all' && !custom, select('all')));

  const keys = [...groups.keys()].sort((x, y) => {
    const ix = TEXT_GROUP_ORDER.indexOf(x);
    const iy = TEXT_GROUP_ORDER.indexOf(y);
    return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy) || x.localeCompare(y);
  });
  // Keep the selected box even if the page momentarily has none.
  if (st.tag !== 'all' && !groups.has(st.tag)) keys.push(st.tag);
  const sep = document.createElement('div');
  sep.className = 'tx-nav__sep';
  nav.appendChild(sep);
  for (const g of keys) {
    const entry = groups.get(g) || { count: 0, first: '' };
    nav.appendChild(textNavBox(g, textGroupBadge(g), textGroupLabel(g), entry.count, entry.first, st.tag === g && !custom, select(g)));
  }
  const sep2 = document.createElement('div');
  sep2.className = 'tx-nav__sep';
  nav.appendChild(sep2);
  nav.appendChild(textNavBox('query', '{ }', t('textCustomQuery', 'Custom query'), null,
    t('textCustomQueryHint', 'CSS selector or XPath on the live page'), custom, () => {
      if (!custom) {
        st.query = { mode: 'css', value: '' };
        st.tag = 'all';
        st.queryError = '';
        st.lastSig = '';
      }
      renderTextView();
      document.getElementById('tf-query').focus();
    }));
}

function getQueryPlaceholder(mode) {
  switch (mode) {
    case 'regex':
      return t('textPlaceholderRegex', '^Price:\\s*\\d+  — JavaScript regular expression');
    case 'css':
      return t('textPlaceholderCss', '.product-card .price, article h2 — any CSS selector');
    case 'xpath':
      return t('textPlaceholderXpath', '//div[@class="row"]//td[2]  ·  count(//a)  ·  //@href');
    case 'text':
    default:
      return t('textSearchText', 'Search the page text');
  }
}

// Text and table views share one toolbar: the segment picks the view, the
// action group follows it, and the query tools stay behind "Advanced" until
// someone needs CSS, XPath or an element filter.
function syncTextToolbar() {
  const live = state.text.live;
  const liveBtn = document.getElementById('tf-live');
  if (liveBtn) {
    liveBtn.classList.toggle('tx-live--off', !live);
    liveBtn.setAttribute('aria-pressed', String(live));
    liveBtn.title = live
      ? t('textLivePauseTitle', 'Pause live capture')
      : t('textLiveResumeTitle', 'Resume live capture');
    document.getElementById('tf-live-label').textContent = live ? t('textLive', 'Live') : t('textPaused', 'Paused');
  }
  const mode = document.getElementById('tf-mode');
  if (mode && mode.value !== state.text.query.mode) mode.value = state.text.query.mode;
  const input = document.getElementById('tf-query');
  if (input) {
    if (document.activeElement !== input && input.value !== state.text.query.value) {
      input.value = state.text.query.value;
    }
    input.placeholder = getQueryPlaceholder(state.text.query.mode);
    input.setAttribute('aria-label', t('textSearchText', 'Search the page text'));
  }

  const tables = state.text.pill === 'tables';
  for (const [id, on] of [['tf-pill-text', !tables], ['tf-pill-tables', tables]]) {
    const btn = document.getElementById(id);
    btn.classList.toggle('seg__btn--active', on);
    btn.setAttribute('aria-selected', String(on));
  }
  const tableCount = state.text.blocks.filter((b) => b.kind === 'table').length;
  document.getElementById('tx-count-text').textContent = state.text.blocks.length - tableCount;
  document.getElementById('tx-count-tables').textContent = tableCount;
  document.getElementById('tx-actions-text').hidden = tables;
  document.getElementById('tx-actions-tables').hidden = !tables;

  // The box menu belongs to the text view; tables have their own cards.
  document.getElementById('tx-nav').hidden = tables;
  renderTextNav();
}

// One line under the query box: how many blocks matched, or exactly what the
// page said about a broken selector / regular expression.
function renderTextStatus(shown) {
  const el = document.getElementById('tf-query-status');
  if (!el) return;
  const { mode, value } = state.text.query;
  const local = compileTextQuery();
  const error = state.text.queryError || local.error;
  if (error) {
    el.className = 'tf-status tf-status--error';
    el.textContent = (mode === 'xpath' ? 'XPath: ' : mode === 'css' ? 'Selector: ' : 'Regex: ') + error;
    el.title = el.textContent;
    return;
  }
  el.className = 'tf-status';
  el.title = '';
  if (!value.trim()) {
    el.textContent = '';
    return;
  }
  el.textContent = shown + ' ' + (shown === 1 ? (t('textMatch', 'match') || 'match') : (t('textMatches', 'matches') || 'matches'));
}

// The captured document is rendered in windows too — a content-heavy page can
// produce well over a thousand blocks, and tables add rows on top of that.
const TEXT_CHUNK = 80;
let textWindow = null;
let textObserver = null;

function teardownTextWindow() {
  if (textObserver) {
    textObserver.disconnect();
    textObserver = null;
  }
  textWindow = null;
}

function appendTextChunk() {
  if (!textWindow) return;
  const { container, items, sentinel } = textWindow;
  const end = Math.min(textWindow.index + TEXT_CHUNK, items.length);
  const frag = document.createDocumentFragment();
  for (let i = textWindow.index; i < end; i++) frag.appendChild(renderTextItem(items[i]));
  container.insertBefore(frag, sentinel);
  textWindow.index = end;

  if (end >= items.length) {
    teardownTextWindow();
    sentinel.remove();
  } else if (textObserver) {
    textObserver.unobserve(sentinel);
    textObserver.observe(sentinel);
  }
}

// Navigation-style blocks (links, buttons) read better as one line of items
// than as a column of one-word paragraphs.
const TEXT_LINK_KINDS = new Set(['a', 'button', 'label', 'summary', 'option']);

function buildTextItems(blocks) {
  // A single box is shown as a plain list, one row per element.
  if (state.text.pill !== 'tables' && state.text.tag !== 'all') {
    return blocks.map((b) => ({ kind: 'row', block: b }));
  }
  const tableNo = new Map();
  let n = 0;
  for (const b of state.text.blocks) if (b.kind === 'table') tableNo.set(b.id, ++n);
  const items = [];
  for (const b of blocks) {
    if (b.kind === 'table') {
      items.push({ kind: 'table', block: b, no: tableNo.get(b.id) || 0 });
    } else if (TEXT_LINK_KINDS.has(b.kind)) {
      const last = items[items.length - 1];
      if (last && last.kind === 'links') last.blocks.push(b);
      else items.push({ kind: 'links', blocks: [b] });
    } else {
      items.push({ kind: 'block', block: b });
    }
  }
  return items;
}

function renderTextView() {
  teardownTextWindow();
  syncTextToolbar();

  const stream = document.getElementById('text-stream');
  if (!stream) return;
  stream.innerHTML = '';
  const blocks = filteredTextBlocks();
  renderTextStatus(blocks.length);

  const tables = state.text.pill === 'tables';
  const queryActive = !!state.text.query.value.trim();
  const emptyState = (html) => {
    const empty = document.createElement('div');
    empty.className = 'text-empty';
    empty.innerHTML = html;
    stream.appendChild(empty);
  };
  if (!state.text.blocks.length) {
    emptyState(state.text.queryError
      ? `<p>${t('textEmptyQueryReject', 'The page rejected that query. Fix it above and the results will come straight back.')}</p>`
      : queryActive
        ? `<p>${t('textEmptyNoMatch', 'No element on the page matches this query. Try a looser selector, or switch the mode next to the box.')}</p>`
        : '<svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 12h28M10 20h28M10 28h18M10 36h12"/></svg>' +
          `<p>${t('textEmptyInitial', 'Nothing captured yet. Live capture is running — the whole page will appear here as readable text.')}</p>`);
    return;
  }
  if (!blocks.length) {
    emptyState(tables && !queryActive
      ? '<svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="10" width="32" height="28" rx="4"/><path d="M8 19h32M8 28h32M20 19v19"/></svg>' +
          `<p>${t('textNoTables', 'No tables on this page yet. They appear here as soon as the page shows one.')}</p>`
      : `<p>${t('textEmptyFiltered', 'Nothing matches the current query and element filter.')}</p>`);
    return;
  }

  const container = document.createElement('div');
  const listMode = !tables && state.text.tag !== 'all';
  container.className = tables ? 'tx-cards' : listMode ? 'tx-list' : 'tx-doc';
  if (!tables) {
    const head = renderTextSummary(blocks);
    if (listMode) {
      const title = document.createElement('strong');
      title.className = 'tx-summary__title';
      title.textContent = textGroupLabel(state.text.tag);
      head.prepend(title);
    }
    container.appendChild(head);
  }
  stream.appendChild(container);

  const sentinel = document.createElement('div');
  sentinel.className = 'text-sentinel';
  container.appendChild(sentinel);
  textWindow = { container, items: buildTextItems(blocks), sentinel, index: 0 };

  if (window.IntersectionObserver) {
    textObserver = new IntersectionObserver(
      (records) => {
        if (records.some((r) => r.isIntersecting)) appendTextChunk();
      },
      { root: stream, rootMargin: '900px 0px' }
    );
    textObserver.observe(sentinel);
  }
  appendTextChunk();
  if (!window.IntersectionObserver) {
    while (textWindow) appendTextChunk();
  }
}

// A quiet one-line read-out above the document: blocks, words, characters.
function renderTextSummary(shown) {
  const summary = document.createElement('div');
  summary.className = 'tx-summary';
  let words = 0;
  let chars = 0;
  for (const b of shown) {
    if (b.kind === 'table') continue;
    const blockText = b.text || '';
    chars += blockText.length;
    if (blockText.trim()) words += blockText.trim().split(/\s+/).length;
  }
  const parts = [
    t('textSummaryBlocks', '$COUNT$ blocks').replace('$COUNT$', shown.length),
    t('textSummaryWords', '$COUNT$ words').replace('$COUNT$', words.toLocaleString()),
    t('textSummaryChars', '$COUNT$ characters').replace('$COUNT$', chars.toLocaleString()),
  ];
  for (const text of parts) {
    const span = document.createElement('span');
    span.textContent = text;
    summary.appendChild(span);
  }
  return summary;
}

// Plain-text rendering of what is on screen, used by "Copy text" and the TXT
// export. Headings keep their weight through blank lines, tables become
// tab-separated rows so they paste straight into a spreadsheet.
function plainTextOf(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.kind === 'table') {
      const rows = tableRowsFor(b);
      out.push(rows.map((r) => r.join('\t')).join('\n'));
    } else if (/^h[1-6]$/.test(b.kind)) {
      out.push('\n' + b.text);
    } else {
      out.push(b.text);
    }
  }
  return out.join('\n\n').trim() + '\n';
}

// Writes `text` into `el`, marking every hit of a plain-text query.
function setMarkedText(el, text) {
  const { mode, value } = state.text.query;
  const q = mode === 'text' ? foldCase(value.trim()) : '';
  if (!q) {
    el.textContent = text;
    return;
  }
  const lower = foldCase(text);
  let from = 0;
  let hits = 0;
  for (let i = lower.indexOf(q); i !== -1 && hits < 50; i = lower.indexOf(q, from)) {
    el.appendChild(document.createTextNode(text.slice(from, i)));
    const mark = document.createElement('mark');
    mark.className = 'hl';
    mark.textContent = text.slice(i, i + q.length);
    el.appendChild(mark);
    from = i + q.length;
    hits++;
  }
  el.appendChild(document.createTextNode(text.slice(from)));
}

const COPY_ICON = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>';

function copyButton(getText, toastKey, toastFallback) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn tx-copy-btn';
  btn.title = t('textCopy', 'Copy');
  btn.setAttribute('aria-label', btn.title);
  btn.innerHTML = COPY_ICON;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyText(getText());
    toast(t(toastKey, toastFallback), 'success');
  });
  return btn;
}

function renderTextItem(item) {
  if (item.kind === 'row') {
    const b = item.block;
    const row = document.createElement('div');
    const code = TEXT_GROUP_OF[b.kind] === 'code';
    row.className = 'tx-row' + (code ? ' tx-row--code' : '') + (b.matched ? ' tx-match' : '');
    const text = document.createElement(code ? 'pre' : 'span');
    text.className = 'tx-row__text';
    text.dir = 'auto';
    setMarkedText(text, b.text);
    row.appendChild(text);
    // Only worth showing when it carries an id or class, not the bare tag.
    if (b.where && b.where !== b.kind) {
      const where = document.createElement('code');
      where.className = 'tx-row__where';
      where.textContent = b.where;
      row.appendChild(where);
    }
    row.appendChild(copyButton(() => b.text || '', 'toastCopiedToClipboard', 'Copied to clipboard'));
    return row;
  }
  if (item.kind === 'table') {
    return state.text.pill === 'tables' ? renderTableCard(item.block, item.no) : renderTableStub(item.block, item.no);
  }
  if (item.kind === 'links') {
    const row = document.createElement('div');
    row.className = 'tx-links';
    for (const b of item.blocks) {
      const span = document.createElement('span');
      span.className = 'tx-link' + (b.matched ? ' tx-match' : '');
      span.dir = 'auto';
      if (b.where) span.title = b.where;
      setMarkedText(span, b.text);
      row.appendChild(span);
    }
    row.appendChild(copyButton(() => item.blocks.map((b) => b.text).join('\n'), 'toastCopiedToClipboard', 'Copied to clipboard'));
    return row;
  }
  const b = item.block;
  const heading = /^h[1-6]$/.test(b.kind);
  const el = document.createElement(heading ? 'div' : 'p');
  el.className = 'tx-block' +
    (heading ? ' tx-h tx-' + b.kind : '') +
    (b.kind === 'li' ? ' tx-li' : '') +
    (b.kind === 'blockquote' ? ' tx-quote' : '') +
    (TEXT_GROUP_OF[b.kind] === 'code' || b.kind === 'value' || b.kind === 'attr' ? ' tx-code' : '') +
    (b.matched ? ' tx-match' : '');
  if (heading) {
    el.setAttribute('role', 'heading');
    el.setAttribute('aria-level', b.kind[1]);
  }
  if (b.where) el.title = b.where;
  el.dir = 'auto';
  const text = document.createElement('span');
  setMarkedText(text, b.text);
  el.appendChild(text);
  el.appendChild(copyButton(() => b.text || '', 'toastCopiedToClipboard', 'Copied to clipboard'));
  return el;
}

// What the table shows right now: either the newest snapshot, or every unique
// row seen since capture started — which is exactly what an export contains.
function tableRowsFor(b) {
  if (!b.hist) return b.rows || [];
  return b.hist.merged
    ? dedupeRows(b.hist.snapshots.flatMap((s) => s.rows))
    : b.rows || [];
}

function tableName(no) {
  return t('textTable', 'Table') + ' ' + no;
}

// Inside the readable text, a table is a compact pointer to its card.
function renderTableStub(b, no) {
  const el = document.createElement('div');
  el.className = 'tx-stub';
  const rows = tableRowsFor(b);
  el.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M2.5 9.8h11M6.5 6.5V13"/></svg>';
  const label = document.createElement('span');
  label.className = 'tx-stub__label';
  const strong = document.createElement('strong');
  strong.textContent = tableName(no);
  label.appendChild(strong);
  const meta = document.createElement('span');
  meta.textContent = (rows[0] || []).filter(Boolean).slice(0, 4).join(' · ');
  label.appendChild(meta);
  el.appendChild(label);
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'btn btn--sm';
  open.textContent = t('textSegTables', 'Tables') + ' →';
  open.addEventListener('click', () => {
    state.text.pill = 'tables';
    renderTextView();
  });
  el.appendChild(open);
  return el;
}

const TABLE_PREVIEW_ROWS = 8;

function tableElement(rows, limit) {
  const tbl = document.createElement('table');
  tbl.className = 'txt-table';
  if (!rows.length) {
    const tr = tbl.insertRow();
    tr.insertCell().textContent = t('textTableNoRows', 'No rows captured yet.');
    return tbl;
  }
  const cols = Math.max(...rows.map((r) => r.length));
  const thead = tbl.createTHead();
  const htr = thead.insertRow();
  for (let c = 0; c < cols; c++) {
    const th = document.createElement('th');
    th.textContent = rows[0][c] || '';
    htr.appendChild(th);
  }
  const body = tbl.createTBody();
  for (const row of rows.slice(1, limit)) {
    const tr = body.insertRow();
    for (let c = 0; c < cols; c++) tr.insertCell().textContent = row[c] || '';
  }
  return tbl;
}

function renderTableCard(b, no) {
  const card = document.createElement('section');
  card.className = 'tx-card';
  const rows = tableRowsFor(b);
  const unique = dedupeRows(b.hist.snapshots.flatMap((s) => s.rows)).length;

  const head = document.createElement('header');
  head.className = 'tx-card__head';
  const title = document.createElement('div');
  title.className = 'tx-card__title';
  const h = document.createElement('h3');
  h.textContent = tableName(no);
  title.appendChild(h);
  const meta = document.createElement('span');
  meta.className = 'tx-card__meta';
  meta.textContent = [
    t('textTableUniqueRows', '$COUNT$ unique row(s)').replace('$COUNT$', unique),
    t('textTableUpdated', 'updated $TIME$').replace('$TIME$', timeAgo(b.ts)),
  ].join(' · ');
  title.appendChild(meta);
  if (b.where) {
    const where = document.createElement('code');
    where.className = 'tx-card__where';
    where.textContent = b.where;
    title.appendChild(where);
  }
  head.appendChild(title);

  const actions = document.createElement('div');
  actions.className = 'tx-card__actions';
  const action = (label, primary, fn, tip) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--sm' + (primary ? ' btn--primary' : '');
    btn.textContent = label;
    if (tip) btn.title = tip;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
    actions.appendChild(btn);
    return btn;
  };
  action('Excel', true, () => exportSingleTable(b, 'xlsx'), 'Excel (.xlsx)');
  action('CSV', false, () => exportSingleTable(b, 'csv'), t('tableDownloadCsvTitle', 'Download this table as CSV'));
  const copy = action(t('textCopy', 'Copy'), false, () => {
    copyText(tableRowsFor(b).map((r) => r.join('\t')).join('\n'));
    toast(t('toastTableCopied', 'Table copied to clipboard'), 'success');
  });
  copy.insertAdjacentHTML('afterbegin', COPY_ICON);
  head.appendChild(actions);
  card.appendChild(head);

  // Live tables: every snapshot is kept, so the rows a page paged through
  // can be gathered into one table — which is what the exports contain.
  if (b.hist.snapshots.length > 1) {
    const live = document.createElement('div');
    live.className = 'tx-card__live';
    const info = document.createElement('span');
    info.textContent = t('textTableSnapshots', '$COUNT$ snapshot(s)').replace('$COUNT$', b.hist.snapshots.length);
    live.appendChild(info);
    if (unique > (b.rows ? b.rows.length : 0) || b.hist.merged) {
      const merge = document.createElement('button');
      merge.type = 'button';
      merge.className = 'tx-link-btn';
      merge.setAttribute('aria-pressed', String(!!b.hist.merged));
      merge.textContent = b.hist.merged
        ? t('textTableShowingAll', 'Showing all rows')
        : t('textTableShowAll', 'Show all $COUNT$ rows').replace('$COUNT$', unique);
      merge.title = t('tableMergeSnapshotsTitle', 'Combine every snapshot into one deduplicated table — this is what gets exported');
      merge.addEventListener('click', () => {
        b.hist.merged = !b.hist.merged;
        renderTextView();
      });
      live.appendChild(merge);
    }
    card.appendChild(live);
  }

  const wrap = document.createElement('div');
  wrap.className = 'txt-table__wrap';
  const open = !!b.hist.open;
  wrap.appendChild(tableElement(rows, open ? 2000 : TABLE_PREVIEW_ROWS + 1));
  card.appendChild(wrap);

  if (rows.length - 1 > TABLE_PREVIEW_ROWS) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'tx-card__more';
    more.textContent = open
      ? t('textShowLess', 'Show less')
      : t('textTableShowAll', 'Show all $COUNT$ rows').replace('$COUNT$', rows.length - 1);
    more.addEventListener('click', () => {
      b.hist.open = !open;
      renderTextView();
    });
    card.appendChild(more);
  }
  return card;
}

/* ---------- Text exports ---------- */

function dedupeRows(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const k = JSON.stringify(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function csvEscape(v) {
  const s = String(v === null || v === undefined ? '' : v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Selected blocks win; when nothing is selected, everything visible after the
// filter bar is exported.
function exportTextSelection() {
  const sel = state.text.sel;
  let blocks = filteredTextBlocks();
  if (sel.size) blocks = blocks.filter((b) => sel.has(b.id));
  return blocks;
}

// The tables to export: visible (and selected, if any) tables with their full
// snapshot history flattened and deduplicated row-by-row.
function exportTableItems() {
  const sel = state.text.sel;
  let blocks = filteredTextBlocks().filter((b) => b.kind === 'table');
  if (sel.size) blocks = blocks.filter((b) => sel.has(b.id));
  const seen = new Set();
  const out = [];
  for (const b of blocks) {
    if (seen.has(b.sig)) continue;
    seen.add(b.sig);
    const hist = state.text.tables.get(b.sig);
    if (!hist) continue;
    const rows = dedupeRows(hist.snapshots.flatMap((s) => s.rows));
    if (rows.length) out.push({ rows });
  }
  return out;
}

// The whole readable page, exactly as shown, as a plain .txt file.
function exportTextPlain() {
  const blocks = exportTextSelection();
  if (!blocks.length) {
    toast(t('toastNothingToExport', 'Nothing to export'));
    return;
  }
  saveBlob(new Blob([plainTextOf(blocks)], { type: 'text/plain' }), 'text/page-text.txt');
  toast(t('toastExportedTxt', 'Exported $COUNT$ block(s) as TXT').replace('$COUNT$', blocks.length));
}

function exportTextMarkdown() {
  const blocks = exportTextSelection();
  if (!blocks.length) {
    toast(t('toastNothingToExport', 'Nothing to export'));
    return;
  }
  const lines = [];
  for (const b of blocks) {
    if (b.kind === 'table') {
      const rows = tableRowsFor(b);
      if (!rows.length) continue;
      const cols = Math.max(...rows.map((r) => r.length));
      const pad = (r) => Array.from({ length: cols }, (_, i) => String(r[i] || '').replace(/\|/g, '\\|'));
      lines.push(
        '| ' + pad(rows[0]).join(' | ') + ' |\n' +
        '| ' + Array(cols).fill('---').join(' | ') + ' |\n' +
        rows.slice(1).map((r) => '| ' + pad(r).join(' | ') + ' |').join('\n')
      );
    } else if (/^h[1-6]$/.test(b.kind)) {
      lines.push('#'.repeat(+b.kind[1]) + ' ' + b.text);
    } else if (b.kind === 'li') {
      lines.push('- ' + b.text);
    } else {
      lines.push(b.text);
    }
  }
  if (!lines.length) {
    toast(t('toastNothingToExport', 'Nothing to export'));
    return;
  }
  const blob = new Blob([lines.join('\n\n')], { type: 'text/markdown' });
  saveBlob(blob, 'text/page-content.md');
  toast(t('toastExportedMd', 'Exported $COUNT$ block(s) as Markdown').replace('$COUNT$', lines.length));
}

async function exportSingleTable(b, format) {
  const rows = tableRowsFor(b);
  if (!rows || !rows.length) {
    toast(t('toastNoTableRows', 'No table rows captured'), 'error');
    return;
  }
  const cleanTitle = (b.title || 'table').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  if (format === 'csv') {
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
    saveBlob(new Blob([csv], { type: 'text/csv' }), 'text/' + cleanTitle + '.csv');
    toast(t('toastExportedCsv', 'Exported table as CSV'), 'success');
  } else if (format === 'xlsx') {
    const blob = await buildXlsx([{ name: 'Table', rows }]);
    saveBlob(blob, 'text/' + cleanTitle + '.xlsx');
    toast(t('toastExportedXlsx', 'Exported table as XLSX'), 'success');
  }
}

async function exportTablesAs(format) {
  const tables = exportTableItems();
  if (!tables.length) {
    toast(t('toastNoTableRows', 'No table data captured'));
    return;
  }
  const entries = [];
  for (let i = 0; i < tables.length; i++) {
    const name = 'Table ' + (i + 1);
    if (format === 'csv') {
      entries.push({ name: 'text/table-' + (i + 1) + '.csv', data: tables[i].rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') });
    } else {
      let html = '<!doctype html>\n<meta charset="utf-8">\n<title>' + escapeHtml(name) + '</title>\n' +
        '<h2>' + escapeHtml(name) + '</h2>\n' +
        '<p>' + tables[i].rows.length + ' unique row' + (tables[i].rows.length === 1 ? '' : 's') + '</p>\n' +
        '<table border="1" cellpadding="5" cellspacing="0">\n' +
        tables[i].rows.map((r) => '<tr>' + r.map((c) => '<td>' + escapeHtml(c) + '</td>').join('') + '</tr>').join('\n') +
        '\n</table>\n';
      entries.push({ name: 'text/table-' + (i + 1) + '.html', data: html });
    }
  }
  const zip = await buildZip(entries);
  saveBlob(zip, format === 'csv' ? 'text/tables.csv.zip' : 'text/tables.html.zip');
  toast(t('toastExportedTablesZip', 'Exported $COUNT$ table(s) as $FORMAT$').replace('$COUNT$', entries.length).replace('$FORMAT$', format.toUpperCase()));
}

async function exportTextXlsx() {
  const tables = exportTableItems();
  if (!tables.length) {
    toast(t('toastNoTableRows', 'No table data captured'));
    return;
  }
  const sheets = tables.map((t, i) => ({ name: ('Table ' + (i + 1)).slice(0, 31), rows: t.rows }));
  const blob = await buildXlsx(sheets);
  saveBlob(blob, 'text/tables.xlsx');
  toast(t('toastExportedSheetsXlsx', 'Exported $COUNT$ sheet(s) as XLSX').replace('$COUNT$', sheets.length));
}
