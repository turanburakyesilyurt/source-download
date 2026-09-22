/* Source Download — Resources Domain: Filter & Sort Domain Service
 * Domain-Driven Architecture
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

(function () {
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);
  if (!globalScope.SD) globalScope.SD = {};

  class ResourceFilterService {
    matches(res, filter, activeTab) {
      if (!res) return false;

      // Category tab match
      if (activeTab && activeTab !== 'all' && res.type !== activeTab) {
        return false;
      }

      // Hide duplicates
      if (filter.hideDupes && res.isDuplicate) {
        return false;
      }

      // Search term
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const url = (res.url || '').toLowerCase();
        const fn = (res.filename || '').toLowerCase();
        if (!url.includes(q) && !fn.includes(q)) return false;
      }

      // Min/Max Size
      if (filter.minSize !== '' && res.size !== undefined && res.size !== null) {
        if (res.size < Number(filter.minSize) * 1024) return false;
      }
      if (filter.maxSize !== '' && res.size !== undefined && res.size !== null) {
        if (res.size > Number(filter.maxSize) * 1024) return false;
      }

      // Method / Type filter
      if (filter.method && res.method && res.method.toUpperCase() !== filter.method.toUpperCase()) {
        return false;
      }

      return true;
    }

    sort(items, sortBy, sortDir) {
      const dir = sortDir === 'desc' ? -1 : 1;
      return [...items].sort((a, b) => {
        if (sortBy === 'size') {
          return ((a.size || 0) - (b.size || 0)) * dir;
        }
        if (sortBy === 'type') {
          return ((a.type || '').localeCompare(b.type || '')) * dir;
        }
        if (sortBy === 'time') {
          return ((a.timestamp || 0) - (b.timestamp || 0)) * dir;
        }
        return ((a.filename || a.url || '').localeCompare(b.filename || b.url || '')) * dir;
      });
    }
  }

  globalScope.SD.ResourceFilter = new ResourceFilterService();
})();
