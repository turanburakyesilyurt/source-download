/*
 * Source Download — dependency-free code formatters.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Small, hand-written beautifiers for CSS, JavaScript and HTML (plus a JSON
 * pretty-printer). They are intentionally conservative: they only ever
 * re-indent and re-break lines; string contents, comments and semantics are
 * preserved as-is. If anything fails to parse, the original text is returned.
 *
 * Exposed globally as `SourceDownloadBeautify.{css,js,html,json}(text)` and
 * usable from both browser and Node.js.
 */
(function (root) {
  'use strict';

  var pad = function (n) { return '  '.repeat(n); };

  // ---------------------------------------------------------------- CSS ----
  function beautifyCss(css) {
    var out = '';
    var indent = 0;
    var i = 0;
    var len = css.length;
    var inString = false;
    var strChar = '';
    while (i < len) {
      var c = css[i];
      var next = css[i + 1];
      if (inString) {
        out += c;
        if (c === '\\' && i + 1 < len) { out += css[i + 1]; i += 2; continue; }
        if (c === strChar) inString = false;
        i++;
        continue;
      }
      if (c === '"' || c === "'") { inString = true; strChar = c; out += c; i++; continue; }
      if (c === '/' && next === '*') {
        var end = css.indexOf('*/', i + 2);
        var cmt = css.slice(i, end === -1 ? len : end + 2);
        out += '\n' + pad(indent) + cmt + '\n' + pad(indent);
        i = end === -1 ? len : end + 2;
        continue;
      }
      if (c === '{') {
        out = out.replace(/[\s]+$/, '') + ' {\n' + pad(++indent);
        i++;
        continue;
      }
      if (c === '}') {
        out = out.replace(/[\s]+$/, '') + '\n' + pad(Math.max(0, --indent)) + '}\n' + pad(indent);
        i++;
        continue;
      }
      if (c === ';') {
        out = out.replace(/[\s]+$/, '') + ';\n' + pad(indent);
        i++;
        continue;
      }
      if (c === '\n' || c === '\r' || c === '\t') { i++; continue; }
      if (c === ' ') {
        if (out.length && out[out.length - 1] !== ' ' && out[out.length - 1] !== '\n' && out[out.length - 1] !== '{') {
          var lastNL = out.lastIndexOf('\n');
          var lineStart = lastNL === -1 ? 0 : lastNL + 1;
          if (out.slice(lineStart).trim() !== '') out += ' ';
        }
        i++;
        continue;
      }
      out += c;
      i++;
    }
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }

  // ---------------------------------------------------------------- JS ----
  function beautifyJs(js) {
    var out = '';
    var indent = 0;
    var parens = 0;
    var brackets = 0;
    var i = 0;
    var len = js.length;
    var inString = false;
    var strChar = '';
    var trimEnd = function (s) { return s.replace(/[\s]+$/, ''); };
    while (i < len) {
      var c = js[i];
      var next = js[i + 1];
      if (inString) {
        out += c;
        if (c === '\\' && i + 1 < len) { out += js[i + 1]; i += 2; continue; }
        if (c === strChar) inString = false;
        i++;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { inString = true; strChar = c; out += c; i++; continue; }
      if (c === '/' && next === '/') {
        var e = js.indexOf('\n', i);
        out += js.slice(i, e === -1 ? len : e) + '\n' + pad(indent);
        i = e === -1 ? len : e + 1;
        continue;
      }
      if (c === '/' && next === '*') {
        var ce = js.indexOf('*/', i + 2);
        out += '\n' + pad(indent) + js.slice(i, ce === -1 ? len : ce + 2) + '\n' + pad(indent);
        i = ce === -1 ? len : ce + 2;
        continue;
      }
      if (c === '{') {
        out = trimEnd(out) + ' {\n' + pad(++indent);
        i++;
        continue;
      }
      if (c === '}') {
        out = trimEnd(out) + '\n' + pad(Math.max(0, --indent)) + '}\n' + pad(indent);
        i++;
        continue;
      }
      if (c === ';' && parens === 0 && brackets === 0) {
        out = trimEnd(out) + ';\n' + pad(indent);
        i++;
        continue;
      }
      if (c === '(') { parens++; out += c; i++; continue; }
      if (c === ')') { parens = Math.max(0, parens - 1); out += c; i++; continue; }
      if (c === '[') { brackets++; out += c; i++; continue; }
      if (c === ']') { brackets = Math.max(0, brackets - 1); out += c; i++; continue; }
      if (c === ',') {
        if (parens === 0 && brackets === 0) out = trimEnd(out) + ',\n' + pad(indent);
        else out = trimEnd(out) + ', ';
        i++;
        continue;
      }
      if (c === '\n' || c === '\r' || c === '\t') { i++; continue; }
      if (c === ' ' || c === '\t') {
        if (out.length && out[out.length - 1] !== ' ' && out[out.length - 1] !== '\n' && out[out.length - 1] !== '(' && out[out.length - 1] !== '[') {
          out += ' ';
        }
        i++;
        continue;
      }
      out += c;
      i++;
    }
    return out
      .replace(/\}\s*\n\s*(else|catch|finally|while)\b/g, '} $1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // --------------------------------------------------------------- HTML ----
  var VOID_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);

  function beautifyHtml(html) {
    var out = '';
    var indent = 0;
    var i = 0;
    var len = html.length;
    while (i < len) {
      var lt = html.indexOf('<', i);
      if (lt === -1) {
        var rest = html.slice(i).trim();
        if (rest) out += pad(indent) + rest + '\n';
        break;
      }
      var text = html.slice(i, lt).trim();
      if (text) out += pad(indent) + text + '\n';

      if (html.startsWith('<!--', lt)) {
        var ce = html.indexOf('-->', lt + 4);
        var cend = ce === -1 ? len : ce + 3;
        out += pad(indent) + html.slice(lt, cend) + '\n';
        i = cend;
        continue;
      }
      if (html.startsWith('<!', lt)) {
        var de = html.indexOf('>', lt);
        var dend = de === -1 ? len : de + 1;
        out += html.slice(lt, dend) + '\n';
        i = dend;
        continue;
      }
      if (html.startsWith('</', lt)) {
        var ee = html.indexOf('>', lt);
        var eend = ee === -1 ? len : ee + 1;
        indent = Math.max(0, indent - 1);
        out += pad(indent) + html.slice(lt, eend) + '\n';
        i = eend;
        continue;
      }

      var e2 = html.indexOf('>', lt);
      var end2 = e2 === -1 ? len : e2 + 1;
      var tagText = html.slice(lt, end2);
      var m = tagText.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
      var tagName = m ? m[1].toLowerCase() : '';
      var selfClosing = /\/\s*>$/.test(tagText.trim());
      var isVoid = tagName && VOID_TAGS.has(tagName);

      out += pad(indent) + tagText + '\n';
      if (!selfClosing && !isVoid && tagName) {
        indent++;
        if (tagName === 'script' || tagName === 'style') {
          var inner = html.slice(end2);
          var cm = inner.match(new RegExp('</' + tagName + '\\s*>', 'i'));
          var raw = cm ? inner.slice(0, cm.index + cm[0].length) : inner;
          if (raw.trim()) out += raw.trim() + '\n';
          i = end2 + raw.length;
          indent = Math.max(0, indent - 1);
          continue;
        }
      }
      i = end2;
    }
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }

  // --------------------------------------------------------------- JSON ----
  function beautifyJson(text) {
    try {
      var parsed = JSON.parse(text);
      if (parsed === undefined) return text;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  }

  function beautify(type, text) {
    try {
      if (type === 'css') return beautifyCss(text);
      if (type === 'js') return beautifyJs(text);
      if (type === 'html' || type === 'xml' || type === 'svg') return beautifyHtml(text);
      if (type === 'json') return beautifyJson(text);
    } catch {
      /* fall through — return original */
    }
    return text;
  }

  root.SourceDownloadBeautify = {
    css: beautifyCss,
    js: beautifyJs,
    html: beautifyHtml,
    json: beautifyJson,
    format: beautify,
  };
})(typeof self !== 'undefined' ? self : globalThis);
