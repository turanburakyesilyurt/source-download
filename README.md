<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Source Download Icon">
</p>

<h1 align="center">Source Download</h1>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/Language-English-4f8cff?style=flat-square" alt="English"></a>
  <a href="docs/locales/README.tr.md"><img src="https://img.shields.io/badge/Dil-T%C3%BCrk%C3%A7e-e11d48?style=flat-square" alt="Türkçe"></a>
  <a href="docs/locales/README.de.md"><img src="https://img.shields.io/badge/Sprache-Deutsch-333333?style=flat-square" alt="Deutsch"></a>
  <a href="docs/locales/README.es.md"><img src="https://img.shields.io/badge/Idioma-Espa%C3%B1ol-eab308?style=flat-square" alt="Español"></a>
  <a href="docs/locales/README.ja.md"><img src="https://img.shields.io/badge/%E8%A8%80%E8%AA%9E-%E6%97%A5%E6%9C%AC%E8%AA%9E-dc2626?style=flat-square" alt="日本語"></a>
  <a href="docs/locales/README.ru.md"><img src="https://img.shields.io/badge/%D0%AF%D0%B7%D1%8B%D0%BA-%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-0284c7?style=flat-square" alt="Русский"></a>
  <a href="docs/locales/README.zh-CN.md"><img src="https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-b91c1c?style=flat-square" alt="简体中文"></a>
  <a href="docs/locales/README.fr.md"><img src="https://img.shields.io/badge/Langue-Fran%C3%A7ais-0055a5?style=flat-square" alt="Français"></a>
  <a href="docs/locales/README.pt-BR.md"><img src="https://img.shields.io/badge/Idioma-Portugu%C3%AAs-009c3b?style=flat-square" alt="Português"></a>
  <a href="docs/locales/README.it.md"><img src="https://img.shields.io/badge/Lingua-Italiano-008c45?style=flat-square" alt="Italiano"></a>
  <a href="docs/locales/README.ko.md"><img src="https://img.shields.io/badge/%EC%96%B8%EC%96%B4-%ED%95%9C%EA%B5%AD%EC%96%B4-0f4c81?style=flat-square" alt="한국어"></a>
</p>

<p align="center">
  <em>The all-in-one web asset downloader, full page screenshot engine & live DOM workbench.</em><br>
  Browse, inspect and download <b>every asset</b> a web page loads — images, SVG, video, audio, JS, CSS, fonts, JSON, WASM, manifests, live tables, and pixel-perfect full page screenshots — seamlessly as a folder-structured ZIP.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd"><img src="https://img.shields.io/chrome-web-store/v/nockdgincmpfojabnhbofkddgcmnodpd?style=flat-square&logo=googlechrome&label=Chrome%20Web%20Store" alt="Chrome Web Store"></a>
  <img src="https://img.shields.io/badge/version-1.15.0-4f8cff?style=flat-square" alt="Version 1.15.0">
  <img src="https://img.shields.io/badge/Chrome%20Manifest-V3-00C853?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/dependencies-zero-22c55e?style=flat-square" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/build--step-none-22c55e?style=flat-square" alt="No Build Step">
  <img src="https://img.shields.io/badge/privacy-100%25%20local%20%7C%20zero%20telemetry-22c55e?style=flat-square" alt="Zero Telemetry">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/language-Pure%20JavaScript-facc15?style=flat-square" alt="Pure JavaScript">
  <img src="https://img.shields.io/badge/browsers-Chrome%20%7C%20Edge%20%7C%20Brave%20%7C%20Opera-9333ea?style=flat-square" alt="Compatible Browsers">
</p>

---

## Hi, I'm Turan Burak Yeşilyurt

For years I built automations for **web scraping**, **data analysis** and **QA workflows**. Then SPAs took over the web — and I kept hitting the same wall: as an end user you can't easily grab the things you *see* on screen, and as a developer the Chrome DevTools area often feels either insufficient or overwhelming. That frustration is exactly why I built **Source Download**.

