/* Source Download — Core Domain: Reactive State & Preferences Store
 * Domain-Driven Architecture
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

(function () {
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);
  if (!globalScope.SD) globalScope.SD = {};

  class CoreStateStore {
    constructor() {
      this._state = {
        resources: [],
        filter: {
          search: '',
          minSize: '',
          maxSize: '',
          minWidth: '',
          minHeight: '',
          sortBy: 'name',
          sortDir: 'asc',
          method: '',
          reqType: '',
          hideDupes: false,
        },
        activeTab: 'all',
        view: 'list',
        selected: new Set(),
        open: [],
        current: null,
        failed: new Set(),
        readMode: false,
        theme: null,
        lang: 'en',
      };
      this._listeners = new Set();
    }

    get state() {
      return this._state;
    }

    subscribe(fn) {
      this._listeners.add(fn);
      return () => this._listeners.delete(fn);
    }

    notify(changeKey) {
      for (const fn of this._listeners) {
        try { fn(this._state, changeKey); } catch (e) { console.error(e); }
      }
      if (globalScope.SD.EventBus) {
        globalScope.SD.EventBus.emit('state:changed', { key: changeKey, state: this._state });
      }
    }

    update(partial) {
      Object.assign(this._state, partial);
      this.notify('update');
    }
  }

  globalScope.SD.StateStore = new CoreStateStore();
})();
