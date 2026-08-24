/*
 * Source Download — file type detection and extension repair.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Plenty of CDNs serve real files from extension-less URLs (YouTube
 * thumbnails, avatar services, image resizers) or from dynamic endpoints like
 * `/photo.aspx`. Saving those as-is leaves the user with files the OS refuses
 * to open, so this module decides an extension from the actual bytes, falling
 * back to the MIME type and finally to the resource category.
 *
 * It also holds the content sniffers used to reclassify "other" resources into
 * their real category, so the panel and the test suite share one source of
 * truth.
 *
 * Exposed globally as `SourceDownloadFileType` and usable from Node.
 */
(function (root) {
  'use strict';

  var MIME_EXT = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/svg+xml': 'svg', 'image/avif': 'avif', 'image/x-icon': 'ico', 'image/bmp': 'bmp',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/x-m4v': 'm4v', 'video/ogg': 'ogv',
    'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg',
    'audio/aac': 'aac', 'audio/mp4': 'm4a', 'audio/flac': 'flac', 'audio/webm': 'weba',
    'text/css': 'css', 'text/javascript': 'js', 'application/javascript': 'js',
    'font/woff2': 'woff2', 'font/woff': 'woff', 'application/font-woff': 'woff',
    'font/ttf': 'ttf', 'font/otf': 'otf', 'application/x-font-ttf': 'ttf',
    'application/vnd.ms-fontobject': 'eot',
    'application/json': 'json', 'application/manifest+json': 'webmanifest',
    'text/html': 'html', 'text/plain': 'txt',
    'application/pdf': 'pdf', 'text/xml': 'xml', 'application/xml': 'xml', 'text/csv': 'csv',
    'application/wasm': 'wasm',
    'text/vtt': 'vtt', 'application/x-subrip': 'srt', 'application/ttml+xml': 'ttml',
  };

  // Extensions trusted as-is when a URL already carries one.
  var KNOWN_EXTS = new Set([
    'png', 'jpg', 'jpeg', 'jpe', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'heic', 'heif', 'tif', 'tiff',
    'mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'flv', 'ogv', 'ts', 'm3u8', 'mpd',
    'mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'wav', 'weba',
    'js', 'mjs', 'cjs', 'css', 'json', 'jsonp', 'xml', 'html', 'htm', 'txt', 'md', 'csv', 'map',
    'woff', 'woff2', 'ttf', 'otf', 'eot',
    'pdf', 'wasm', 'zip', 'gz', 'br', 'webmanifest', 'vtt', 'srt', 'ttml', 'sbv', 'ass', 'ssa',
  ]);

  // Last-resort extension per resource category.
  var TYPE_FALLBACK_EXT = {
    image: 'png', svg: 'svg', video: 'mp4', audio: 'mp3', css: 'css', js: 'js',
    font: 'woff2', json: 'json', wasm: 'wasm', manifest: 'webmanifest',
    document: 'html', api: 'json', text: 'txt', caption: 'vtt', sourcemap: 'map',
  };

  function mimeExt(mime) {
    return MIME_EXT[String(mime || '').toLowerCase().split(';')[0].trim()] || '';
  }

  function toBytes(content) {
    if (content instanceof Uint8Array) return content;
    if (content instanceof ArrayBuffer) return new Uint8Array(content);
    if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    return null;
  }

  // Magic numbers -> extension. Only unambiguous signatures are listed.
  function extFromBytes(content) {
    var b = toBytes(content);
    if (!b || b.length < 4) return '';

    function ascii(i, s) {
      for (var k = 0; k < s.length; k++) if (b[i + k] !== s.charCodeAt(k)) return false;
      return true;
    }

    if (b[0] === 0x89 && ascii(1, 'PNG')) return 'png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
    if (ascii(0, 'GIF8')) return 'gif';
    if (ascii(0, 'RIFF') && b.length >= 12 && ascii(8, 'WEBP')) return 'webp';
    if (ascii(0, 'RIFF') && b.length >= 12 && ascii(8, 'WAVE')) return 'wav';
    if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
    if (b[0] === 0x00 && b[1] === 0x00 && (b[2] === 0x01 || b[2] === 0x02) && b[3] === 0x00) return 'ico';
    if (b.length >= 12 && ascii(4, 'ftyp')) {
      var brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
      if (brand === 'avif' || brand === 'avis') return 'avif';
      if (brand.indexOf('hei') === 0 || brand === 'mif1' || brand === 'msf1') return 'heic';
      if (brand === 'M4A ') return 'm4a';
      return 'mp4';
    }
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
    if (ascii(0, 'OggS')) return 'ogg';
    if (ascii(0, 'fLaC')) return 'flac';
    if (ascii(0, 'ID3')) return 'mp3';
    if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'mp3';
    if (ascii(0, 'wOFF')) return 'woff';
    if (ascii(0, 'wOF2')) return 'woff2';
    if (ascii(0, 'OTTO') || ascii(0, 'true') || ascii(0, 'ttcf')) return 'ttf';
    if (b[0] === 0x00 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) return 'ttf';
    if (ascii(0, '%PDF')) return 'pdf';
    if (b[0] === 0x00 && ascii(1, 'asm')) return 'wasm';
    if (ascii(0, 'PK') && (b[2] === 3 || b[2] === 5 || b[2] === 7)) return 'zip';
    if (b[0] === 0x1f && b[1] === 0x8b) return 'gz';
    if (b[0] === 0x47 && b.length > 188 && b[188] === 0x47) return 'ts'; // MPEG-TS sync bytes
    return '';
  }

  // Category sniffers, used to move mis-filed resources into the right tab.
  function sniffBinaryType(content) {
    var ext = extFromBytes(content);
    if (!ext) return null;
    if (['png', 'jpg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'heic'].indexOf(ext) !== -1) return 'image';
    if (ext === 'wasm') return 'wasm';
    if (ext === 'pdf') return 'document';
    if (['woff', 'woff2', 'ttf'].indexOf(ext) !== -1) return 'font';
    if (['mp4', 'webm', 'ts', 'm4v'].indexOf(ext) !== -1) return 'video';
    if (['mp3', 'ogg', 'flac', 'wav', 'm4a'].indexOf(ext) !== -1) return 'audio';
    return null;
  }

  function sniffTextType(text) {
    var t = String(text).trim();
    if (!t) return null;
    var head = t.slice(0, 4096);
    if (/^WEBVTT(?:\s|$)/.test(head)) return 'caption';
    if (/^\d+\r?\n\d{2}:\d{2}[:.,]/.test(head)) return 'caption';
    if (/^<svg[\s>/]/i.test(head)) return 'svg';
    if (/^<!doctype\s+html/i.test(head) || /^<html[\s>]/i.test(head)) return 'document';
    if (/^<\?xml/i.test(head)) {
      if (/<(?:tt|ttml)\b/i.test(head)) return 'caption';
      return 'document';
    }
    var first = head[0];
    if (first === '{' || first === '[') {
      if (/"mappings"\s*:/.test(head) && /"sources"\s*:/.test(head)) return 'sourcemap';
      // `{`/`[` bodies are JSON in the overwhelming majority of cases.
      // Validate when cheap; truncated or huge single-line payloads still get
      // promoted so they receive the JSON viewer.
      try {
        JSON.parse(t.length <= 262144 ? t : t.slice(0, 262144));
      } catch (e) {
        /* fall through — still promote */
      }
      return 'json';
    }
    if (/^[a-zA-Z_$][\w$]*\s*\(/.test(head)) return 'js'; // JSONP callback(…
    if (/^(function\b|const\b|let\b|var\b|class\b|async\b|document\.|window\.|module\.exports|import\b|export\b)/.test(head)) return 'js';
    if (/^@(charset|import|media|supports|font-face|keyframes|namespace)\b/i.test(head)) return 'css';
    return null;
  }

  function sniffType(content) {
    if (content instanceof Uint8Array || content instanceof ArrayBuffer) return sniffBinaryType(content);
    if (typeof content === 'string') return sniffTextType(content);
    return null;
  }

  // Bytes first, then the declared MIME type, then the category default.
  function extForContent(res, content) {
    var sniffed = extFromBytes(content);
    if (sniffed) return sniffed;
    if (typeof content === 'string') {
      var textType = sniffTextType(content);
      if (textType === 'svg') return 'svg';
      if (textType === 'json') return 'json';
      if (textType === 'sourcemap') return 'map';
      if (textType === 'caption') return 'vtt';
      if (textType === 'document') return 'html';
      if (textType === 'js') return 'js';
      if (textType === 'css') return 'css';
    }
    var fromMime = mimeExt(res && res.mimeType);
    if (fromMime) return fromMime;
    return (res && TYPE_FALLBACK_EXT[res.type]) || '';
  }

  function sanitizeName(name) {
    return String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, '_');
  }

  /*
   * Guarantees a saved file carries an extension that matches its bytes.
   * A recognised extension always wins so familiar names survive untouched;
   * a missing one is added, and a dynamic-endpoint suffix (.php, .aspx, …) is
   * replaced rather than stacked onto.
   */
  function ensureExtension(name, res, content) {
    var base = String(name || 'resource');
    var dot = base.lastIndexOf('.');
    var current = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
    if (current && KNOWN_EXTS.has(current)) return base;

    var ext = extForContent(res, content);
    if (!ext) return base;
    if (current && current.length <= 6 && /^[a-z0-9]+$/i.test(current)) base = base.slice(0, dot);
    base = sanitizeName(base) || 'resource';
    return base + '.' + ext;
  }

  root.SourceDownloadFileType = {
    MIME_EXT: MIME_EXT,
    KNOWN_EXTS: KNOWN_EXTS,
    TYPE_FALLBACK_EXT: TYPE_FALLBACK_EXT,
    mimeExt: mimeExt,
    extFromBytes: extFromBytes,
    extForContent: extForContent,
    ensureExtension: ensureExtension,
    sniffBinaryType: sniffBinaryType,
    sniffTextType: sniffTextType,
    sniffType: sniffType,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.SourceDownloadFileType;
  }
})(typeof self !== 'undefined' ? self : globalThis);
