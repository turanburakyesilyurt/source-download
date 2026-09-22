/* Source Download — Resources Domain: Resource Repository & Deduplication
 * Domain-Driven Architecture
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

(function () {
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);
  if (!globalScope.SD) globalScope.SD = {};

  class ResourceRepository {
    constructor() {
      this._items = [];
      this._byId = new Map();
      this._byUrl = new Map();
      this._dupeGroups = new Map();
    }

    get all() {
      return this._items;
    }

    get count() {
      return this._items.length;
    }

    getById(id) {
      return this._byId.get(id);
    }

    getByUrl(url) {
      return this._byUrl.get(url);
    }

    add(resource) {
      if (!resource || !resource.id) return false;
      if (this._byId.has(resource.id)) return false;

      this._byId.set(resource.id, resource);
      if (resource.url) this._byUrl.set(resource.url, resource);
      this._items.push(resource);

      if (globalScope.SD.EventBus) {
        globalScope.SD.EventBus.emit('resource:added', resource);
      }
      return true;
    }

    clear() {
      this._items = [];
      this._byId.clear();
      this._byUrl.clear();
      this._dupeGroups.clear();
      if (globalScope.SD.EventBus) {
        globalScope.SD.EventBus.emit('resource:cleared');
      }
    }
  }

  globalScope.SD.ResourceRepo = new ResourceRepository();
})();
