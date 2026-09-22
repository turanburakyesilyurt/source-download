/* Source Download — Resource & Filename Sanitization Utility.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
(function () {
  'use strict';

  const globalScope = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : {};

  function sanitizeSlug(str, maxLen = 50) {
    if (!str || typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, maxLen);
  }

  function sanitizeFilename(name) {
    if (!name || typeof name !== 'string') return 'download';
    // Remove characters illegal in file paths across Win/Mac/Linux
    return name
      .replace(/[/\?%*:|"<>]/g, '_')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .replace(/^\.+/, '') // no leading dots
      .slice(0, 180);
  }

  function getFormattedDate(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());

    return {
      date: `${yyyy}-${mm}-${dd}`,
      time: `${hh}-${min}-${ss}`,
      datetime: `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`,
      year: String(yyyy),
      month: mm,
      day: dd
    };
  }

  const DEFAULT_PATTERNS = {
    screenshot: '{domain}-{type}-{date}_{time}',
    recording: '{domain}-{type}-{date}_{time}',
    archive: '{domain}-archive-{date}',
  };

  function formatFilename(pattern, vars, ext = '') {
    const d = getFormattedDate();
    let template = (typeof pattern === 'string' && pattern.trim())
      ? pattern.trim()
      : (DEFAULT_PATTERNS[vars && vars.category] || '{domain}-{type}-{date}_{time}');

    const domain = sanitizeSlug(vars && vars.domain || 'webpage', 40) || 'webpage';
    const title = sanitizeSlug(vars && vars.title || '', 50) || domain;
    const type = sanitizeSlug(vars && vars.type || 'capture', 30);

    let res = template
      .replace(/\{domain\}/gi, domain)
      .replace(/\{title\}/gi, title)
      .replace(/\{type\}/gi, type)
      .replace(/\{datetime\}/gi, d.datetime)
      .replace(/\{date\}/gi, d.date)
      .replace(/\{time\}/gi, d.time)
      .replace(/\{year\}/gi, d.year)
      .replace(/\{month\}/gi, d.month)
      .replace(/\{day\}/gi, d.day);

    res = sanitizeFilename(res);
    if (!res) res = `${domain}-${type}-${d.datetime}`;

    if (ext) {
      const cleanExt = ext.startsWith('.') ? ext : '.' + ext;
      if (!res.toLowerCase().endsWith(cleanExt.toLowerCase())) {
        res += cleanExt;
      }
    }
    return res;
  }

  globalScope.SourceDownloadNaming = {
    DEFAULT_PATTERNS,
    formatFilename,
    sanitizeSlug,
    sanitizeFilename,
    getFormattedDate
  };
})();
