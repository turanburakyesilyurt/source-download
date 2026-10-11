/* Source Download — test helper: the DevTools panel's source as one string,
 * concatenated in the order panel.html loads panel/*.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function panelFiles() {
  const html = fs.readFileSync(path.join(ROOT, 'panel.html'), 'utf8');
  return [...html.matchAll(/<script src="(panel\/[^"]+\.js)"><\/script>/g)].map((m) => m[1]);
}

function readPanelSource() {
  return panelFiles().map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

module.exports = { panelFiles, readPanelSource };
