/* Source Download — Screenshot Domain: Full Page & Regional Capture Service
 * Domain-Driven Architecture
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

(function () {
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);
  if (!globalScope.SD) globalScope.SD = {};

  class ScreenshotDomainService {
    constructor() {
      this._isCapturing = false;
    }

    get isCapturing() {
      return this._isCapturing;
    }

    setCapturing(val) {
      this._isCapturing = !!val;
      if (globalScope.SD.EventBus) {
        globalScope.SD.EventBus.emit('screenshot:statusChanged', this._isCapturing);
      }
    }
  }

  globalScope.SD.Screenshot = new ScreenshotDomainService();
})();
