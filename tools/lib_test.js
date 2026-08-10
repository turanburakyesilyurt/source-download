'use strict';
/*
 * Source Download — self-contained test suite for the dependency-free libs.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 * Run with: npm test   (or: node tools/lib_test.js)
 */
const assert = require('assert');
const fs = require('fs');

require('../lib/zip.js');
require('../lib/beautify.js');
require('../lib/xlsx.js');
require('../lib/hls.js');

function textToBytes(s) { return new TextEncoder().encode(s); }

// Reads local entries back out of a ZIP archive so we never depend on an
// external unzip tool. Returns [{ name, data(Uint8Array) }].
function readZip(bytes) {
  const entries = [];
  let off = 0;
  while (off + 4 <= bytes.length) {
    const sig = new DataView(bytes.buffer, bytes.byteOffset + off, 4).getUint32(0, true);
    if (sig !== 0x04034b50) break; // reached central directory
    const dv = new DataView(bytes.buffer, bytes.byteOffset + off, 30);
    const method = dv.getUint16(8, true);
    const size = dv.getUint32(22, true);
    const nameLen = dv.getUint16(26, true);
    const extraLen = dv.getUint16(28, true);
    const name = new TextDecoder().decode(bytes.subarray(off + 30, off + 30 + nameLen));
    const data = bytes.subarray(off + 30 + nameLen + extraLen, off + 30 + nameLen + extraLen + size);
    assert.strictEqual(method, 0, 'expected store method');
    entries.push({ name, data });
    off += 30 + nameLen + extraLen + size;
  }
  // EOCD present?
  const tail = bytes.subarray(bytes.length - 22);
  const esig = new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
  assert.strictEqual(esig, 0x06054b50, 'missing EOCD record');
  return entries;
}

