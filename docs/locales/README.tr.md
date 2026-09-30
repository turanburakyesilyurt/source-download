<p align="center">
  <img src="../../icons/icon128.png" width="96" height="96" alt="Source Download Icon">
</p>

<h1 align="center">Source Download</h1>

<p align="center">
  <a href="../../README.md"><img src="https://img.shields.io/badge/Language-English-4f8cff?style=flat-square" alt="English"></a>
  <a href="README.tr.md"><img src="https://img.shields.io/badge/Dil-T%C3%BCrk%C3%A7e-e11d48?style=flat-square" alt="Türkçe"></a>
  <a href="README.de.md"><img src="https://img.shields.io/badge/Sprache-Deutsch-333333?style=flat-square" alt="Deutsch"></a>
  <a href="README.es.md"><img src="https://img.shields.io/badge/Idioma-Espa%C3%B1ol-eab308?style=flat-square" alt="Español"></a>
  <a href="README.ja.md"><img src="https://img.shields.io/badge/%E8%A8%80%E8%AA%9E-%E6%97%A5%E6%9C%AC%E8%AA%9E-dc2626?style=flat-square" alt="日本語"></a>
  <a href="README.ru.md"><img src="https://img.shields.io/badge/%D0%AF%D0%B7%D1%8B%D0%BA-%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-0284c7?style=flat-square" alt="Русский"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-b91c1c?style=flat-square" alt="简体中文"></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/Langue-Fran%C3%A7ais-0055a5?style=flat-square" alt="Français"></a>
  <a href="README.pt-BR.md"><img src="https://img.shields.io/badge/Idioma-Portugu%C3%AAs-009c3b?style=flat-square" alt="Português"></a>
  <a href="README.it.md"><img src="https://img.shields.io/badge/Lingua-Italiano-008c45?style=flat-square" alt="Italiano"></a>
  <a href="README.ko.md"><img src="https://img.shields.io/badge/%EC%96%B8%EC%96%B4-%ED%95%9C%EA%B5%AD%EC%96%B4-0f4c81?style=flat-square" alt="한국어"></a>
</p>

<p align="center">
  <em>Geliştiriciler, tasarımcılar ve araştırmacılar için hepsi bir arada web varlık indirici, tam sayfa ekran görüntüsü motoru ve veri çıkarma tezgâhı.</em><br>
  Bir web sayfasının yüklediği <b>tüm varlıkları</b> — görseller, SVG, video, ses, JS, CSS, yazı tipleri, JSON, WASM, manifestler, canlı tablolar ve dikişsiz tam sayfa ekran görüntüleri — tek tek veya klasör yapısı korunmuş bir ZIP olarak zahmetsizce inceleyin ve indirin.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd"><img src="https://img.shields.io/chrome-web-store/v/nockdgincmpfojabnhbofkddgcmnodpd?style=flat-square&logo=googlechrome&label=Chrome%20Web%20Store" alt="Chrome Web Store"></a>
  <img src="https://img.shields.io/badge/version-1.15.0-4f8cff?style=flat-square" alt="Version 1.15.0">
  <img src="https://img.shields.io/badge/Chrome%20Manifest-V3-00C853?style=flat-square" alt="Manifest V3">
  <img src="https://img.shields.io/badge/dependencies-zero-22c55e?style=flat-square" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/build--step-none-22c55e?style=flat-square" alt="No Build Step">
  <img src="https://img.shields.io/badge/privacy-100%25%20local%20%7C%20zero%20telemetry-22c55e?style=flat-square" alt="Zero Telemetry">
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/language-Pure%20JavaScript-facc15?style=flat-square" alt="Pure JavaScript">
  <img src="https://img.shields.io/badge/browsers-Chrome%20%7C%20Edge%20%7C%20Brave%20%7C%20Opera-9333ea?style=flat-square" alt="Compatible Browsers">
</p>

---

## Merhaba, Ben Turan Burak Yeşilyurt