This is my **first open-source project**, so your feedback means the world to me — it's the single biggest driver for making this thing better. And please, don't forget to [**connect with me on LinkedIn**](https://www.linkedin.com/in/turan-burak-yesilyurt/) or check out [**2run.dev**](https://2run.dev) — I'd love to hear how you use it and chat about what else we could build together. Enjoy!

> **Chrome Web Store:** [Install Source Download from Chrome Web Store](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd)

---

> **A confession & open-source pledge:** Almost every "download this page's assets" tool you'll find on the store is a wrapper around a pile of third-party libraries. This one is different. Every byte of Source Download — including the **ZIP writer**, the **XLSX builder**, the **HLS merger**, the **GIF encoder** and the **code formatters** — is hand-written from scratch. No frameworks, no external dependencies, no build step, no telemetry. Just vanilla JavaScript, readable and auditable in a sitting.

---

## Visual Tour & Core Modules

Explore the high-resolution interface modules built directly into Google Chrome DevTools, Right-Click Menu, and Toolbar Popup.

### 1. All-in-One Web Asset Inspector & Downloader
> **★ DEVTOOLS ENGINEERING SUITE · F12** — Detect, inspect, filter by resolution, and download images, SVGs, HLS video streams, fonts, scripts, and tables in one unified studio.
> 
> `⚡ 17 Asset Categories` · `🔍 Dimension & Hash Filters` · `📦 ZIP & ZIP64 Parallel Bundler` · `🔒 100% Client-Side · Zero Telemetry`

<p align="center">
  <img src="screenshots/en/01-asset-inspector-downloader.png" width="100%" alt="All-in-One Web Asset Inspector & Downloader">
</p>

---

### 2. Regional Screen Recorder & Pure Vanilla GIF Studio
> **★ REGIONAL SCREEN RECORDER · MP4, WEBM & GIF** — Draw custom crop boundaries with zero border bleed. Export hardware-accelerated MP4, WebM, or ultra-lightweight animated GIFs.
> 
> `🎬 MP4 (H.264 Hardware Accel)` · `✨ Pure Vanilla GIF89a (1-15 FPS)` · `🛡️ Zero Border Bleed Engineering` · `⏱️ 60s Safety Cap & Memory Guard`

<p align="center">
  <img src="screenshots/en/02-screen-recorder-gif.png" width="100%" alt="Regional Screen Recorder & Pure Vanilla GIF Studio">
</p>

---

### 3. Seamless Full-Page Capture with Smart Sticky Header Removal
> **★ PIXEL-PERFECT SCREENSHOTS · FULL PAGE & AREA** — Scroll and stitch entire web pages into lossless PNGs. Automatically hides floating headers and overlays to eliminate repetition artifacts.
> 
> `📜 Seamless Full-Page Auto Stitching` · `🚫 Smart Sticky / Floating Suppression` · `🎯 Precision Area Crosshair Guides` · `🖼️ Lossless 24-bit PNG Export`

<p align="center">
  <img src="screenshots/en/03-fullpage-screenshot-capture.png" width="100%" alt="Seamless Full-Page Capture with Smart Sticky Header Removal">
</p>

---

### 4. Dynamic DOM Tables to Excel (XLSX) & Element Zapper
> **★ DATA EXTRACTION & ELEMENT REMOVER** — Scrape live tables across dynamic SPA pagination into multi-sheet Excel workbooks. Right-click to zap annoying banners and popups instantly.
> 
> `📊 Multi-Sheet Excel (XLSX) Generator` · `📑 Dynamic SPA Snapshot History` · `⚡ Element Zapper (Distraction Remover)` · `📝 Formats: XLSX, Markdown, CSV & HTML`

<p align="center">
  <img src="screenshots/en/04-dom-tables-excel-export.png" width="100%" alt="Dynamic DOM Tables to Excel (XLSX) & Element Zapper">
</p>

---

### 5. Screen Color Inspector & Integrated Code Beautifier
> **★ DEVELOPER & DESIGNER UTILITIES** — Sample colors anywhere on screen with instant conversion into 7 color models. Unminify compressed CSS and JavaScript with syntax search.
> 
> `🎨 Native EyeDropper & 7 Color Models` · `📋 1-Click Clipboard Format Copy` · `💻 HTML, CSS & JavaScript Code Unminifier` · `🔍 Real-Time Code Regex Search`

<p align="center">
  <img src="screenshots/en/05-color-picker-palette.png" width="100%" alt="Screen Color Inspector & Integrated Code Beautifier">
</p>

---

Browse, inspect and download every web asset a page loads seamlessly as a ZIP.

Source Download — every asset on a page, one click away
Source Download is a Chrome DevTools panel that discovers, inspects and downloads every resource a web page loads. Whether you need media files, developer scripts, style assets, or network responses, you can save them as individual files or as a tidy, folder-structured ZIP.

Built from scratch with zero third-party dependencies: the ZIP writer, the XLSX builder, the HLS merger and the code formatters are all hand-written vanilla JavaScript. No frameworks, no build step, no telemetry. Everything runs locally in your browser.

What's New in v1.15.0
- Full-page stitched screenshots with automatic sticky header suppression.
- Regional screen video recording (MP4 & WebM) and pure vanilla GIF studio.
- Screen color eyedropper tool with instant 7-model hex/rgb format copying.
- Expanded multi-language support: 4 new languages (French, Italian, Korean, Brazilian Portuguese) — now 11 fully localized languages across UI and user guide.
- Upgraded to 17 live-count resource categories with dedicated tabs.

Why you need it
The screenshot won't cut it. Grab the real files — full-resolution images, actual video streams, original stylesheets and scripts — not a flattened picture.

DevTools feels overwhelming. Source Download puts a clean, categorized gallery in front of the same network data, with search, filters and one-click downloads.

SPAs hide everything. Dynamic apps create assets and API calls you never see in the page source. Source Download captures them as they happen, including intermediate states.

What it does
Discover everything
Combines network capture (HAR + live requests) with a DOM scan for all visual and structural elements, including media files, scripts, stylesheets, and embedded frames.

CSS-aware: assets inside url(...) and @import rules are followed recursively, so even fonts buried in imported stylesheets are found.

Content sniffing: unknown files are read back a few bytes and promoted to their actual file type category.

17 live-count categories: Captured assets are neatly organized into dedicated tabs for media, code, data, API calls, and documents.

Filter, search, inspect
Regex-powered search across filenames, URLs, MIME types, alt text and even file contents.

Per-category filters: min/max size, and for media also min/max width and height — for example "only hero images ≥ 1200px". API calls filter by HTTP method and request type.

List or grid view, sortable, with a live thumbnail wall.

Multi-tab inspector with true previews: zoomable lightbox, video and audio playback, a live font specimen, an SVG viewer, syntax-highlighted code with line numbers and a Beautify toggle.

API split view: response on the left, method, status, query parameters and request body on the right.

Download properly
Download Selected — only the files you checked.

Download View — everything visible after the current filters and search.

Download All — every captured resource into a folder-structured ZIP with automatic de-duplication.

Batch downloads run with bounded concurrency and a live progress bar; failures are retried automatically and from a context menu.

HLS & tricky video
Streams the browser can't play natively (HLS .m3u8, DASH .mpd, unknown codecs) show a smart fallback instead of a black player.

Merge segments & download turns an HLS stream into a single playable file, right in the panel.

The Text workbench (SPA content toolkit)
The Text tab is a live content viewer: every element that carries text — headings, paragraphs, list items, buttons, divs, spans — is captured in DOM order.

Dynamic tables keep a bounded snapshot history (e.g. "8 snapshots · 124 unique rows"), so auto-refreshing dashboards never lose intermediate states.

Export as Markdown, or tables as CSV, HTML, or a real multi-sheet XLSX workbook built by our own hand-written XLSX writer.

How to use it
Install Source Download, then press F12 on any page.

Click the Source Download tab in the DevTools toolbar (Chrome doesn't allow extensions to open DevTools automatically — that's why it lives there).

Browse the category tabs, search, filter, inspect anything in the right-hand panel.

Check the files you want and hit Download Selected, Download View or Download All.

Keep the DevTools panel open while the page loads to capture every network request.

Real-world use cases
Competitor analysis: collect video thumbnails from any channel — with a minimum width filter — into one folder.

Web scraping without code: watch a SPA's API calls, filter to the endpoint you need, download its exact JSON responses.

Typography teardown: find out which font a site really uses and grab the actual font files.

Bug reproduction: keep the exact CSS/JS versions that shipped when a bug occurred.

Dashboard data export: export an auto-refreshing table to a multi-sheet Excel workbook, history included.

QA testing: verify which video/audio variant is served in each A/B configuration.

Privacy
Runs 100% locally. No server, no analytics, no data leaves your machine.

Only asks for the bare minimum: storage (your preferences), clipboard (copy URLs) and host access (to scan pages and fetch file bodies).

Files are saved through Chrome's normal download flow — no silent downloads.

Requirements
Chrome 114 or newer (Manifest V3).

Best results when the panel is open while the page loads, since that's when network capture happens.

Source Download is an open-source project — feedback, ideas and pull requests are welcome.
Connect on LinkedIn: https://www.linkedin.com/in/turan-burak-yesilyurt/

---

## Installation & Quick Start

### Method 1: Direct Install from Chrome Web Store (Recommended)
1. Visit the official [Source Download Chrome Web Store Listing](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd).
2. Click **Add to Chrome** and grant permissions.
3. Open Chrome DevTools (`F12` or `Ctrl+Shift+I` / `Cmd+Option+I` on macOS) and click the **Source Download** tab, or right-click anywhere on the page.

### Method 2: Load Unpacked Extension from Source (Developer Mode)
1. Clone the official GitHub repository:
```bash
git clone https://github.com/turanburakyesilyurt/source-download.git
cd source-download
```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** and select the cloned `source-download` project folder.

---

## License

Released under the [MIT License](LICENSE). Copyright © Turan Burak Yeşilyurt. Free to use, inspect, and fork.
