# Source Download — Privacy Policy

_Last updated: 10 October 2026 · Applies to version 1.17.0 and later_

Source Download is a Chrome extension that helps you capture and save the content of web pages. It is built so that **nothing you see, capture or save leaves your computer**.

## Summary

- **No data collection.** The extension does not collect, sell, share or transmit any personal or browsing data to the developer or to any third party.
- **No analytics, no tracking, no account, no advertising.**
- **No remote code.** All code ships inside the extension package.

## What the extension processes, and where

Everything below happens **locally, inside your browser**, and only when you use a feature:

| Feature | What is processed | Where it goes |
| --- | --- | --- |
| DevTools panel | Addresses, types and contents of files the open page has loaded | Shown in the panel; saved only to your Downloads folder when you choose to save |
| Screenshots and area recording | Pixels of the visible tab or the area you select | Saved to your Downloads folder or copied to your clipboard (automatically, if you turn on "Copy automatically") |
| Tables and text | Text and tables of the open page | Exported to a file you save |
| Offline page copy | The page's HTML and the files it uses | Saved as one HTML file in your Downloads folder |
| Color picker | The color you pick | Copied to your clipboard |
| Hide this element | How many elements you hid on the current tab, so "Restore" works | Kept in the browser session only, cleared when Chrome closes |

To fetch a file you choose to save, the extension requests it **from the website it came from** — the same request the page itself made. No copy is sent anywhere else.

## Data stored on your device

The extension uses `chrome.storage` on your device only, for: your language (and the language the right-click menu was built in), panel layout and theme, file-naming patterns, recording preferences, whether area screenshots are copied automatically, and a small counter used to decide when to show the optional review banner. You can remove all of it by uninstalling the extension.

## Permissions and why they are needed

| Permission | Why |
| --- | --- |
| Access to all sites (`<all_urls>`) | To list the files a page loads, fetch the ones you choose to save, and run the capture tools (screenshots, recording, offline copy) on the page you are viewing. |
| `scripting` | To start the capture tools in the current page only when you use one of them. |
| `downloads` | To save files, screenshots and archives to your Downloads folder. |
| `storage` | To remember your settings on your device. |
| `contextMenus` | To offer the capture tools in the right-click menu. |
| `clipboardWrite` | To copy colors, addresses, text and images when you click a copy button. |

A tiny script runs on every page only to remember which element you right-clicked, so the "Hide this element" menu item works. It does not read page content and sends nothing.

## Optional links

- The review banner, the "Something wrong?" link and the uninstall feedback form open pages on **GitHub** or the **Chrome Web Store**. Anything you choose to write there is handled by those services under their own privacy policies.
- The Chrome Web Store listing page may use analytics provided by Google. The extension itself contains no analytics.

## Chrome Web Store User Data Policy

The use of information by Source Download complies with the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/), including the Limited Use requirements. Because the extension does not collect user data, no data is used for advertising, sold, or transferred.

## Changes and contact

If this policy changes, the new version will be published at this address with a new date.
Questions: https://github.com/turanburakyesilyurt/source-download/issues

---

# Source Download — Gizlilik Politikası (Türkçe)

_Son güncelleme: 10 Ekim 2026 · 1.17.0 ve sonraki sürümler için geçerlidir_

Source Download, web sayfalarının içeriğini yakalayıp kaydetmenize yardımcı olan bir Chrome eklentisidir. **Gördüğünüz, yakaladığınız veya kaydettiğiniz hiçbir şey bilgisayarınızdan dışarı çıkmaz.**

- **Veri toplanmaz.** Eklenti; kişisel veya gezinme verilerinizi geliştiriciye ya da üçüncü taraflara toplamaz, satmaz, paylaşmaz, göndermez.
- **Analiz, izleme, hesap ve reklam yoktur.** Uzak kod çalıştırılmaz.
- Tüm işlemler tarayıcınızda ve yalnızca bir özelliği kullandığınızda yapılır. Kaydettiğiniz dosyalar İndirilenler klasörünüze gider; renk, metin ve görüntü kopyaları panonuza alınır ("Otomatik kopyala" açıksa alan görüntüsü kendiliğinden). Bir sekmede kaç öğe gizlediğiniz yalnızca tarayıcı oturumunda tutulur ve Chrome kapanınca silinir.
- Kaydetmek istediğiniz bir dosya, **geldiği web sitesinden** istenir; başka bir yere kopyası gönderilmez.
- Cihazınızda yalnızca dil (ve sağ tık menüsünün hangi dilde kurulduğu), panel düzeni, tema, dosya adlandırma kalıpları, kayıt tercihleri, alan görüntüsünün otomatik kopyalanıp kopyalanmayacağı ve değerlendirme bandı sayacı saklanır. Eklentiyi kaldırınca hepsi silinir.
- İzinlerin gerekçeleri yukarıdaki İngilizce tabloda yer alır. Her sayfada çalışan küçük betik yalnızca sağ tıkladığınız öğeyi hatırlar; sayfa içeriğini okumaz, hiçbir şey göndermez.
- Değerlendirme, "Sorun mu var?" ve kaldırma geri bildirimi bağlantıları GitHub veya Chrome Web Store sayfalarını açar; oraya yazdıklarınız o hizmetlerin politikalarına tabidir.

Sorular: https://github.com/turanburakyesilyurt/source-download/issues