Yıllarca **web scraping**, **veri analizi** ve **QA otomasyonları** üzerine sistemler kurdum. Modern web tek sayfalı uygulamalara (SPA) evrildikçe hep aynı engelle karşılaştım: son kullanıcı olarak ekranda gördüğünüz bir şeyi kolayca bilgisayarınıza indiremiyorsunuz, geliştirici olarak ise Chrome DevTools penceresi kimi zaman yetersiz kimi zaman ise aşırı kalabalık hissettiriyor. **Source Download** tam olarak bu ihtiyacı eksiksiz karşılamak için doğdu.

Geri bildirimleriniz ve deneyimleriniz benim için son derece değerlidir. Bana [**LinkedIn profilimden**](https://www.linkedin.com/in/turan-burak-yesilyurt/) veya [**2run.dev**](https://2run.dev) üzerinden dilediğiniz zaman ulaşabilirsiniz.

> **Chrome Web Store:** [Chrome Web Store Üzerinden Source Download'ı Yükleyin](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd)

---

> **Açık Kaynak Sözü ve Felsefemiz:** Mağazadaki birçok "kaynak indirici" araç, onlarca üçüncü parti kütüphanenin üst üste yığılmasıyla çalışır. Source Download tamamen farklıdır. **ZIP motoru**, **XLSX oluşturucusu**, **HLS birleştiricisi**, **GIF kodlayıcısı** ve **kod formatlayıcıları** dahil her bir satır saf JavaScript ile elle yazılmıştır. Çerçeve (framework), bağımlılık, derleme adımı ve telemetri/izleyici yoktur.

---

## Görsel Tur ve Temel Modüller

Google Chrome DevTools, Sağ Tık Menüsü ve Araç Çubuğu içerisine entegre edilen yüksek çözünürlüklü arayüz modüllerini keşfedin.

### 1. Hepsi Bir Arada Web Varlık Analizcisi ve İndirici
> **★ GELİŞTİRİCİ MÜHENDİSLİK SUİTİ · F12** — Resimleri, SVG vektörlerini, HLS video akışlarını, fontları, kodları ve tabloları tek bir stüdyoda tespit edin, filtreleyin ve indirin.
> 
> `⚡ 17 Varlık Kategorisi` · `🔍 Boyut & Hash Filtreleri` · `📦 ZIP & ZIP64 Paralel Paketleyici` · `🔒 %100 İstemci Taraflı · Sıfır Takip`

<p align="center">
  <img src="../../screenshots/en/01-asset-inspector-downloader.png" width="100%" alt="Hepsi Bir Arada Web Varlık Analizcisi ve İndirici">
</p>

---

### 2. Bölgesel Ekran Kaydedici ve Saf Vanilla GIF Stüdyosu
> **★ BÖLGESEL EKRAN KAYDI · MP4, WEBM & GIF** — Sıfır kenarlık taşmasıyla dilediğiniz alanı seçin. Donanım hızlandırmalı MP4, WebM veya ultra hafif hareketli GIF olarak dışa aktarın.
> 
> `🎬 MP4 (H.264 Donanım Hızlandırma)` · `✨ Saf Vanilla GIF89a (1-15 FPS)` · `🛡️ Sıfır Taşma Mühendisliği` · `⏱️ 60sn Güvenlik Limiti & Bellek Koruma`

<p align="center">
  <img src="../../screenshots/en/02-screen-recorder-gif.png" width="100%" alt="Bölgesel Ekran Kaydedici ve Saf Vanilla GIF Stüdyosu">
</p>

---

### 3. Dikişsiz Tam Sayfa Ekran Görüntüsü ve Akıllı Başlık Gizleme
> **★ PİKSEL HASSASİYETİNDE EKRAN GÖRÜNTÜSÜ · TAM SAYFA & ALAN** — Tüm web sayfasını kaydırıp kayıpsız PNG olarak birleştirin. Kayan başlıkları ve çerez pencerelerini tekrarlanma kusurlarını önlemek için gizler.
> 
> `📜 Dikişsiz Tam Sayfa Otomatik Birleştirme` · `🚫 Akıllı Kayan Öğe Baskılama` · `🎯 Hassas Hedef Çizgileri` · `🖼️ Kayıpsız 24-bit PNG Çıktısı`

<p align="center">
  <img src="../../screenshots/en/03-fullpage-screenshot-capture.png" width="100%" alt="Dikişsiz Tam Sayfa Ekran Görüntüsü ve Akıllı Başlık Gizleme">
</p>

---

### 4. Dinamik Tablolardan Excel (XLSX) ve Öğe Yok Edici
> **★ VERİ ÇIKARMA VE ÖĞE TEMİZLEME** — Sayfalandırılmış dinamik tabloları tek bir Excel çalışma kitabına aktarın. Rahatsız edici bildirimleri ve pencereleri tek tıkla DOM'dan silin.
> 
> `📊 Çok Sayfalı Excel (XLSX) Üreteci` · `📑 Dinamik SPA Anlık Görüntü Geçmişi` · `⚡ Öğe Yok Edici (Dikkat Dağıtıcı Silici)` · `📝 Formatlar: XLSX, Markdown, CSV & HTML`

<p align="center">
  <img src="../../screenshots/en/04-dom-tables-excel-export.png" width="100%" alt="Dinamik Tablolardan Excel (XLSX) ve Öğe Yok Edici">
</p>

---

### 5. Ekran Renk Seçici ve Entegre Kod Güzelleştirici
> **★ GELİŞTİRİCİ VE TASARIMCI ARAÇLARI** — Ekrandaki herhangi bir pikselden renk alın ve 7 renk uzayına dönüştürün. Sıkıştırılmış CSS ve JavaScript dosyalarını anında okunabilir yapın.
> 
> `🎨 Yerel Damlalık & 7 Renk Modeli` · `📋 Tek Tıkla Panoya Format Kopyalama` · `💻 HTML, CSS & JavaScript Kod Çözücü` · `🔍 Gerçek Zamanlı Regex Kod Araması`

<p align="center">
  <img src="../../screenshots/en/05-color-picker-palette.png" width="100%" alt="Ekran Renk Seçici ve Entegre Kod Güzelleştirici">
</p>

---

Bir sayfanın yüklediği tüm web varlıklarını dikişsiz bir şekilde ZIP olarak inceleyin ve indirin.

Source Download — Sayfadaki her varlık tek tık uzağınızda
Source Download, bir web sayfasının yüklediği tüm kaynakları keşfeden, inceleyen ve indiren bir Chrome DevTools panelidir. İster medya dosyalarına, ister geliştirici komut dosyalarına, ister stil varlıklarına veya ağ yanıtlarına ihtiyacınız olsun, bunları bağımsız dosyalar olarak veya düzenli, klasör yapılı bir ZIP olarak kaydedebilirsiniz.

Sıfır üçüncü taraf bağımlılığı ile sıfırdan inşa edildi: ZIP yazıcısı, XLSX oluşturucusu, HLS birleştiricisi ve kod biçimlendiricileri tamamen saf JavaScript ile elle yazılmıştır. Çerçeve yok, derleme adımı yok, telemetri yok. Her şey tarayıcınızda yerel olarak çalışır.

v1.15.0 ile Gelen Yenilikler
- Tam sayfa kaydırmalı ekran görüntüsü ve özel alan kırpma araçları.
- Ekran video kaydı ve hafif hareketli GIF dışa aktarma motoru.
- Anında hex kod kopyalama özelliğine sahip ekran renk seçici damlalık.
- Performans optimizasyonları ve geliştirilmiş DevTools yakalama kararlılığı.

- Genişletilmiş çoklu dil desteği: 4 yeni dil eklendi (Fransızca, İtalyanca, Korece, Brezilya Portekizcesi) — arayüz ve rehberde 11 tam yerelleştirilmiş dil.
- 17 özel canlı sayaçlı kaynak kategorisine yükseltildi.
Neden ihtiyacınız var?
Ekran görüntüsü yetersiz kalır. Düzleştirilmiş bir resim yerine gerçek dosyaları — tam çözünürlüklü görselleri, gerçek video akışlarını, orijinal stil sayfalarını ve komut dosyalarını — doğrudan alın.

DevTools karmaşık gelebilir. Source Download, aynı ağ verilerinin önüne arama, filtreler ve tek tıkla indirme özelliklerine sahip temiz, kategorize edilmiş bir galeri koyar.

SPA'lar her şeyi gizler. Dinamik uygulamalar, sayfa kaynağında asla görmediğiniz varlıklar ve API çağrıları oluşturur. Source Download bunları ara durumlar dahil oluştukları anda yakalar.

Neler yapar?
Her şeyi keşfedin
Ağ yakalamayı (HAR + canlı istekler), medya dosyaları, komut dosyaları, stil sayfaları ve gömülü çerçeveler dahil tüm görsel ve yapısal öğeler için bir DOM taramasıyla birleştirir.

CSS duyarlı: url(...) ve @import kurallarının içindeki varlıklar özyinelemeli olarak takip edilir, böylece içe aktarılan stil sayfalarına gömülü yazı tipleri bile bulunur.

İçerik koklama: Bilinmeyen dosyaların ilk birkaç baytı okunarak gerçek dosya türü kategorisine yükseltilir.

17 canlı sayaçlı kategori: Yakalanan varlıklar medya, kod, veri, API çağrıları ve belgeler için özel sekmelerde düzenli bir şekilde organize edilir.

Filtreleyin, arayın, inceleyin
Dosya adları, URL'ler, MIME türleri, alt metinler ve hatta dosya içerikleri arasında Regex destekli arama.

Kategori bazlı filtreler: Minimum/maksimum boyut ve medya için minimum/maksimum genişlik ve yükseklik — örneğin "yalnızca ≥ 1200px büyük görseller". API çağrıları HTTP yöntemine ve istek türüne göre filtrelenir.

Sıralanabilir, canlı küçük resim duvarına sahip liste veya ızgara görünümü.

Gerçek önizlemelere sahip çok sekmeli denetçi: Yakınlaştırılabilir ışık kutusu, video ve ses oynatma, canlı yazı tipi örneği, SVG görüntüleyici, satır numaraları ve Biçimlendiriciye sahip sözdizimi vurgulamalı kod.

API bölünmüş görünümü: Solda yanıt, sağda yöntem, durum, sorgu parametreleri ve istek gövdesi.

Düzgün indirin
Seçilenleri İndir — Yalnızca işaretlediğiniz dosyalar.

Görünümü İndir — Geçerli filtreler ve aramadan sonra görünür olan her şey.

Tümünü İndir — Yakalanan her kaynak otomatik tekilleştirme ile klasör yapılı bir ZIP içine kaydedilir.

Toplu indirmeler sınırlandırılmış eşzamanlılık ve canlı ilerleme çubuğu ile çalışır; başarısız olanlar otomatik olarak ve sağ tık menüsünden yeniden denenir.

HLS ve zorlu videolar
Tarayıcının yerel olarak oynatamadığı akışlar (HLS .m3u8, DASH .mpd, bilinmeyen kodekler) siyah bir oynatıcı yerine akıllı bir geri dönüş ekranı gösterir.

Parçaları birleştir ve indir, doğrudan panel içinde bir HLS akışını tek bir oynatılabilir dosyaya dönüştürür.

Metin tezgâhı (SPA içerik araç takımı)
Metin sekmesi canlı bir içerik görüntüleyicisidir: Metin taşıyan her öğe — başlıklar, paragraflar, liste öğeleri, butonlar, div'ler, span'lar — DOM sırasına göre yakalanır.

Dinamik tablolar sınırlı bir anlık görüntü geçmişi tutar (ör. "8 anlık görüntü · 124 benzersiz satır"), böylece otomatik yenilenen panolar ara durumları asla kaybetmez.

Markdown olarak veya tabloları CSV, HTML ya da kendi yazdığımız XLSX motoruyla üretilmiş çok sayfalı gerçek bir XLSX çalışma kitabı olarak dışa aktarın.

Nasıl kullanılır?
Source Download'ı kurun, ardından herhangi bir sayfada F12 tuşuna basın.

DevTools araç çubuğundaki Source Download sekmesine tıklayın (Chrome, uzantıların DevTools'u otomatik açmasına izin vermez — bu yüzden orada yer alır).

Kategori sekmelerine göz atın, arayın, filtreleyin ve sağ paneldeki her şeyi inceleyin.

İstediğiniz dosyaları işaretleyin ve Seçilenleri İndir, Görünümü İndir veya Tümünü İndir butonuna basın.

Her ağ isteğini yakalamak için sayfa yüklenirken DevTools panelini açık tutun.

Gerçek kullanım senaryoları
Rakip analizi: Herhangi bir video kanalındaki tüm video küçük resimlerini minimum genişlik filtresiyle tek bir klasörde toplayın.

Kodsuz web scraping: Bir SPA'nın API çağrılarını izleyin, ihtiyacınız olan uç noktayı filtreleyin, tam JSON yanıtlarını indirin.

Tipografi analizi: Bir sitenin gerçekten hangi yazı tipini kullandığını öğrenin ve gerçek font dosyalarını alın.

Hata yeniden üretme: Bir hata oluştuğunda yayında olan tam CSS/JS sürümlerini saklayın.

Pano veri aktarımı: Otomatik yenilenen bir tabloyu geçmişi dahil çok sayfalı bir Excel çalışma kitabına aktarın.

QA testi: Her A/B yapılandırmasında hangi video/ses varyantının sunulduğunu doğrulayın.

Gizlilik
%100 yerel olarak çalışır. Sunucu yok, analitik yok, hiçbir veri makinenizden ayrılmaz.

Yalnızca asgari izinleri ister: depolama (tercihleriniz), pano (URL kopyalama) ve ana makine erişimi (sayfaları taramak ve dosya gövdelerini almak için).

Dosyalar Chrome'un normal indirme akışı üzerinden kaydedilir — sessiz indirme yapılmaz.

Gereksinimler
Chrome 114 veya daha yenisi (Manifest V3).

En iyi sonuçlar sayfa yüklenirken panel açık olduğunda elde edilir, çünkü ağ yakalama o anda gerçekleşir.

Source Download açık kaynaklı bir projedir — geri bildirimler, fikirler ve katkılar memnuniyetle karşılanır.
LinkedIn: https://www.linkedin.com/in/turan-burak-yesilyurt/

---

## Kurulum ve Hızlı Başlangıç

### Yöntem 1: Chrome Web Store Üzerinden Kurulum (Önerilen)
1. Resmi [Source Download Chrome Web Store](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd) mağaza sayfasını ziyaret edin.
2. **Chrome'a Ekle** butonuna tıklayarak kurulumu onaylayın.
3. Herhangi bir web sayfasında `F12` (veya `Ctrl+Shift+I` / `Cmd+Option+I`) basarak **Source Download** sekmesine geçin veya sayfada sağ tıklayın.

### Yöntem 2: Kaynak Koddan Geliştirici Modu ile Kurulum
1. Depoyu yerel bilgisayarınıza klonlayın:
```bash
git clone https://github.com/turanburakyesilyurt/source-download.git
cd source-download
```
2. Chrome tarayıcısında `chrome://extensions` adresine gidin.
3. Sağ üst köşedeki **Geliştirici modu** (Developer mode) anahtarını açın.
4. **Paketlenmemiş öğe yükle** butonuna tıklayın ve klonladığınız `source-download` klasörünü seçin.

---

## Lisans

[MIT Lisansı](../../LICENSE) kapsamında yayınlanmıştır. Telif Hakkı © Turan Burak Yeşilyurt. Özgürce kullanın, inceleyin ve geliştirin.
