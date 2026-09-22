/* Source Download — Core Domain: Event Dispatcher (Pub/Sub)
 * Domain-Driven Architecture
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 */
'use strict';

(function () {
  const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);
  if (!globalScope.SD) globalScope.SD = {};

  class DomainEventBus {
    constructor() {
      this._handlers = new Map();
    }

    on(event, handler) {
      if (!this._handlers.has(event)) {
        this._handlers.set(event, new Set());
      }
      this._handlers.get(event).add(handler);
      return () => this.off(event, handler);
    }

    off(event, handler) {
      const set = this._handlers.get(event);
      if (set) set.delete(handler);
    }

    emit(event, payload) {
      const set = this._handlers.get(event);
      if (set) {
        for (const fn of set) {
          try {
            fn(payload);
          } catch (err) {
            console.error(`[EventBus] Error in handler for "${event}":`, err);
          }
        }
      }
    }
  }

  globalScope.SD.EventBus = new DomainEventBus();
})();
