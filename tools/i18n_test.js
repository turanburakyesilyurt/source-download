/* Source Download — placeholder tests for all locales.
 * Guards against raw "$count$" style tokens leaking into the panel UI.
 * Run: node tools/i18n_test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const TOKEN_RE = /\$([A-Za-z_][A-Za-z0-9_]*)\$/g;
const tokens = (s) => [...String(s || '').matchAll(TOKEN_RE)].map((m) => m[1].toUpperCase()).sort();

const en = JSON.parse(read('_locales/en/messages.json'));
const locales = fs.readdirSync(path.join(ROOT, '_locales')).filter((d) => !d.startsWith('.'));
// Flat { locale: { key: message } } as lib/locale.js loadMessages() builds it (English fills gaps).
const flat = (loc) => Object.fromEntries(Object.entries(JSON.parse(read(`_locales/${loc}/messages.json`))).map(([k, v]) => [k, v.message]));
const enFlat = flat('en');
const dict = Object.fromEntries(locales.map((loc) => [loc, Object.assign({}, enFlat, flat(loc))]));

// Pull t() and normalizePlaceholders() out of panel.js verbatim.
const panelSrc = require('./panel_source').readPanelSource();
function extractFn(name) {
  const start = panelSrc.indexOf('function ' + name + '(');
  assert(start >= 0, 'panel.js: function ' + name + ' not found');
  let i = panelSrc.indexOf('{', start), depth = 0;
  for (; i < panelSrc.length; i++) {
    if (panelSrc[i] === '{') depth++;
    else if (panelSrc[i] === '}' && --depth === 0) break;
  }
  return panelSrc.slice(start, i + 1);
}
const helpers = panelSrc.includes('function normalizePlaceholders(') ? extractFn('normalizePlaceholders') + '\n' : '';
const makeT = new Function('currentMessages', 'chrome', helpers + extractFn('t') + '\nreturn t;');

let checks = 0;

// 1. Every locale uses the same tokens as English,
//    and every token has a placeholders entry in messages.json.
for (const loc of locales) {
  const msgs = JSON.parse(read(`_locales/${loc}/messages.json`));
  for (const [key, val] of Object.entries(en)) {
    const want = tokens(val.message).join(',');
    if (!want) continue;
    assert.strictEqual(tokens(msgs[key] && msgs[key].message).join(','), want, `${loc}/messages.json ${key}: placeholder mismatch`);
    const defined = Object.keys((msgs[key] && msgs[key].placeholders) || {}).map((n) => n.toUpperCase());
    for (const tk of want.split(',')) {
      assert(defined.includes(tk), `${loc}/messages.json ${key}: missing placeholders.${tk.toLowerCase()}`);
    }
    checks++;
  }
}

// 2. panel.js t() output can be filled with upper-case tokens in every locale.
for (const loc of locales) {
  const t = makeT(dict[loc], undefined);
  for (const [key, val] of Object.entries(en)) {
    const toks = tokens(val.message);
    if (!toks.length) continue;
    let out = t(key, 'fallback');
    for (const tk of toks) out = out.replace('$' + tk + '$', '1');
    assert(!TOKEN_RE.test(out), `${loc}.${key}: raw placeholder left after fill -> "${out}"`);
    TOKEN_RE.lastIndex = 0;
    // subs path
    const subs = Object.fromEntries(toks.map((tk) => [tk.toLowerCase(), '$&2']));
    const viaSubs = t(key, 'fallback', subs);
    assert(!/\$[A-Za-z_]\w*\$/.test(viaSubs), `${loc}.${key}: raw placeholder left after subs`);
    assert(viaSubs.includes('$&2'), `${loc}.${key}: subs value must be inserted literally`);
    checks++;
  }
}

// 3. Every t('key', …) call in panel.js fills all of that key's placeholders.
const callRe = /\bt\('(\w+)'/g;
let m;
while ((m = callRe.exec(panelSrc))) {
  const key = m[1];
  const want = tokens(en[key] && en[key].message);
  if (!want.length) continue;
  let i = m.index + 2, depth = 1;
  while (depth && i < panelSrc.length) {
    const c = panelSrc[i++];
    if (c === '(') depth++; else if (c === ')') depth--;
  }
  const call = panelSrc.slice(m.index, i);
  const line = panelSrc.slice(0, m.index).split('\n').length;
  if (/,\s*\{[^}]*\}\s*\)$/.test(call)) { checks++; continue; } // filled via subs object
  const used = [];
  let rest = panelSrc.slice(i, i + 800), r;
  while ((r = /^\s*\.replace\(\s*(?:'\$(\w+)\$'|\/\\\$(\w+)\\\$\/gi?)/.exec(rest))) {
    const name = r[1] || r[2];
    if (r[1]) assert.strictEqual(name, name.toUpperCase(), `panel.js:${line} ${key}: use upper-case '$${name.toUpperCase()}$'`);
    used.push(name.toUpperCase());
    let j = r[0].length, d = 1;
    while (d && j < rest.length) {
      const c = rest[j++];
      if (c === '(') d++; else if (c === ')') d--;
    }
    rest = rest.slice(j);
  }
  const missing = want.filter((tk) => !used.includes(tk));
  assert.deepStrictEqual(missing, [], `panel.js:${line} ${key}: placeholders never filled: ${missing.join(', ')}`);
  checks++;
}

console.log(`i18n placeholder tests passed (${locales.length} locales, ${checks} checks).`);

// 4. No dead keys: every message is used by the code (manifest uses __MSG_name__).
{
  const code = [...require('./panel_source').panelFiles(), 'panel.html', 'popup.js', 'popup.html', 'background.js', 'content.js', 'welcome.html', 'welcome.js', 'manifest.json']
    .map(read).join('\n');
  const dead = Object.keys(en).filter((k) => !new RegExp('(?<![A-Za-z0-9])' + k + '(?![A-Za-z0-9])').test(code));
  assert.deepStrictEqual(dead, [], 'unused message keys: ' + dead.join(', '));
}
