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

// Pulls the 8-byte values out of a ZIP64 extended information extra field.
function parseZip64Extra(bytes, off, len) {
  const out = {};
  let p = off;
  while (p + 4 <= off + len) {
    const head = new DataView(bytes.buffer, bytes.byteOffset + p, 4);
    const id = head.getUint16(0, true);
    const size = head.getUint16(2, true);
    if (id === 0x0001) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset + p + 4, size);
      if (size >= 8) out.rawSize = Number(dv.getBigUint64(0, true));
      if (size >= 16) out.compSize = Number(dv.getBigUint64(8, true));
      if (size >= 24) out.offset = Number(dv.getBigUint64(16, true));
    }
    p += 4 + size;
  }
  return out;
}

async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const drained = new Response(ds.readable).arrayBuffer();
  const writer = ds.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  return new Uint8Array(await drained);
}

// Reads local entries back out of a ZIP archive so we never depend on an
// external unzip tool. Returns [{ name, data(Uint8Array), method }].
async function readZip(bytes) {
  const entries = [];
  let off = 0;
  while (off + 30 <= bytes.length) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset + off, 30);
    if (dv.getUint32(0, true) !== 0x04034b50) break; // reached central directory
    const method = dv.getUint16(8, true);
    const nameLen = dv.getUint16(26, true);
    const extraLen = dv.getUint16(28, true);
    const name = new TextDecoder().decode(bytes.subarray(off + 30, off + 30 + nameLen));
    const z64 = parseZip64Extra(bytes, off + 30 + nameLen, extraLen);
    let compSize = dv.getUint32(18, true);
    let rawSize = dv.getUint32(22, true);
    if (compSize === 0xffffffff && z64.compSize !== undefined) compSize = z64.compSize;
    if (rawSize === 0xffffffff && z64.rawSize !== undefined) rawSize = z64.rawSize;

    const start = off + 30 + nameLen + extraLen;
    let data = bytes.subarray(start, start + compSize);
    if (method === 8) data = await inflateRaw(data);
    else assert.strictEqual(method, 0, 'unexpected compression method ' + method);
    assert.strictEqual(data.length, rawSize, 'uncompressed size matches header: ' + name);

    entries.push({ name, data, method });
    off = start + compSize;
  }
  // EOCD present?
  const tail = bytes.subarray(bytes.length - 22);
  const esig = new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
  assert.strictEqual(esig, 0x06054b50, 'missing EOCD record');
  return entries;
}

// End-to-end check with the platform's own unzip, which also verifies CRCs.
// Skipped silently where the binary isn't available.
function verifyWithSystemUnzip(bytes, label) {
  const { execFileSync } = require('child_process');
  const os = require('os');
  const path = require('path');
  const file = path.join(os.tmpdir(), 'source-download-test-' + Date.now() + '.zip');
  try {
    execFileSync('which', ['unzip'], { stdio: 'ignore' });
  } catch {
    return false;
  }
  fs.writeFileSync(file, bytes);
  try {
    execFileSync('unzip', ['-t', file], { stdio: 'pipe' });
    return true;
  } catch (e) {
    throw new Error('system unzip rejected the ' + label + ' archive: ' + e.message);
  } finally {
    fs.unlinkSync(file);
  }
}

