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
  <em>Универсальный инструмент для загрузки веб-ресурсов, создания полных скриншотов страниц и извлечения данных DOM для разработчиков, дизайнеров и тестировщиков.</em><br>
  Просматривайте, анализируйте и скачивайте <b>все ресурсы</b> страницы — изображения, SVG, видео, аудио, JS, CSS, шрифты, JSON, WASM, манифесты, таблицы и полностраничные скриншоты — в структурированном ZIP-архиве.
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

## Привет, я Turan Burak Yeşilyurt

В течение многих лет я создавал системы автоматизации для **веб-скрейпинга**, **анализа данных** и **тестирования QA**. С переходом веба на архитектуру SPA возникла проблема: пользователю трудно сохранить то, что отображается на экране, а стандартные DevTools слишком громоздки. **Source Download** создан для быстрого, чистого и полностью локального решения этой задачи.

Свяжитесь со мной в [**LinkedIn**](https://www.linkedin.com/in/turan-burak-yesilyurt/) или посетите [**2run.dev**](https://2run.dev).

> **Chrome Web Store:** [Установить Source Download из Chrome Web Store](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd)

---

> **Принцип открытого исходного кода:** Многие сторонние расширения представляют собой громоздкие надстройки над чужими библиотеками. В Source Download каждая строка — включая модуль **ZIP**, генератор **XLSX**, сборщик **HLS** и **GIF-кодировщик** — написана вручную на чистом JavaScript. Никаких фреймворков, никаких внешних зависимостей, никакой сборки и никакой телеметрии.

---

## Визуальный обзор и основные модули

Изучите интерфейсные модули высокого разрешения, интегрированные в DevTools, боковую панель и всплывающее окно Chrome.

### 1. Универсальный инспектор и загрузчик веб-ресурсов
> **★ ИНЖЕНЕРНЫЙ НАБОР DEVTOOLS · F12** — Находите, проверяйте, фильтруйте по разрешению и загружайте изображения, SVG-векторы, потоки HLS, шрифты, скрипты и таблицы в единой студии.
> 
> `⚡ 17 Категорий Ресурсов` · `🔍 Фильтры по Размерам и Хэшу` · `📦 Параллельный Архиватор ZIP & ZIP64` · `🔒 100% На Стороне Клиента · Без Слежки`

<p align="center">
  <img src="../../screenshots/en/01-asset-inspector-downloader.png" width="100%" alt="Универсальный инспектор и загрузчик веб-ресурсов">
</p>

---

### 2. Запись выделенной области экрана и чистая GIF-студия
> **★ ЗАПИСЬ ВЫДЕЛЕННОЙ ОБЛАСТИ · MP4, WEBM И GIF** — Точное выделение области без захвата рамки. Экспортируйте аппаратный MP4, WebM или сверхлегкие анимированные GIF.
> 
> `🎬 MP4 (Аппаратное ускорение H.264)` · `✨ Чистый Vanilla GIF89a (1-15 FPS)` · `🛡️ Защита от захвата рамок` · `⏱️ Лимит 60с и защита оперативной памяти`

<p align="center">
  <img src="../../screenshots/en/02-screen-recorder-gif.png" width="100%" alt="Запись выделенной области экрана и чистая GIF-студия">
</p>

---

### 3. Скриншот всей страницы без швов с умным скрытием шапок
> **★ ВЫСОКОТОЧНЫЕ СКРИНШОТЫ · ВСЯ СТРАНИЦА И ОБЛАСТЬ** — Автоматическая прокрутка и склейка страницы в файл PNG без потерь. Скрывает плавающие меню и виджеты для устранения повторов.
> 
> `📜 Автоматическая бесшовная склейка страниц` · `🚫 Умное скрытие плавающих элементов` · `🎯 Высокоточные направляющие` · `🖼️ Экспорт в 24-битный PNG без потерь`

<p align="center">
  <img src="../../screenshots/en/03-fullpage-screenshot-capture.png" width="100%" alt="Скриншот всей страницы без швов с умным скрытием шапок">
</p>

---

### 4. Экспорт динамических таблиц в Excel (XLSX) и DOM-ластик
> **★ ИЗВЛЕЧЕНИЕ ДАННЫХ И ОЧИСТКА СТРАНИЦЫ** — Сбор данных из многостраничных таблиц в единую книгу Excel с форматированием. Удаляйте назойливые баннеры и окна кликом правой кнопки.
> 
> `📊 Многостраничный генератор Excel (XLSX)` · `📑 История снимков динамических SPA` · `⚡ DOM-Ластик (Удаление мешающих блоков)` · `📝 Форматы: XLSX, Markdown, CSV и HTML`

<p align="center">
  <img src="../../screenshots/en/04-dom-tables-excel-export.png" width="100%" alt="Экспорт динамических таблиц в Excel (XLSX) и DOM-ластик">
</p>

---

### 5. Пипетка цветов экрана и форматировщик кода
> **★ ИНСТРУМЕНТЫ ДЛЯ РАЗРАБОТЧИКОВ И ДИЗАЙНЕРОВ** — Выбирайте цвета с любых пикселей экрана через EyeDropper с конвертацией в 7 форматов. Распаковывайте сжатый CSS и JS код с поиском по regex.
> 
> `🎨 Системная пипетка и 7 цветовых моделей` · `📋 Копирование формата в буфер в 1 клик` · `💻 Распаковщик кода HTML, CSS и JavaScript` · `🔍 Поиск по регулярным выражениям в коде`

<p align="center">
  <img src="../../screenshots/en/05-color-picker-palette.png" width="100%" alt="Пипетка цветов экрана и форматировщик кода">
</p>

---

Удобный просмотр и скачивание всех веб-ресурсов страницы в виде единого ZIP-архива.

Source Download — все файлы страницы в один клик
Source Download — это панель Chrome DevTools, которая находит, анализирует и скачивает любые ресурсы, загружаемые веб-страницей. Будь то медиафайлы, скрипты, таблицы стилей или ответы сети — вы можете сохранить их по отдельности или упаковать в структурированный ZIP-архив с сохранением папок.

Создано с нуля без сторонних библиотек: упаковщик ZIP, генератор XLSX, модуль объединения HLS и форматирование кода написаны вручную на чистом JavaScript. Никаких фреймворков, компиляции и телеметрии. Все процессы выполняются локально в вашем браузере.

Что нового в версии 1.15.0
- Создание длинных снимков всей страницы с прокруткой и вырезка произвольных областей.
- Запись видео с экрана и экспорт компактных анимаций в формате GIF.
- Экранная пипетка для мгновенного копирования цветовых hex-кодов.
- Оптимизация быстродействия и повышенная стабильность перехвата сетевых ресурсов.
- Расширенная многоязычная поддержка: добавлено 4 новых языка (французский, итальянский, корейский, бразильский португальский) — теперь 11 полностью локализованных языков интерфейса и руководства.
- Переход на 17 специализированных категорий ресурсов со счетчиками в реальном времени.

Зачем это нужно
Обычного скриншота часто недостаточно. Получайте оригинальные файлы — исходные изображения высокого разрешения, потоковое видео, оригинальные стили и скрипты вместо плоской картинки.

DevTools может казаться перегруженным. Source Download представляет сетевые данные в виде понятной галереи с поиском, фильтрами и скачиванием в один клик.

SPA-приложения загружают данные незаметно. Современные сайты создают ресурсы и запросы к API динамически. Расширение фиксирует их в момент появления, включая промежуточные состояния.

Возможности
Полное обнаружение ресурсов
Объединяет перехват сетевых запросов и сканирование DOM для поиска всех элементов, включая медиафайлы, скрипты, стили и встроенные фреймы.

Умный анализ CSS: рекурсивно проверяет правила url(...) и @import, находя даже глубоко спрятанные веб-шрифты.

15 наглядных категорий: найденные файлы аккуратно распределяются по вкладкам для медиа, кода, данных, API и документов.

Поиск, фильтры и просмотр
Поиск с поддержкой регулярных выражений по именам файлов, адресам и типам контента.

Фильтрация по размеру файлов, а также по ширине и высоте изображений.

Инспектор с полноценным предпросмотром: масштабируемый просмотр картинок, встроенный плеер для аудио и видео, просмотр шрифтов и кода с подсветкой синтаксиса.

Гибкое скачивание
Скачивание только отмеченных файлов, текущего отфильтрованного списка или всех найденных ресурсов в ZIP-архив с удалением дубликатов.

Объединение видео HLS
Сегменты потокового видео HLS (.m3u8) можно объединить в один готовый видеофайл прямо внутри панели.

Таблицы и текст
Отслеживает изменения таблиц на динамических страницах и позволяет экспортировать данные в форматы Markdown, CSV или многостраничные книги Excel (XLSX).

Как пользоваться

### 1. Установите Source Download и нажмите F12 на любой веб-странице.


### 2. В панели Chrome DevTools выберите вкладку Source Download.


### 3. Просматривайте категории, применяйте фильтры и отмечайте нужные файлы.


### 4. Нажмите кнопку скачивания.


Конфиденциальность
Работает на 100% локально. Без внешних серверов, аналитики и передачи данных. Файлы сохраняются стандартными средствами Chrome.

Требования
Chrome 114 или новее (Manifest V3).

Source Download — проект с открытым исходным кодом. Будем рады вашим отзывам и предложениям.
LinkedIn: https://www.linkedin.com/in/turan-burak-yesilyurt/

---

## Установка и начало работы

### Способ 1: Установка из Chrome Web Store (Рекомендуется)
1. Перейдите на официальную страницу в [Chrome Web Store](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd).
2. Нажмите **Установить**.
3. Откройте Chrome DevTools (`F12` или `Cmd+Option+I` на macOS) и перейдите на вкладку **Source Download**.

### Способ 2: Загрузка распакованного расширения из исходного кода
1. Клонируйте репозиторий GitHub:
```bash
git clone https://github.com/turanburakyesilyurt/source-download.git
cd source-download
```
2. Откройте Chrome и перейдите по адресу `chrome://extensions`.
3. Включите переключатель **Режим разработчика** в правом верхнем углу.
4. Нажмите **Загрузить распакованное расширение** и выберите папку проекта.

---

## Лицензия

Распространяется под [Лицензия MIT](../../LICENSE). Авторские права © Turan Burak Yeşilyurt. Свободно для использования, аудита и форка.
