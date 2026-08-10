/*
 * Source Download — minimal XLSX writer.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * A from-scratch, dependency-free implementation of the XLSX (Office Open
 * XML Spreadsheet) format. An .xlsx file is just a ZIP archive containing a
 * set of XML parts, so this builder reuses `SourceDownloadZip.createZip` for
 * the container and only generates the small XML schema Excel expects.
 *
 * Numbers are written as real numeric cells; everything else becomes an
 * inline string cell. This covers the needs of a data-export tool (values,
 * text, dates-as-text) without the complexity of shared strings, formulas or
 * styling.
 *
 * Exposed globally as `SourceDownloadXlsx.build(sheets)` and usable from both
 * browser and Node.js:
 *
 *   sheets: [{ name: "Sheet 1", rows: [["Header A", "Header B"], [1, "foo"]] }]
 *
 * Returns the same value as `createZip`: a Promise<Blob> (application/zip) in
 * the browser, or a raw Uint8Array in Node.
 */
(function (root) {
  'use strict';

  function xmlEscape(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c];
    });
  }

  // 0-based column index -> "A", "Z", "AA", ...
  function colName(i) {
    var s = '';
    i = i + 1;
    while (i > 0) {
      var rem = (i - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  function isNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function sheetXml(name, rows) {
    var parts = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      '<sheetData>'
    ];
    rows.forEach(function (row, ri) {
      if (!row || !row.length) return;
      parts.push('<row r="' + (ri + 1) + '">');
      row.forEach(function (cell, ci) {
        var ref = colName(ci) + (ri + 1);
        if (isNumber(cell)) {
          parts.push('<c r="' + ref + '"><v>' + cell + '</v></c>');
        } else {
          parts.push(
            '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' +
            xmlEscape(cell === null || cell === undefined ? '' : cell) +
            '</t></is></c>'
          );
        }
      });
      parts.push('</row>');
    });
    parts.push('</sheetData></worksheet>');
    return parts.join('');
  }

  function build(sheets) {
    var list = (sheets || []).filter(function (s) { return s && s.name; });

    var contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      list.map(function (_, i) {
        return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ' +
          'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }).join('') +
      '</Types>';

    var rootRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    var workbook =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' +
      list.map(function (s, i) {
        return '<sheet name="' + xmlEscape(s.name.slice(0, 31)) + '" sheetId="' + (i + 1) + '" ' +
          'r:id="rId' + (i + 2) + '"/>';
      }).join('') +
      '</sheets></workbook>';

    var workbookRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      list.map(function (_, i) {
        return '<Relationship Id="rId' + (i + 2) + '" ' +
          'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
          'Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      }).join('') +
      '</Relationships>';

    var styles =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
      '<borders count="1"><border/></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
      '</styleSheet>';

    var entries = [
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rootRels },
      { name: 'xl/workbook.xml', data: workbook },
      { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
      { name: 'xl/styles.xml', data: styles }
    ];
    list.forEach(function (s, i) {
      entries.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s.name, s.rows) });
    });

    return root.SourceDownloadZip.createZip(entries);
  }

  root.SourceDownloadXlsx = { build: build };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { build: build };
  }
})(typeof self !== 'undefined' ? self : globalThis);
