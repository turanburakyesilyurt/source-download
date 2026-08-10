/*
 * Source Download — minimal ZIP writer.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * A from-scratch, dependency-free implementation of the PKZIP / .ZIP archive
 * format. Files are stored with the "store" (no compression) method, which is
 * a fully valid ZIP entry type supported by every unzip tool and OS.
 *
 * Exposed globally as `SourceDownloadZip.createZip(entries, onProgress)` and
 * usable from both browser and Node.js:
 *
 *   entries: [{ name: "folder/file.png", data: string | Uint8Array |
 *                       ArrayBuffer | Blob | dataURL, date?: Date }]
 *
 * Returns a Promise<Blob> (application/zip) in the browser, or a raw
 * Uint8Array in Node.
 */
(function (root) {
  'use strict';

  var CRC_TABLE = (function () {
    var table = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    return table;
  })();

  function crc32(bytes) {
    var c = -1;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }

  function concat(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  function stringToBytes(s) {
    return new TextEncoder().encode(s);
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // Coerce an entry payload into a Uint8Array. Supports strings (plain text or
  // a "data:..." URL), ArrayBuffers, typed arrays and Blobs.
  async function toBytes(data) {
    if (data == null) return new Uint8Array(0);
    if (typeof data === 'string') {
      if (data.startsWith('data:')) {
        var comma = data.indexOf(',');
        var meta = comma === -1 ? '' : data.slice(0, comma);
        var body = comma === -1 ? data : data.slice(comma + 1);
        if (meta.indexOf(';base64') !== -1) return base64ToBytes(body);
        return stringToBytes(decodeURIComponent(body));
      }
      return stringToBytes(data);
    }
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
    throw new Error('Unsupported ZIP payload type: ' + typeof data);
  }

  function dosDateTime(date) {
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
      date:
        (((date.getFullYear() - 1980) & 0x7f) << 9) |
        ((date.getMonth() + 1) << 5) |
        date.getDate(),
    };
  }

  // Creates a ZIP archive. `onProgress` (optional) receives a fraction 0..1.
  async function createZip(entries, onProgress) {
    var localChunks = [];
    var centralChunks = [];
    var runningOffset = 0;
    var total = entries.length;

    for (var i = 0; i < total; i++) {
      var entry = entries[i];
      var nb = stringToBytes(entry.name);
      var db = await toBytes(entry.data);
      var crcv = crc32(db);
      var dtd = dosDateTime(entry.date instanceof Date ? entry.date : new Date());

      // Local file header + payload (method 0 = store).
      var lh = new Uint8Array(30 + nb.length);
      var lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);             // version needed
      lv.setUint16(6, 0x0800, true);         // general purpose flag: UTF-8 name
      lv.setUint16(8, 0, true);              // compression: store
      lv.setUint16(10, dtd.time, true);
      lv.setUint16(12, dtd.date, true);
      lv.setUint32(14, crcv, true);
      lv.setUint32(18, db.length, true);     // compressed size
      lv.setUint32(22, db.length, true);     // uncompressed size
      lv.setUint16(26, nb.length, true);
      lv.setUint16(28, 0, true);             // extra field length
      lh.set(nb, 30);
      localChunks.push(lh, db);

      // Central directory header.
      var ch = new Uint8Array(46 + nb.length);
      var cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 0x031e, true);         // version made by (unix)
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dtd.time, true);
      cv.setUint16(14, dtd.date, true);
      cv.setUint32(16, crcv, true);
      cv.setUint32(20, db.length, true);
      cv.setUint32(24, db.length, true);
      cv.setUint16(28, nb.length, true);
      cv.setUint16(30, 0, true);             // extra length
      cv.setUint16(32, 0, true);             // comment length
      cv.setUint16(34, 0, true);             // disk number start
      cv.setUint16(36, 0, true);             // internal attrs
      cv.setUint32(38, 0, true);             // external attrs
      cv.setUint32(42, runningOffset, true); // local header offset
      ch.set(nb, 46);
      centralChunks.push(ch);

      runningOffset += lh.length + db.length;
      if (onProgress && total > 1) onProgress((i + 1) / total);
    }

    // Assemble: [local entries][central directory][EOCD]
    var body = new Uint8Array(0);
    for (var b = 0; b < localChunks.length; b++) body = concat(body, localChunks[b]);
    var centralSize = 0;
    var centralBody = new Uint8Array(0);
    for (var c = 0; c < centralChunks.length; c++) {
      centralSize += centralChunks[c].length;
      centralBody = concat(centralBody, centralChunks[c]);
    }

    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, total, true);            // entries on this disk
    ev.setUint16(10, total, true);           // total entries
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, runningOffset, true);
    ev.setUint16(20, 0, true);               // comment length

    body = concat(body, centralBody);
    body = concat(body, eocd);

    if (onProgress) onProgress(1);
    if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
      return new Blob([body], { type: 'application/zip' });
    }
    return body; // Node fallback: raw Uint8Array
  }

  root.SourceDownloadZip = { createZip: createZip };
})(typeof self !== 'undefined' ? self : globalThis);
