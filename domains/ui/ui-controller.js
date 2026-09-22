/* Source Download — UI Domain: Toolbar, Guide, Toast & Statusbar Controller
 * Domain-Driven Architecture
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

(function () {
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);
  if (!globalScope.SD) globalScope.SD = {};

  class UIDomainController {
    constructor() {
      this._guideOpen = false;
      this._activeTheme = null;
    }

    get isGuideOpen() {
      return this._guideOpen;
    }

    setGuideOpen(isOpen) {
      this._guideOpen = !!isOpen;
      if (globalScope.SD.EventBus) {
        globalScope.SD.EventBus.emit('ui:guideToggled', this._guideOpen);
      }
    }
  }

  globalScope.SD.UI = new UIDomainController();
})();
