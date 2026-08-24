/*
 * Source Download — minimal ZIP writer.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * A from-scratch, dependency-free implementation of the PKZIP / .ZIP archive
 * format. Entries are written with either the "store" (no compression) or the
 * "deflate" method; deflate is produced by the browser's native
 * CompressionStream, so there is still no third-party code involved.
 *
 * ZIP64 records are emitted automatically when an archive outgrows the classic
 * 32-bit limits (4 GiB of data or 65535 entries).
 *
 * Exposed globally as `SourceDownloadZip.createZip(entries, onProgress, opts)`
 * and usable from browsers, workers and Node.js:
 *
 *   entries: [{ name: "folder/file.png", data: string | Uint8Array |
 *                       ArrayBuffer | Blob | dataURL, date?: Date }]
 *   opts:    { compress?: boolean, forceZip64?: boolean }
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
    var table = CRC_TABLE;
    var c = -1;
    for (var i = 0, n = bytes.length; i < n; i++) {
      c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ -1) >>> 0;
  }

  var U16_MAX = 0xffff;
  var U32_MAX = 0xffffffff;
  var METHOD_STORE = 0;
  var METHOD_DEFLATE = 8;

  // Deflating an already-compressed payload burns CPU for nothing, so these
  // extensions skip straight to "store".
  var PRECOMPRESSED =
    /\.(?:png|jpe?g|jpe|gif|webp|avif|heic|heif|mp4|m4v|mov|webm|mkv|avi|flv|mp3|m4a|aac|ogg|oga|opus|flac|woff2?|zip|gz|tgz|br|bz2|xz|7z|rar|jar|pdf)$/i;

  // Below this, the deflate header outweighs anything it could save.
  var MIN_DEFLATE_BYTES = 64;

  var HAS_DEFLATE_RAW = (function () {
    try {
      new CompressionStream('deflate-raw');
      return true;
    } catch (e) {
      return false;
    }
  })();

  var IS_NODE =
    typeof process !== 'undefined' && !!(process.versions && process.versions.node);
  var IS_WORKER =
    typeof WorkerGlobalScope !== 'undefined' &&
    typeof self !== 'undefined' &&
    self instanceof WorkerGlobalScope;

  var ENCODER = new TextEncoder();

  function stringToBytes(s) {
    return ENCODER.encode(s);
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

  async function deflateRaw(bytes) {
    var cs = new CompressionStream('deflate-raw');
    // Start draining before writing so a large payload cannot deadlock on
    // stream backpressure.
    var drained = new Response(cs.readable).arrayBuffer();
    var writer = cs.writable.getWriter();
    await writer.write(bytes);
    await writer.close();
    return new Uint8Array(await drained);
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

  function setU64(dv, offset, value) {
    dv.setBigUint64(offset, BigInt(value), true);
  }

  function yieldToEventLoop() {
    return new Promise(function (resolve) {
      setTimeout(resolve, 0);
    });
  }

  function localHeader(e) {
    var extraLen = e.zip64 ? 20 : 0;
    var buf = new Uint8Array(30 + e.nameBytes.length + extraLen);
    var dv = new DataView(buf.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, e.zip64 ? 45 : 20, true);   // version needed to extract
    dv.setUint16(6, 0x0800, true);              // general purpose flag: UTF-8 name
    dv.setUint16(8, e.method, true);
    dv.setUint16(10, e.time, true);
    dv.setUint16(12, e.date, true);
    dv.setUint32(14, e.crc, true);
    dv.setUint32(18, e.zip64 ? U32_MAX : e.compSize, true);
    dv.setUint32(22, e.zip64 ? U32_MAX : e.rawSize, true);
    dv.setUint16(26, e.nameBytes.length, true);
    dv.setUint16(28, extraLen, true);
    buf.set(e.nameBytes, 30);
    if (e.zip64) {
      var o = 30 + e.nameBytes.length;
      dv.setUint16(o, 0x0001, true);            // ZIP64 extended information
      dv.setUint16(o + 2, 16, true);
      setU64(dv, o + 4, e.rawSize);
      setU64(dv, o + 12, e.compSize);
    }
    return buf;
  }

  function centralHeader(e) {
    // The central record repeats the sizes and adds the local header offset,
    // so its ZIP64 block carries one more field than the local one.
    var extraLen = e.zip64 ? 28 : 0;
    var buf = new Uint8Array(46 + e.nameBytes.length + extraLen);
    var dv = new DataView(buf.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 0x031e, true);              // version made by (unix)
    dv.setUint16(6, e.zip64 ? 45 : 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, e.method, true);
    dv.setUint16(12, e.time, true);
    dv.setUint16(14, e.date, true);
    dv.setUint32(16, e.crc, true);
    dv.setUint32(20, e.zip64 ? U32_MAX : e.compSize, true);
    dv.setUint32(24, e.zip64 ? U32_MAX : e.rawSize, true);
    dv.setUint16(28, e.nameBytes.length, true);
    dv.setUint16(30, extraLen, true);           // extra length
    dv.setUint16(32, 0, true);                  // comment length
    dv.setUint16(34, 0, true);                  // disk number start
    dv.setUint16(36, 0, true);                  // internal attrs
    dv.setUint32(38, 0, true);                  // external attrs
    dv.setUint32(42, e.zip64 ? U32_MAX : e.offset, true);
    buf.set(e.nameBytes, 46);
    if (e.zip64) {
      var o = 46 + e.nameBytes.length;
      dv.setUint16(o, 0x0001, true);
      dv.setUint16(o + 2, 24, true);
      setU64(dv, o + 4, e.rawSize);
      setU64(dv, o + 12, e.compSize);
      setU64(dv, o + 20, e.offset);
    }
    return buf;
  }

  function endRecords(count, centralSize, centralOffset, needZip64) {
    if (!needZip64) {
      var eocd = new Uint8Array(22);
      var ev = new DataView(eocd.buffer);
      ev.setUint32(0, 0x06054b50, true);
      ev.setUint16(4, 0, true);
      ev.setUint16(6, 0, true);
      ev.setUint16(8, count, true);
      ev.setUint16(10, count, true);
      ev.setUint32(12, centralSize, true);
      ev.setUint32(16, centralOffset, true);
      ev.setUint16(20, 0, true);
      return [eocd];
    }

    var z64 = new Uint8Array(56);
    var zv = new DataView(z64.buffer);
    zv.setUint32(0, 0x06064b50, true);          // ZIP64 end of central directory
    setU64(zv, 4, 44);                          // size of this record minus 12
    zv.setUint16(12, 0x031e, true);             // version made by
    zv.setUint16(14, 45, true);                 // version needed
    zv.setUint32(16, 0, true);                  // this disk
    zv.setUint32(20, 0, true);                  // disk with central directory
    setU64(zv, 24, count);
    setU64(zv, 32, count);
    setU64(zv, 40, centralSize);
    setU64(zv, 48, centralOffset);

    var loc = new Uint8Array(20);
    var lv = new DataView(loc.buffer);
    lv.setUint32(0, 0x07064b50, true);          // ZIP64 locator
    lv.setUint32(4, 0, true);
    setU64(lv, 8, centralOffset + centralSize); // where the ZIP64 EOCD starts
    lv.setUint32(16, 1, true);

    var tail = new Uint8Array(22);
    var tv = new DataView(tail.buffer);
    tv.setUint32(0, 0x06054b50, true);
    tv.setUint16(4, 0, true);
    tv.setUint16(6, 0, true);
    tv.setUint16(8, Math.min(count, U16_MAX), true);
    tv.setUint16(10, Math.min(count, U16_MAX), true);
    tv.setUint32(12, Math.min(centralSize, U32_MAX), true);
    tv.setUint32(16, Math.min(centralOffset, U32_MAX), true);
    tv.setUint16(20, 0, true);

    return [z64, loc, tail];
  }

  /*
   * Creates a ZIP archive.
   *
   * `onProgress` (optional) receives a fraction 0..1.
   * `options.compress`   — deflate compressible entries (default: true).
   * `options.forceZip64` — always emit ZIP64 records (used by the test suite).
   */
  async function createZip(entries, onProgress, options) {
    var opts = options || {};
    var compress = opts.compress !== false;
    var forceZip64 = !!opts.forceZip64;
    var list = entries || [];
    var total = list.length;

    // Chunks are handed to the Blob constructor as-is, which concatenates them
    // natively — no growing JS buffer, no quadratic copying.
    var chunks = [];
    var centralChunks = [];
    var offset = 0;
    var centralSize = 0;
    var needZip64 = forceZip64 || total > U16_MAX;

    for (var i = 0; i < total; i++) {
      var entry = list[i];
      var nameBytes = stringToBytes(entry.name);
      var raw = await toBytes(entry.data);
      var payload = raw;
      var method = METHOD_STORE;

      if (
        compress &&
        HAS_DEFLATE_RAW &&
        raw.length >= MIN_DEFLATE_BYTES &&
        !PRECOMPRESSED.test(entry.name)
      ) {
        try {
          var packed = await deflateRaw(raw);
          // Never let compression make an entry bigger.
          if (packed.length < raw.length) {
            payload = packed;
            method = METHOD_DEFLATE;
          }
        } catch (e) {
          /* keep the stored copy */
        }
      }

      var dt = dosDateTime(entry.date instanceof Date ? entry.date : new Date());
      var rec = {
        nameBytes: nameBytes,
        method: method,
        crc: crc32(raw),
        rawSize: raw.length,
        compSize: payload.length,
        offset: offset,
        time: dt.time,
        date: dt.date,
        zip64: forceZip64 || offset > U32_MAX || raw.length > U32_MAX || payload.length > U32_MAX,
      };
      if (rec.zip64) needZip64 = true;

      var lh = localHeader(rec);
      chunks.push(lh, payload);
      offset += lh.length + payload.length;

      var ch = centralHeader(rec);
      centralChunks.push(ch);
      centralSize += ch.length;

      if (onProgress && total > 1) onProgress((i + 1) / total);
      // On the main thread, let the UI breathe between entries. Compressed
      // entries already yield inside deflateRaw.
      if (!IS_WORKER && !IS_NODE && method === METHOD_STORE && (i & 31) === 31) {
        await yieldToEventLoop();
      }
    }

    if (offset > U32_MAX || centralSize > U32_MAX) needZip64 = true;

    var parts = chunks.concat(centralChunks, endRecords(total, centralSize, offset, needZip64));

    if (onProgress) onProgress(1);

    if (!IS_NODE && typeof Blob !== 'undefined') {
      return new Blob(parts, { type: 'application/zip' });
    }

    var size = 0;
    for (var p = 0; p < parts.length; p++) size += parts[p].length;
    var out = new Uint8Array(size);
    var at = 0;
    for (var q = 0; q < parts.length; q++) {
      out.set(parts[q], at);
      at += parts[q].length;
    }
    return out;
  }

  root.SourceDownloadZip = {
    createZip: createZip,
    deflateSupported: HAS_DEFLATE_RAW,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.SourceDownloadZip;
  }
})(typeof self !== 'undefined' ? self : globalThis);
