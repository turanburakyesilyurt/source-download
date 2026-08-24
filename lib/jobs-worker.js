/*
 * Source Download — CPU jobs worker.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Runs work that used to stall the DevTools panel: code formatting, the
 * content-search index (decode + lowercase), image-duplicate hashing, and
 * image dimension decode via createImageBitmap / OffscreenCanvas.
 *
 * Kept separate from the archive worker so a multi-megabyte ZIP build and a
 * Beautify / index pass can run at the same time.
 *
 * Protocol
 *   in : { id, kind: 'beautify', lang, text }
 *        { id, kind: 'index',    text? , bytes?, cap? }
 *        { id, kind: 'hash',     bytes }
 *        { id, kind: 'imageSize', bytes, mime? }
 *   out: { id, type: 'done', blob }
 *        { id, type: 'error', message }
 */
'use strict';

importScripts('beautify.js');

var INDEX_CAP = 400000;
var HASH_HEAD = 8192;
var HASH_TAIL = 256;

function toU8(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (bytes && bytes.buffer) return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return null;
}

function indexText(text, cap) {
  var s = String(text || '');
  var limit = cap > 0 ? cap : INDEX_CAP;
  if (s.length > limit) s = s.slice(0, limit);
  return s.toLowerCase();
}

function hashBytes(bytes) {
  var b = toU8(bytes);
  if (!b) throw new Error('hash: no bytes');
  var h = 2166136261;
  var n = Math.min(b.length, HASH_HEAD);
  var i;
  for (i = 0; i < n; i++) {
    h ^= b[i];
    h = Math.imul(h, 16777619);
  }
  if (b.length > HASH_HEAD) {
    var start = Math.max(n, b.length - HASH_TAIL);
    for (i = start; i < b.length; i++) {
      h ^= b[i];
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0).toString(16) + ':' + b.length;
}

async function measureImage(bytes, mime) {
  var u8 = toU8(bytes);
  if (!u8) throw new Error('imageSize: no bytes');
  var blob = new Blob([u8], mime ? { type: mime } : undefined);

  if (typeof createImageBitmap === 'function') {
    var bmp = await createImageBitmap(blob);
    var out = { width: bmp.width, height: bmp.height };
    if (bmp.close) bmp.close();
    return out;
  }

  // createImageBitmap is the decode API; OffscreenCanvas is the fallback
  // rasteriser when a bitmap factory exists on the canvas itself.
  if (typeof OffscreenCanvas === 'function') {
    var canvas = new OffscreenCanvas(1, 1);
    if (typeof createImageBitmap === 'function') {
      var drawn = await createImageBitmap(blob);
      canvas.width = drawn.width;
      canvas.height = drawn.height;
      var ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(drawn, 0, 0);
      var size = { width: drawn.width, height: drawn.height };
      if (drawn.close) drawn.close();
      return size;
    }
  }
  throw new Error('image decode unavailable in worker');
}

self.onmessage = async function (event) {
  var msg = event.data || {};
  var id = msg.id;
  try {
    var blob;
    if (msg.kind === 'beautify') {
      var format = self.SourceDownloadBeautify[msg.lang];
      if (!format) throw new Error('unknown format: ' + msg.lang);
      blob = format(msg.text);
    } else if (msg.kind === 'index') {
      var raw = '';
      if (typeof msg.text === 'string') {
        raw = msg.text;
      } else if (msg.bytes) {
        raw = new TextDecoder('utf-8').decode(toU8(msg.bytes));
      }
      blob = indexText(raw, msg.cap);
    } else if (msg.kind === 'hash') {
      blob = hashBytes(msg.bytes);
    } else if (msg.kind === 'imageSize') {
      blob = await measureImage(msg.bytes, msg.mime);
    } else {
      throw new Error('unknown job: ' + msg.kind);
    }
    self.postMessage({ id: id, type: 'done', blob: blob });
  } catch (err) {
    self.postMessage({
      id: id,
      type: 'error',
      message: (err && err.message) || 'job failed',
    });
  }
};