async function main() {
  // ---------------- ZIP ----------------
  const zipBytes = await SourceDownloadZip.createZip([
    { name: 'images/logo.svg', data: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>' },
    { name: 'css/style.css', data: textToBytes('body{color:red}') },
    { name: 'data.bin', data: new Uint8Array([0, 1, 2, 255, 128]) },
    { name: 'img.png', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' },
    { name: 'Ünïcode.txt', data: 'snowman: \u2603' },
  ]);
  const entries = readZip(zipBytes);
  assert.strictEqual(entries.length, 5, 'entry count');
  const byName = Object.fromEntries(entries.map((e) => [e.name, e.data]));
  assert.deepStrictEqual(Array.from(byName['data.bin']), [0, 1, 2, 255, 128], 'binary payload');
  assert.strictEqual(new TextDecoder().decode(byName['css/style.css']), 'body{color:red}', 'css payload');
  assert.strictEqual(byName['img.png'].length, 70, 'base64 payload decoded');
  assert.strictEqual(new TextDecoder().decode(byName['Ünïcode.txt']), 'snowman: \u2603', 'unicode name/content');
  console.log('  - ZIP: 5 entries, store method, unicode + base64 + binary payloads OK');

  // ---------------- CSS ----------------
  const css = '.a{color:red;background:url("x.png");}@media(max-width:600px){.b{display:none}}';
  const cssOut = SourceDownloadBeautify.css(css);
  assert.ok(cssOut.startsWith('.a {'), 'css brace spacing');
  assert.ok(cssOut.includes('\n  color:red;'), 'css indent');
  assert.ok(!cssOut.includes('url("x.png")') === false || cssOut.includes('url("x.png")'), 'css url preserved');
  console.log('  - CSS formatter');

  // ---------------- JS ----------------
  const js = 'function greet(name){if(name){return "Hello, "+name;}return "Hi";}const a={x:1,y:[1,2,3]};a.x++;';
  const jsOut = SourceDownloadBeautify.js(js);
  assert.ok(jsOut.includes('function greet(name) {'), 'js brace spacing');
  assert.ok(jsOut.includes('\n  if(name) {'), 'js indent');
  // Round-trip: beautified code must still compile.
  // eslint-disable-next-line no-new-func
  new Function(jsOut);
  console.log('  - JS formatter + round-trip compile');

  // ---------------- HTML ----------------
  const html = '<!doctype html><html><head><title>T</title></head><body><div class="x"><p>Hello <b>world</b></p><img src="a.png"></div><script>if(a){b();}</script></body></html>';
  const htmlOut = SourceDownloadBeautify.html(html);
  assert.ok(htmlOut.includes('<!doctype html>'), 'html doctype preserved');
  assert.ok(htmlOut.includes('\n    <title>'), 'html indent');
  assert.ok(htmlOut.includes('if(a){b();}'), 'script body preserved');
  console.log('  - HTML formatter');

  // ---------------- JSON ----------------
  const jsonOut = SourceDownloadBeautify.json('{"a":1,"b":{"c":[1,2,{"d":true}]}}');
  assert.deepStrictEqual(JSON.parse(jsonOut), { a: 1, b: { c: [1, 2, { d: true }] } }, 'json round-trip');
  assert.ok(jsonOut.includes('\n  "a": 1'), 'json indent');
  assert.strictEqual(SourceDownloadBeautify.json('not json'), 'not json', 'json invalid -> raw');
  console.log('  - JSON formatter + invalid fallback');

  // ---------------- XLSX ----------------
  const xlsxBytes = await SourceDownloadXlsx.build([
    {
      name: 'Table 1',
      rows: [
        ['Name', 'Age', 'Score'],
        ['Alice', 30, 99.5],
        ['Bob', 'twenty-five', 0],
      ],
    },
    { name: 'Ünïcode & "quotes"', rows: [['a<b&c', 1]] },
  ]);
  assert.ok(xlsxBytes instanceof Uint8Array, 'xlsx returns Uint8Array in Node');
  const xEntries = readZip(xlsxBytes);
  const xBy = Object.fromEntries(xEntries.map((e) => [e.name, new TextDecoder().decode(e.data)]));
  assert.ok(xBy['[Content_Types].xml'].includes('xl/workbook.xml'), 'content types part');
  assert.ok(xBy['xl/workbook.xml'].includes('Table 1'), 'sheet name in workbook');
  assert.ok(xBy['xl/workbook.xml'].includes('&quot;quotes&quot;'), 'sheet name xml-escaped');
  const sheet1 = xBy['xl/worksheets/sheet1.xml'];
  assert.ok(sheet1.includes('t="inlineStr"'), 'string cell type');
  assert.ok(sheet1.includes('<v>30</v>'), 'numeric cell');
  assert.ok(sheet1.includes('r="A1"'), 'cell reference');
  const sheet2 = xBy['xl/worksheets/sheet2.xml'];
  assert.ok(sheet2.includes('a&lt;b&amp;c'), 'cell content xml-escaped');
  console.log('  - XLSX: workbook + sheet parts, escaping, numeric/inline cells OK');

  // ---------------- Text capture expressions (embedded in panel.js) ----------------
  // The panel scans the live page by evaluating these expressions with
  // inspectedWindow.eval(). Pull them out of panel.js verbatim so a regression
  // in the capture logic (headings/paragraphs/tables/CSS selector) fails the
  // test suite instead of silently producing an empty Text tab.
  const panelSrc = fs.readFileSync('panel.js', 'utf8');
  const metaFnSrc = panelSrc.match(/function textMetaExpr\(cssSel\) \{[\s\S]*?\n\}/)[0];
  const fullFnSrc = panelSrc.match(/function tableFullExpr\(sig\) \{[\s\S]*?\n\}/)[0];
  const { textMetaExpr, tableFullExpr } = new Function(
    metaFnSrc + '\n' + fullFnSrc + '\nreturn { textMetaExpr, tableFullExpr };'
  )();

  function cell(text) {
    return { tagName: 'TD', innerText: text, textContent: text, childNodes: [{ nodeType: 3, textContent: text }], parentElement: null, getAttribute: () => null, querySelectorAll: () => [] };
  }
  function row(text, cells) {
    return { tagName: 'TR', innerText: text, childNodes: [], parentElement: null, getAttribute: () => null, querySelectorAll: (s) => (s === 'th, td, [role=cell], [role=columnheader], [role=rowheader]' ? cells : []) };
  }
  const txtNode = (t) => ({ nodeType: 3, textContent: t });
  const h1 = { tagName: 'H1', innerText: 'Welcome', textContent: 'Welcome', childNodes: [txtNode('Welcome')], parentElement: null, getAttribute: () => null };
  const h3 = { tagName: 'H3', innerText: 'Pricing', textContent: 'Pricing', childNodes: [txtNode('Pricing')], parentElement: null, getAttribute: () => null };
  const p = { tagName: 'P', innerText: 'Hello world', textContent: 'Hello world', childNodes: [txtNode('Hello world')], parentElement: null, getAttribute: () => null };
  const nestedP = { tagName: 'P', innerText: 'Nested dup', textContent: 'Nested dup', childNodes: [txtNode('Nested dup')], parentElement: p, getAttribute: () => null };
  const div = { tagName: 'DIV', innerText: 'Card title', textContent: 'Card title', childNodes: [txtNode('Card title')], parentElement: null, getAttribute: () => null };
  const li = { tagName: 'LI', innerText: 'Custom item', textContent: 'Custom item', childNodes: [txtNode('Custom item')], parentElement: null, getAttribute: () => null };
  const tr1 = row('Name Alice', [cell('Name'), cell('Alice')]);
  const tr2 = row('Age 30', [cell('Age'), cell('30')]);
  const tableEl = {
    tagName: 'TABLE',
    innerText: 'Name Alice Age 30',
    childNodes: [],
    parentElement: null,
    getAttribute: () => null,
    querySelectorAll: (s) => (s === 'tr, [role=row]' ? [tr1, tr2] : []),
  };

  const savedDocument = global.document;
  const savedNodeFilter = global.NodeFilter;
  global.NodeFilter = { SHOW_ELEMENT: 1, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 };
  const elements = [h1, div, h3, p, tableEl, nestedP, li]; // DOM order
  let walkerFilter = null;
  global.document = {
    body: { tagName: 'BODY', childNodes: [], parentElement: null, getAttribute: () => null },
    createTreeWalker: (root, what, filter) => {
      walkerFilter = filter;
      let i = 0;
      return {
        nextNode: () => {
          while (i < elements.length) {
            const el = elements[i++];
            const r = walkerFilter.acceptNode(el);
            if (r === 1) return el; // FILTER_ACCEPT
            // FILTER_REJECT / FILTER_SKIP: skip this node in the flat list
          }
          return null;
        },
      };
    },
    querySelectorAll: (sel) => (sel === 'li.item' ? [li] : []),
  };
  const blocks = new Function('return ' + textMetaExpr('li.item'))();
  global.document = savedDocument;
  global.NodeFilter = savedNodeFilter;

  assert.strictEqual(blocks.length, 7, 'blocks in DOM order (h1, div, h3, p, table, li) + css');
  assert.deepStrictEqual({ kind: blocks[0].kind, text: blocks[0].text }, { kind: 'h1', text: 'Welcome' }, 'first block = H1');
  assert.strictEqual(blocks[1].kind, 'div', 'div captured as an element block');
  assert.strictEqual(blocks[1].text, 'Card title', 'div text captured');
  assert.strictEqual(blocks[2].kind, 'h3', 'third block = H3');
  assert.strictEqual(blocks[3].kind, 'p', 'paragraph block');
  assert.strictEqual(blocks[4].kind, 'table', 'table block');
  assert.strictEqual(blocks[4].rowCount, 2, 'table row count');
  assert.deepStrictEqual(blocks[4].preview[0], ['Name', 'Alice'], 'table preview rows');
  assert.strictEqual(blocks[5].kind, 'li', 'li captured from the walker');
  assert.strictEqual(blocks[6].kind, 'css', 'custom selector block');
  assert.strictEqual(blocks[6].selector, 'li.item', 'selector recorded');
  assert.ok(!blocks.some((b) => b.text === 'Nested dup'), 'nested <p> inside <p> skipped');
  assert.ok(blocks[4].sig.length > 0, 'table signature present');

  // tableFullExpr(sig) must return every row for the matching table.
  global.document = {
    querySelectorAll: (sel) => (sel === 'table, [role=table]' ? [tableEl] : []),
  };
  const full = new Function('return ' + tableFullExpr(blocks[4].sig))();
  global.document = savedDocument;
  assert.deepStrictEqual(full, [['Name', 'Alice'], ['Age', '30']], 'table full rows');
  console.log('  - Text capture expressions: all element kinds, nested-skip, tables, CSS selector OK');

  // ---------------- HLS ----------------
  const H = SourceDownloadHls;
  const master = [
    '#EXTM3U',
    '#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=1280x720',
    '720p/index.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=2560000,RESOLUTION=1920x1080',
    '1080p/index.m3u8',
  ].join('\n');
  const streams = H.parseMaster(master, 'https://cdn.example.com/master.m3u8');
  assert.strictEqual(streams.length, 2, 'master variants parsed');
  assert.strictEqual(streams[1].url, 'https://cdn.example.com/1080p/index.m3u8', 'variant URL resolved');
  assert.strictEqual(streams[1].resolution, '1920x1080', 'variant resolution');

  const media = [
    '#EXTM3U',
    '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"',
    '#EXTINF:10.0,',
    'seg-1.ts',
    '#EXTINF:9.5,',
    'seg-2.ts',
    '#EXT-X-ENDLIST',
  ].join('\n');
  const parsed = H.parseMedia(media, 'https://cdn.example.com/1080p/index.m3u8');
  assert.strictEqual(parsed.segments.length, 2, 'media segments parsed');
  assert.strictEqual(parsed.segments[0].url, 'https://cdn.example.com/1080p/seg-1.ts', 'segment URL resolved');
  assert.strictEqual(parsed.segments[0].duration, 10, 'segment duration');
  assert.strictEqual(parsed.encrypted, true, 'AES-128 detected');
  assert.strictEqual(parsed.endlist, true, 'endlist detected');

  const t = (s) => new TextEncoder().encode(s);
  const merge = await H.combine('https://cdn.example.com/master.m3u8', {
    text: async (u) => {
      if (u.endsWith('master.m3u8')) return master;
      if (u.endsWith('index.m3u8')) return media;
      return null;
    },
    bytes: async (u) => {
      if (u.endsWith('key.bin')) return t('KEY');
      if (u.endsWith('seg-1.ts')) return t('SEG1');
      if (u.endsWith('seg-2.ts')) return t('SEG2');
      return null;
    },
  }).catch((e) => e);
  assert.ok(merge instanceof Error, 'encrypted stream rejected with a clear error');
  assert.ok(/encrypted/i.test(merge.message), 'encryption error message');

  const mediaPlain = [
    '#EXTM3U',
    '#EXT-X-MAP:URI="init.mp4"',
    '#EXTINF:10.0,',
    'chunk-1.m4s',
    '#EXTINF:9.0,',
    'chunk-2.m4s',
    '#EXT-X-ENDLIST',
  ].join('\n');
  const mergePlain = await H.combine('https://cdn.example.com/live/media.m3u8', {
    text: async (u) => (u.endsWith('media.m3u8') ? mediaPlain : null),
    bytes: async (u) => {
      if (u.endsWith('init.mp4')) return t('INIT');
      if (u.endsWith('chunk-1.m4s')) return t('CH1');
      if (u.endsWith('chunk-2.m4s')) return t('CH2');
      return null;
    },
  }, () => {});
  assert.strictEqual(mergePlain.mime, 'video/mp4', 'fMP4 stream uses video/mp4 mime');
  assert.strictEqual(mergePlain.segments, 2, 'fMP4 segment count');
  assert.strictEqual(new TextDecoder().decode(mergePlain.bytes), 'INITCH1CH2', 'init + chunks merged in order');
  assert.strictEqual(mergePlain.live, false, 'endlist -> not live');
  console.log('  - HLS: master/media parsing, encryption rejection, fMP4 init + segment merge OK');

  console.log('\nAll lib tests passed.');
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message);
  process.exit(1);
});
