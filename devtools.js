/* Source Download — DevTools panel registration.
 * Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/
 *
 * Register the Source Download panel. It appears every time DevTools is open
 * for any tab, under the "Source Download" tab in the DevTools toolbar. */
chrome.devtools.panels.create(
  'Source Download',
  'icons/icon32.png',
  'panel.html',
  (panel) => {
    if (chrome.runtime.lastError) {
      console.warn('Source Download panel could not be created:', chrome.runtime.lastError.message);
    }
  }
);
