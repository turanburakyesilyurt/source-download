# Changelog

All notable changes to Source Download. Versions follow the `version` field in `manifest.json`.

## 1.17.0 — 2026-10

A redesigned interface, and much lighter on every page.

### Toolbar popup
- A grid of large buttons for the capture tools (full page, area, area recording, colour picker, offline copy, how it works) and a short pointer to the DevTools panel.
- The toolbar counter was removed: before DevTools is open it could only guess, and the panel shows the real list.
- Every new label and the guide are translated into all 54 languages.

### DevTools panel
- One smart Download button: selected files when something is selected, the current category or filtered view otherwise, everything when nothing narrows the list. The other download choices, with counts and estimated sizes, sit in its menu.
- Refresh, export, screenshot, offline copy, language, theme, file names and the guide moved into one ⋯ menu.
- Empty categories are hidden until asked for; page text sits right under All. A list header shows the category, its count, select all, sorting and a Filters button.
- The Text category was rebuilt: a readable, left-aligned document view with per-line copy, and a Tables view with one card per table and Excel, CSV and Copy buttons.
- The Text category has a second menu of boxes — all page text, each heading level, paragraphs, links, list items, buttons, code and more — each with a count and its first line, plus a Custom query box for CSS selectors and XPath. Picking a box lists only those elements, and copy and export follow it.
- Modern inspector (file icon, summary line, grouped actions, card-style details), a lighter image viewer with large, clear controls, and one consistent look for drop-downs, inputs and menus.
- Settings: "Save" no longer shows the "Export" label, and "Reset to defaults" no longer selects the removed 4K GIF option.
- Page text now includes the labels of `<input type="submit">` buttons and icon-only buttons (their `aria-label`), and no longer picks up inline `<script>` and `<style>` content. Searching ignores the Turkish dotted-İ case difference.
- The right-click menu now always follows the language chosen in the extension; it could stay in the browser's language after Chrome woke the extension up.

### On-page tools
- The screenshot, recording and colour-picker toolbars and dialogs use a light theme.
- Area screenshot: ⌘C / Ctrl+C copies the selection and ⌘S / Ctrl+S saves it. An optional "Copy automatically" switch (on the page and in Settings) puts the selection on the clipboard as soon as you let go; while it is on, the hint at the top of the page says so every time.

### Icon
- New icon in the blue–violet colours of the new interface.

### Pages
- New welcome page with picture guides for the right-click menu, the toolbar button and the DevTools panel.

### Performance and permissions
- Nothing runs on web pages until you use a tool. The 1.8 MB dictionary, the page scanner, the DOM observer and the 5-second timer that used to run on every tab are gone; only a few-line script remembers the right-clicked element.
- Capture tools are injected on demand with just the dictionary for your language.
- The 1.9 MB `lib/i18n.js` copy of all translations was removed; every surface reads one language from `_locales`.
- Removed the unused `activeTab` permission.

### Fixes
- Panel notifications were not shown at all since 1.14 (missing `#toast` element); the "Retry" button is back.
- Raw placeholders such as `$count$` appeared in 40 panel messages in all languages.
- The offline page archive no longer changes the live page, and it now embeds every image, `srcset` candidate, CSS background, font and favicon (was capped at 60 images).
- GIF recording encodes frames while recording instead of keeping raw frames in memory (60 s of 1080p could exceed several GB). The 4K option was removed; 1080p/720p/480p remain.
- The page-context fetch fallback (used for `blob:` resources and HLS segments) never worked because `inspectedWindow.eval` cannot await promises; it now uses `chrome.scripting` in the page's main world.
- Area recording checks that the shared surface is the current tab.
- The colour picker now works when started from the toolbar button or the panel.
- HLS `.ts` segments were counted as JavaScript.
- An empty inspector took 72% of the panel width on every open.
- Unanswered message channels in the service worker.

### Also new
- Review banner after the third successful save (shown at most twice), "Something wrong?" link and optional uninstall feedback form.

### Accessibility and languages
- Accessible names for icon-only buttons, decorative symbols hidden from screen readers, dialog roles and focus management for in-page windows, live regions for notifications and progress.
- One shared locale resolver (for example zh-HK now resolves to Traditional Chinese everywhere).
- Removed 44 hard-coded Turkish fallbacks and 26 unused message keys; new strings translated into 54 languages.
- Minimum Chrome version is now 126 (needed for MP4 recording).

## 1.16.0 — 2026-10-04
- 54-language interface, context-menu tools, area recording, colour picker, localized READMEs.

## 1.15.0 — 2026-09-30
- Live resource categories, 11-language suite, localized guides.

## 1.14.0 — 2026-09-22
- Architecture overhaul, screen recorder, full-page stitcher, DOM tables to Excel, 7 languages.

## 1.11.0 — 2026-08-24
- Captions and source maps, theme handling, file type detection.

## 1.8.1 — 2026-08-10
- First public release.
