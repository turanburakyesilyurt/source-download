/* Source Download — every element id the scripts look up must exist in the HTML.
 * Catches regressions like v1.14 dropping <div id="toast">, which silently broke
 * every panel notification.
 * Run: node tools/dom_ids_test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Ids that are looked up behind an `if (el)` guard for markup that no longer exists.
const KNOWN_OPTIONAL = new Set(['guide-version', 'tf-clear', 'tf-export-html']);

let checked = 0;
const { readPanelSource } = require('./panel_source');

for (const [js, html] of [['panel/*.js', 'panel.html'], ['popup.js', 'popup.html']]) {
  const src = js === 'panel/*.js' ? readPanelSource() : read(js);
  const markup = read(html);
  const inHtml = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const createdInJs = new Set([
    ...[...src.matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...src.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]),
  ]);
  const used = new Set([
    ...[...src.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
    ...[...src.matchAll(/querySelector\(\s*['"]#([\w-]+)['"]\s*\)/g)].map((m) => m[1]),
  ]);
  const missing = [...used].filter((id) => !inHtml.has(id) && !createdInJs.has(id) && !KNOWN_OPTIONAL.has(id));
  assert.deepStrictEqual(missing, [], `${js} looks up ids missing from ${html}: ${missing.join(', ')}`);
  checked += used.size;
}

// toast() can rebuild its container, but the markup must still ship it.
assert(/\bid="toast"/.test(read('panel.html')), 'panel.html must contain <div id="toast">');

console.log(`DOM id tests passed (${checked} ids).`);
