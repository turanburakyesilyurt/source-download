/* Source Download — Export Domain: ZIP, XLSX, CSV, HAR, Archive Service
 * Domain-Driven Architecture
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

(function () {
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);
  if (!globalScope.SD) globalScope.SD = {};

  class ExportDomainService {
    constructor() {
      this._isExporting = false;
    }

    get isExporting() {
      return this._isExporting;
    }

    setExporting(val) {
      this._isExporting = !!val;
      if (globalScope.SD.EventBus) {
        globalScope.SD.EventBus.emit('export:statusChanged', this._isExporting);
      }
    }
  }

  globalScope.SD.Export = new ExportDomainService();
})();
