/* Source Download — Inspector Domain: Active Resource Previews & Tabs
 * Domain-Driven Architecture
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

(function () {
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);
  if (!globalScope.SD) globalScope.SD = {};

  class InspectorDomain {
    constructor() {
      this._openTabIds = [];
      this._activeResource = null;
      this._detailsExpanded = false;
    }

    get openTabs() {
      return this._openTabIds;
    }

    get activeResource() {
      return this._activeResource;
    }

    openTab(resourceId) {
      if (!this._openTabIds.includes(resourceId)) {
        this._openTabIds.push(resourceId);
      }
      if (globalScope.SD.EventBus) {
        globalScope.SD.EventBus.emit('inspector:tabOpened', resourceId);
      }
    }

    closeTab(resourceId) {
      const idx = this._openTabIds.indexOf(resourceId);
      if (idx !== -1) {
        this._openTabIds.splice(idx, 1);
      }
      if (globalScope.SD.EventBus) {
        globalScope.SD.EventBus.emit('inspector:tabClosed', resourceId);
      }
    }

    closeAll() {
      this._openTabIds = [];
      this._activeResource = null;
      if (globalScope.SD.EventBus) {
        globalScope.SD.EventBus.emit('inspector:allClosed');
      }
    }
  }

  globalScope.SD.Inspector = new InspectorDomain();
})();
