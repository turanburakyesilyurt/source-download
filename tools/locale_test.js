/* Source Download — shared locale resolver tests.
 * Run: node tools/locale_test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
globalThis.chrome = { i18n: { getUILanguage: () => 'zh-HK' } };
require(path.join(ROOT, 'lib/locale.js'));
const L = globalThis.SourceDownloadLocale;

const dirs = fs.readdirSync(path.join(ROOT, '_locales')).filter((d) => !d.startsWith('.')).sort();
assert.deepStrictEqual([...L.SUPPORTED].sort(), dirs, 'SUPPORTED must match the _locales folders');

const cases = {
  'zh-HK': 'zh_TW', 'zh-Hant-TW': 'zh_TW', 'zh-CN': 'zh_CN', zh: 'zh_CN',
  'pt-PT': 'pt_PT', pt: 'pt_BR', 'pt-BR': 'pt_BR',
  'es-MX': 'es_419', 'es-ES': 'es', 'en-AU': 'en_GB', 'en-US': 'en_US', en: 'en',
  nb: 'no', 'nn-NO': 'no', tl: 'fil', 'tr-TR': 'tr', TR: 'tr', 'xx-YY': 'en', '': 'en',
};
for (const [input, want] of Object.entries(cases)) {
  assert.strictEqual(L.normalize(input), want, `normalize(${JSON.stringify(input)})`);
}
assert.strictEqual(L.resolve('auto'), 'zh_TW', 'auto follows the browser UI language');
assert.strictEqual(L.resolve('de'), 'de');
assert.strictEqual(L.fill('A $count$ / $COUNT$ $name$', { count: 2, name: '$&x' }), 'A 2 / 2 $&x');

// No surface may carry its own locale list or resolver again.
for (const f of [...require('./panel_source').panelFiles(), 'popup.js', 'background.js', 'content.js']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  assert(!/\["am", "ar", "bg"/.test(src), `${f} must use SourceDownloadLocale.SUPPORTED`);
}

console.log(`Locale resolver tests passed (${Object.keys(cases).length} cases).`);