async function main() {
  // ---------------- ZIP ----------------
  // A payload big and repetitive enough that deflate is guaranteed to win.
  const bigText = 'the quick brown fox jumps over the lazy dog. '.repeat(400);
  const sampleEntries = () => [
    { name: 'images/logo.svg', data: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>' },
    { name: 'css/style.css', data: textToBytes('body{color:red}') },
    { name: 'data.bin', data: new Uint8Array([0, 1, 2, 255, 128]) },
    { name: 'img.png', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' },
    { name: 'Ünïcode.txt', data: 'snowman: \u2603' },
    { name: 'js/app.js', data: bigText },
  ];

  const zipBytes = await SourceDownloadZip.createZip(sampleEntries());
  const entries = await readZip(zipBytes);
  assert.strictEqual(entries.length, 6, 'entry count');
  const byName = Object.fromEntries(entries.map((e) => [e.name, e.data]));
  const methodOf = Object.fromEntries(entries.map((e) => [e.name, e.method]));
  assert.deepStrictEqual(Array.from(byName['data.bin']), [0, 1, 2, 255, 128], 'binary payload');
  assert.strictEqual(new TextDecoder().decode(byName['css/style.css']), 'body{color:red}', 'css payload');
  assert.strictEqual(byName['img.png'].length, 70, 'base64 payload decoded');
  assert.strictEqual(new TextDecoder().decode(byName['Ünïcode.txt']), 'snowman: \u2603', 'unicode name/content');
  assert.strictEqual(new TextDecoder().decode(byName['js/app.js']), bigText, 'large text round-trips');
  assert.strictEqual(methodOf['img.png'], 0, 'precompressed extension stays stored');
  assert.strictEqual(methodOf['data.bin'], 0, 'tiny payload stays stored');
  if (SourceDownloadZip.deflateSupported) {
    assert.strictEqual(methodOf['js/app.js'], 8, 'compressible payload is deflated');
    const stored = await SourceDownloadZip.createZip(sampleEntries(), null, { compress: false });
    assert.ok(zipBytes.length < stored.length, 'deflate shrinks the archive');
    const stored2 = await readZip(stored);
    assert.ok(stored2.every((e) => e.method === 0), 'compress:false stores everything');
    assert.strictEqual(
      new TextDecoder().decode(stored2.find((e) => e.name === 'js/app.js').data),
      bigText,
      'stored archive round-trips'
    );
    verifyWithSystemUnzip(stored, 'stored');
  }
  console.log(
    '  - ZIP: 6 entries, unicode + base64 + binary payloads, deflate ' +
    (SourceDownloadZip.deflateSupported ? 'on (' + zipBytes.length + ' bytes)' : 'unavailable') + ' OK'
  );

  // ZIP64 records, forced on so the 64-bit path is exercised without
  // allocating a 4 GiB archive.
  const z64 = await SourceDownloadZip.createZip(sampleEntries(), null, { forceZip64: true });
  const z64Entries = await readZip(z64);
  assert.strictEqual(z64Entries.length, 6, 'zip64 entry count');
  assert.strictEqual(
    new TextDecoder().decode(z64Entries.find((e) => e.name === 'js/app.js').data),
    bigText,
    'zip64 payload round-trips'
  );
  const z64sig = new DataView(z64.buffer, z64.byteOffset).getUint32(z64.length - 22 - 20 - 56, true);
  assert.strictEqual(z64sig, 0x06064b50, 'ZIP64 end-of-central-directory record present');
  const checkedZip64 = verifyWithSystemUnzip(z64, 'zip64');
  console.log('  - ZIP64: 64-bit sizes, locator + EOCD' + (checkedZip64 ? ', system unzip verified' : ''));

  const checkedMain = verifyWithSystemUnzip(zipBytes, 'default');
  if (checkedMain) console.log('  - ZIP: system unzip verified CRCs on the default archive');

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
  const xEntries = await readZip(xlsxBytes);
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
  const metaFnSrc = panelSrc.match(/function textCaptureExpr\(mode, query\) \{[\s\S]*?\n\}/)[0];
  const fullFnSrc = panelSrc.match(/function tableFullExpr\(sig\) \{[\s\S]*?\n\}/)[0];
  const { textCaptureExpr, tableFullExpr } = new Function(
    metaFnSrc + '\n' + fullFnSrc + '\nreturn { textCaptureExpr, tableFullExpr };'
  )();

  function cell(text) {
    return { nodeType: 1, tagName: 'TD', innerText: text, textContent: text, childNodes: [{ nodeType: 3, textContent: text }], parentElement: null, getAttribute: () => null, querySelectorAll: () => [] };
  }
  function row(text, cells) {
    return { nodeType: 1, tagName: 'TR', innerText: text, childNodes: [], parentElement: null, getAttribute: () => null, querySelectorAll: (s) => (s === 'th, td, [role=cell], [role=columnheader], [role=rowheader]' ? cells : []) };
  }
  const txtNode = (t) => ({ nodeType: 3, textContent: t });
  const el = (tagName, text, parentElement) => ({
    nodeType: 1, tagName, innerText: text, textContent: text,
    childNodes: [txtNode(text)], parentElement: parentElement || null, getAttribute: () => null,
  });
  const h1 = el('H1', 'Welcome');
  const h3 = el('H3', 'Pricing');
  const p = el('P', 'Hello world');
  const nestedP = el('P', 'Nested dup', p);
  const div = el('DIV', 'Card title');
  const li = el('LI', 'Custom item');
  const tr1 = row('Name Alice', [cell('Name'), cell('Alice')]);
  const tr2 = row('Age 30', [cell('Age'), cell('30')]);
  const tableEl = {
    nodeType: 1,
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
  const walk = new Function('return ' + textCaptureExpr('all', ''))();
  const blocks = walk.blocks;

  assert.strictEqual(blocks.length, 6, 'blocks in DOM order: h1, div, h3, p, table, li');
  assert.deepStrictEqual({ kind: blocks[0].kind, text: blocks[0].text }, { kind: 'h1', text: 'Welcome' }, 'first block = H1');
  assert.strictEqual(blocks[1].kind, 'div', 'div captured as an element block');
  assert.strictEqual(blocks[1].text, 'Card title', 'div text captured');
  assert.strictEqual(blocks[2].kind, 'h3', 'third block = H3');
  assert.strictEqual(blocks[3].kind, 'p', 'paragraph block');
  assert.strictEqual(blocks[4].kind, 'table', 'table block');
  assert.strictEqual(blocks[4].rowCount, 2, 'table row count');
  assert.deepStrictEqual(blocks[4].preview[0], ['Name', 'Alice'], 'table preview rows');
  assert.strictEqual(blocks[5].kind, 'li', 'li captured from the walker');
  assert.ok(!blocks.some((b) => b.text === 'Nested dup'), 'nested <p> inside <p> skipped');
  assert.ok(blocks[4].sig.length > 0, 'table signature present');
  assert.strictEqual(walk.error, '', 'plain walk reports no error');

  // CSS selector mode resolves against the page and returns only the matches.
  global.document = { querySelectorAll: (sel) => (sel === 'li.item' ? [li] : []) };
  const cssRes = new Function('return ' + textCaptureExpr('css', 'li.item'))();
  assert.strictEqual(cssRes.blocks.length, 1, 'css query returns only matches');
  assert.strictEqual(cssRes.blocks[0].kind, 'li', 'css match keeps its element name');
  assert.strictEqual(cssRes.blocks[0].matched, true, 'css match is flagged');

  // A broken selector surfaces the page's own message instead of failing mute.
  global.document = { querySelectorAll: () => { throw new Error("'???' is not a valid selector"); } };
  const cssBad = new Function('return ' + textCaptureExpr('css', '???'))();
  assert.ok(/not a valid selector/.test(cssBad.error), 'invalid selector reports the page error');
  assert.deepStrictEqual(cssBad.blocks, [], 'invalid selector yields no blocks');

  // XPath: node sets, attribute nodes and scalar expressions.
  const savedXPathResult = global.XPathResult;
  global.XPathResult = { ANY_TYPE: 0, NUMBER_TYPE: 1, STRING_TYPE: 2, BOOLEAN_TYPE: 3, ORDERED_NODE_SNAPSHOT_TYPE: 7 };
  global.document = {
    evaluate: (q, ctx, resolver, type) => {
      if (type === 7) {
        if (q === '//p') return { snapshotLength: 1, snapshotItem: () => p };
        if (q === '//@href') {
          return { snapshotLength: 1, snapshotItem: () => ({ nodeType: 2, nodeName: 'href', nodeValue: 'https://example.com' }) };
        }
        throw new Error('The result is not a node set');
      }
      return { resultType: 1, numberValue: 42 };
    },
  };
  const xpNodes = new Function('return ' + textCaptureExpr('xpath', '//p'))();
  assert.strictEqual(xpNodes.blocks.length, 1, 'xpath node set returns the element');
  assert.strictEqual(xpNodes.blocks[0].text, 'Hello world', 'xpath element text');

  const xpAttr = new Function('return ' + textCaptureExpr('xpath', '//@href'))();
  assert.strictEqual(xpAttr.blocks[0].kind, 'attr', 'attribute nodes are captured');
  assert.strictEqual(xpAttr.blocks[0].text, 'https://example.com', 'attribute value captured');

  const xpCount = new Function('return ' + textCaptureExpr('xpath', 'count(//a)'))();
  assert.strictEqual(xpCount.blocks[0].kind, 'value', 'scalar xpath falls back to a value block');
  assert.strictEqual(xpCount.blocks[0].text, '42', 'scalar xpath result');
  assert.strictEqual(xpCount.error, '', 'scalar xpath is not an error');
  global.XPathResult = savedXPathResult;

  // tableFullExpr(sig) must return every row for the matching table.
  global.document = {
    querySelectorAll: (sel) => (sel === 'table, [role=table]' ? [tableEl] : []),
  };
  const full = new Function('return ' + tableFullExpr(blocks[4].sig))();
  global.document = savedDocument;
  global.NodeFilter = savedNodeFilter;
  assert.deepStrictEqual(full, [['Name', 'Alice'], ['Age', '30']], 'table full rows');
  console.log('  - Text capture: DOM walk, nested-skip, tables, CSS selector, XPath nodes/attrs/scalars OK');

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

  // Segments are downloaded in parallel, so make sure out-of-order completion
  // still produces a byte stream in playlist order.
  const SEGS = 25;
  const orderedPlaylist = ['#EXTM3U']
    .concat(...Array.from({ length: SEGS }, (_, i) => ['#EXTINF:4.0,', 'seg-' + i + '.ts']))
    .concat('#EXT-X-ENDLIST')
    .join('\n');
  let inFlight = 0;
  let peakInFlight = 0;
  const ordered = await H.combine('https://cdn.example.com/live/media.m3u8', {
    text: async (u) => (u.endsWith('media.m3u8') ? orderedPlaylist : null),
    bytes: async (u) => {
      inFlight++;
      peakInFlight = Math.max(peakInFlight, inFlight);
      const idx = Number(u.match(/seg-(\d+)\.ts$/)[1]);
      // Later segments resolve first — the worst case for ordering.
      await new Promise((r) => setTimeout(r, (SEGS - idx) % 7));
      inFlight--;
      return t('[' + idx + ']');
    },
  });
  assert.strictEqual(ordered.segments, SEGS, 'all segments merged');
  assert.strictEqual(
    new TextDecoder().decode(ordered.bytes),
    Array.from({ length: SEGS }, (_, i) => '[' + i + ']').join(''),
    'segments merged in playlist order despite out-of-order completion'
  );
  assert.ok(peakInFlight > 1, 'segments are fetched in parallel');
  const missing = await H.combine('https://cdn.example.com/live/media.m3u8', {
    text: async (u) => (u.endsWith('media.m3u8') ? orderedPlaylist : null),
    bytes: async (u) => (u.endsWith('seg-9.ts') ? null : t('x')),
  }).catch((e) => e);
  assert.ok(missing instanceof Error && /segment 10 of 25/.test(missing.message), 'failed segment reported by index');
  console.log('  - HLS: ' + peakInFlight + '-way parallel fetch, playlist order preserved, failure reporting OK');

  // ---------------- Archive worker protocol ----------------
  const vm = require('vm');
  const path = require('path');
  const workerSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'zip-worker.js'), 'utf8');
  const posted = [];
  const sandbox = {
    importScripts: () => {},           // the libs are already loaded in-process
    postMessage: (m) => posted.push(m),
    Date, TextEncoder, TextDecoder, Response, Blob, atob, setTimeout,
    CompressionStream: typeof CompressionStream !== 'undefined' ? CompressionStream : undefined,
    SourceDownloadZip,
    SourceDownloadXlsx,
    SourceDownloadBeautify,
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(workerSrc, sandbox);

  await sandbox.self.onmessage({ data: { id: 7, kind: 'zip', entries: sampleEntries() } });
  const doneMsgs = posted.filter((m) => m.type === 'done');
  assert.strictEqual(doneMsgs.length, 1, 'worker posts exactly one done message');
  assert.strictEqual(doneMsgs[0].id, 7, 'worker echoes the job id');
  assert.ok(posted.some((m) => m.type === 'progress'), 'worker reports progress');
  assert.ok(posted.every((m) => m.id === 7), 'every message carries the job id');
  const workerEntries = await readZip(doneMsgs[0].blob);
  assert.strictEqual(workerEntries.length, 6, 'worker-built archive has every entry');

  posted.length = 0;
  await sandbox.self.onmessage({ data: { id: 8, kind: 'xlsx', sheets: [{ name: 'S1', rows: [['a', 1]] }] } });
  const xlsxDone = posted.find((m) => m.type === 'done');
  assert.ok(xlsxDone && xlsxDone.id === 8, 'worker builds XLSX jobs too');

  posted.length = 0;
  await sandbox.self.onmessage({ data: { id: 9, kind: 'zip', entries: [{ name: 'bad', data: 42 }] } });
  const errMsg = posted.find((m) => m.type === 'error');
  assert.ok(errMsg && errMsg.id === 9 && errMsg.message, 'worker reports failures instead of hanging');

  posted.length = 0;
  await sandbox.self.onmessage({ data: { id: 99, kind: 'beautify', lang: 'js', text: 'x' } });
  assert.ok(posted.find((m) => m.type === 'error'), 'archive worker rejects CPU jobs');
  console.log('  - Archive worker: zip + xlsx jobs, progress, id echo, error reporting OK');

  // ---------------- CPU jobs worker (beautify / index / hash / imageSize) ----------------
  const jobsSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'jobs-worker.js'), 'utf8');
  const jobsPosted = [];
  const jobsBox = {
    importScripts: () => {},
    postMessage: (m) => jobsPosted.push(m),
    Date, TextEncoder, TextDecoder, Response, Blob, atob, setTimeout, Uint8Array, ArrayBuffer,
    SourceDownloadBeautify,
    createImageBitmap: async () => ({ width: 12, height: 8, close() {} }),
  };
  jobsBox.self = jobsBox;
  vm.createContext(jobsBox);
  vm.runInContext(jobsSrc, jobsBox);

  jobsPosted.length = 0;
  await jobsBox.self.onmessage({
    data: { id: 10, kind: 'beautify', lang: 'js', text: 'function f(){return 1;}' },
  });
  const beautified = jobsPosted.find((m) => m.type === 'done');
  assert.ok(beautified && beautified.id === 10, 'jobs worker formats code off-thread');
  assert.ok(beautified.blob.includes('\n'), 'formatted output is actually expanded');

  jobsPosted.length = 0;
  await jobsBox.self.onmessage({ data: { id: 11, kind: 'beautify', lang: 'nope', text: 'x' } });
  assert.ok(jobsPosted.find((m) => m.type === 'error'), 'unknown formatter reports an error');

  jobsPosted.length = 0;
  await jobsBox.self.onmessage({ data: { id: 12, kind: 'index', text: 'Hello WORLD' } });
  const indexed = jobsPosted.find((m) => m.type === 'done');
  assert.strictEqual(indexed && indexed.blob, 'hello world', 'index lowercases text');

  jobsPosted.length = 0;
  await jobsBox.self.onmessage({
    data: { id: 13, kind: 'index', bytes: new TextEncoder().encode('AbC'), cap: 2 },
  });
  const capped = jobsPosted.find((m) => m.type === 'done');
  assert.strictEqual(capped && capped.blob, 'ab', 'index decodes bytes and honours cap');

  jobsPosted.length = 0;
  await jobsBox.self.onmessage({ data: { id: 14, kind: 'hash', bytes: new Uint8Array([1, 2, 3, 4]) } });
  const hashed = jobsPosted.find((m) => m.type === 'done');
  assert.ok(hashed && typeof hashed.blob === 'string' && hashed.blob.endsWith(':4'), 'hash returns digest:length');

  jobsPosted.length = 0;
  await jobsBox.self.onmessage({
    data: { id: 15, kind: 'imageSize', bytes: new Uint8Array([1, 2, 3, 4]), mime: 'image/png' },
  });
  const sized = jobsPosted.find((m) => m.type === 'done');
  assert.ok(sized && sized.blob, 'imageSize posts a result');
  assert.strictEqual(sized.blob.width, 12, 'imageSize width');
  assert.strictEqual(sized.blob.height, 8, 'imageSize height');

  jobsPosted.length = 0;
  await jobsBox.self.onmessage({ data: { id: 16, kind: 'nope' } });
  assert.ok(jobsPosted.find((m) => m.type === 'error'), 'unknown CPU job reports an error');
  console.log('  - Jobs worker: beautify + index + hash + imageSize OK');

  console.log('\nAll lib tests passed.');
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message);
  process.exit(1);
});
