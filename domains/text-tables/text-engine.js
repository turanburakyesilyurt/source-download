/* Source Download — Text & Tables Domain: Engine, Snapshot History & Queries
 * Domain-Driven Architecture
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

(function () {
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);
  if (!globalScope.SD) globalScope.SD = {};

  class TextTablesDomain {
    constructor() {
      this._blocks = [];
      this._tableHistories = new Map();
      this._liveActive = true;
      this._readMode = false;
      this._activeFilterPill = 'all'; // 'all' | 'text' | 'tables'
    }

    get blocks() {
      return this._blocks;
    }

    setBlocks(blocks) {
      this._blocks = blocks || [];
      if (globalScope.SD.EventBus) {
        globalScope.SD.EventBus.emit('text:blocksUpdated', this._blocks);
      }
    }

    getTableHistory(tableKey) {
      if (!this._tableHistories.has(tableKey)) {
        this._tableHistories.set(tableKey, []);
      }
      return this._tableHistories.get(tableKey);
    }

    recordTableSnapshot(tableKey, rows) {
      const history = this.getTableHistory(tableKey);
      history.push({ ts: Date.now(), rows });
      if (history.length > 50) history.shift();
    }

    getMergedTableRows(tableKey) {
      const history = this.getTableHistory(tableKey);
      const seen = new Set();
      const merged = [];
      for (const snap of history) {
        for (const row of snap.rows) {
          const sig = JSON.stringify(row);
          if (!seen.has(sig)) {
            seen.add(sig);
            merged.push(row);
          }
        }
      }
      return merged;
    }
  }

  globalScope.SD.TextTables = new TextTablesDomain();
})();
