/*
 * Source Download — archive build worker.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Runs the CRC-32 pass, deflate compression and archive assembly off the
 * DevTools UI thread, so "Download All" over a few hundred megabytes never
 * freezes the panel. CPU jobs (beautify, search index, image decode) live in
 * jobs-worker.js so they can run alongside a ZIP build.
 * The panel falls back to doing the work inline if a worker cannot be started.
 *
 * Protocol
 *   in : { id, kind: 'zip',  entries, options }
 *        { id, kind: 'xlsx', sheets }
 *   out: { id, type: 'progress', fraction }
 *        { id, type: 'done', blob }
 *        { id, type: 'error', message }
 */
'use strict';

importScripts('zip.js', 'xlsx.js');

// Posting a message per entry would flood the main thread on large batches.
var PROGRESS_INTERVAL_MS = 80;

self.onmessage = async function (event) {
  var msg = event.data || {};
  var id = msg.id;
  var lastReport = 0;

  function report(fraction) {
    var now = Date.now();
    if (fraction < 1 && now - lastReport < PROGRESS_INTERVAL_MS) return;
    lastReport = now;
    self.postMessage({ id: id, type: 'progress', fraction: fraction });
  }

  try {
    var blob;
    if (msg.kind === 'xlsx') {
      blob = await self.SourceDownloadXlsx.build(msg.sheets);
    } else if (msg.kind === 'zip') {
      blob = await self.SourceDownloadZip.createZip(msg.entries, report, msg.options);
    } else {
      throw new Error('unknown job: ' + msg.kind);
    }
    self.postMessage({ id: id, type: 'done', blob: blob });
  } catch (err) {
    self.postMessage({
      id: id,
      type: 'error',
      message: (err && err.message) || 'archive build failed',
    });
  }
};
