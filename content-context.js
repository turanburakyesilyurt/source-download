/* Source Download — right-click context tracker.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * The only script that runs on every page. It remembers which element was
 * right-clicked so "Hide this element" works after the capture tools are
 * injected on demand. No scanning, no timers, no messages. */

'use strict';

if (!window.__sdContext) {
  window.__sdContext = { target: null, x: null, y: null };
  window.addEventListener('contextmenu', (e) => {
    window.__sdContext.target = e.target;
    window.__sdContext.x = e.clientX;
    window.__sdContext.y = e.clientY;
  }, { capture: true, passive: true });
}
