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
  <em>開発者・デザイナー・QAエンジニア・リサーチャーのためのWebアセット一括抽出、全画面スクロールキャプチャ、リアルタイムDOM作業環境。</em><br>
  Webページが読み込む<b>すべてのリソース</b> — 画像、SVG、動画、音声、JS、CSS、Webフォント、JSON、WASM、マニフェスト、動的テーブル、ピクセル完全な全画面スクリーンショット — を階層型ZIPとして安全に検査・一括ダウンロード。
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

## 開発者メッセージ: Turan Burak Yeşilyurt

Webスクレイピング、データ分析、QAテスト自動化に長年携わってきました。シングルページアプリケーション（SPA）が主流となった現代、画面上のデータを簡単に保存できなかったり、DevToolsが過度に複雑に感じられる課題がありました。**Source Download** は、それらを解決するために生まれました。

[**LinkedIn**](https://www.linkedin.com/in/turan-burak-yesilyurt/) または [**2run.dev**](https://2run.dev) で気軽につながり、フィードバックをお聞かせください。

> **Chrome Web Store:** [Chrome Web StoreからSource Downloadをインストール](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd)

---

> **オープンソースへのこだわりと設計哲学:** ストアに存在する類似ツールの多くは、外部ライブラリを大量に重ねたラッパーに過ぎません。Source Downloadは根本から異なります。**ZIP生成エンジン**、**XLSXビルダー**、**HLS動画マージ**、**GIFエンコーダー**、**コード整形ツール**に至るまで、すべての行が純粋なVanilla JavaScriptでゼロから手書きされています。外部依存関係ゼロ、ビルド手順不要、テレメトリ/追跡コード一切なし。

---

## ビジュアルツアー＆主要機能モジュール

Google Chrome DevTools、右クリックコンテキストメニュー、ツールバーポップアップにネイティブ統合された機能をご覧ください。

### 1. オールインワンWebアセット抽出＆ダウンローダー
> **★ デベロッパー向けエンジニアリングスイート · F12** — 画像、SVGベクター、HLS動画配信、フォント、スクリプト、テーブルを1つのスタジオで検出、解像度で絞り込み、ZIPダウンロード。
> 
> `⚡ 17種類のアセットカテゴリ` · `🔍 解像度＆ハッシュフィルター` · `📦 ZIP / ZIP64 並列アーカイブ` · `🔒 100%クライアント側処理 · 送信ゼロ`

<p align="center">
  <img src="../../screenshots/en/01-asset-inspector-downloader.png" width="100%" alt="オールインワンWebアセット抽出＆ダウンローダー">
</p>

---

### 2. 範囲指定スクリーンレコーダー＆軽量GIF作成スタジオ
> **★ 画面範囲指定レコーダー · MP4, WEBM & GIF** — 枠線の映り込みが一切ない正確な範囲選択。ハードウェアアクセラレーション対応MP4、WebM、または超軽量アニメーションGIFを出力。
> 
> `🎬 MP4 (H.264 ハードウェア高速化)` · `✨ ピュアVanilla GIF89a (1-15 FPS)` · `🛡️ 境界線ゼロ映り込み技術` · `⏱️ 60秒セーフティガード＆メモリ保護`

<p align="center">
  <img src="../../screenshots/en/02-screen-recorder-gif.png" width="100%" alt="範囲指定スクリーンレコーダー＆軽量GIF作成スタジオ">
</p>

---

### 3. 全画面スクロールキャプチャ＆追従ヘッダー自動除去
> **★ 高精細スクリーンショット · フルページ＆範囲選択** — ページ全体を自動スクロールして継ぎ目のないロスレスPNGとして結合。追従メニューやチャット通知を自動で隠して重複を防ぎます。
> 
> `📜 継ぎ目なし全画面オートスティッチング` · `🚫 画面追従ヘッダー自動抑制` · `🎯 十字ガイド付き高精度選択` · `🖼️ ロスレス 24-bit PNG エクスポート`

<p align="center">
  <img src="../../screenshots/en/03-fullpage-screenshot-capture.png" width="100%" alt="全画面スクロールキャプチャ＆追従ヘッダー自動除去">
</p>

---

### 4. 動的DOMテーブルをExcel (XLSX) へ出力＆不要要素消去
> **★ データスクレイピング＆不要要素消去ツール** — 複数ページに分かれたSPAテーブルを統合して複数シートのExcelファイルに変換。邪魔なクッキー通知やバナーは右クリックで即座に消去。
> 
> `📊 複数シートExcel (XLSX) 生成エンジン` · `📑 動的SPAテーブルのスナップショット履歴` · `⚡ 不要要素イレイサー (邪魔な枠を即消去)` · `📝 出力対応: XLSX, Markdown, CSV, HTML`

<p align="center">
  <img src="../../screenshots/en/04-dom-tables-excel-export.png" width="100%" alt="動的DOMテーブルをExcel (XLSX) へ出力＆不要要素消去">
</p>

---

### 5. 画面カラーピッカー＆統合コード整形ツール
> **★ エンジニア＆デザイナー向けユーティリティ** — ネイティブEyeDropperで画面上の任意の色を取得し7つの形式に変換。圧縮されたCSSやJavaScriptを瞬時に読みやすい形式へ復元。
> 
> `🎨 ネイティブスポイト＆7種類のカラーモデル` · `📋 1クリックでクリップボードへ形式コピー` · `💻 HTML, CSS, JavaScript コード整形` · `🔍 リアルタイム正規表現コード検索`

<p align="center">
  <img src="../../screenshots/en/05-color-picker-palette.png" width="100%" alt="画面カラーピッカー＆統合コード整形ツール">
</p>

---

Webページが読み込むすべてのリソースを、ZIP形式で手軽に調査・ダウンロード。

Source Download — ページ上の全アセットをワンクリックで取得
Source Downloadは、Webページが読み込むあらゆるリソースを検出し、プレビュー、保存できるChrome DevTools拡張機能です。画像や動画、音声などのメディアファイルから、JavaScript、CSS、APIレスポンスまで、個別保存またはフォルダ構造を維持したZIPアーカイブとしてまとめてダウンロードできます。

サードパーティ製ライブラリを一切使用せず、完全にゼロから開発：ZIP生成、XLSX作成、HLS結合、コード整形機能はすべて純粋なVanilla JavaScriptで実装されています。フレームワーク不要、ビルド工程なし、テレメトリや外部通信もありません。すべてがブラウザ内部で安全に実行されます。

バージョン 1.15.0 の新機能
- ページ全体のスクロールスクリーンショット撮影および自由な範囲選択キャプチャ機能。
- 画面録画および軽量なアニメーションGIF書き出し機能。
- 画面上のカラーコードを即座にコピーできるスポイトツール。
- パフォーマンスの最適化とリソース検出機能の安定性向上。
- 多言語サポートの大幅拡充: 新たに4言語（フランス語、イタリア語、韓国語、ブラジルポルトガル語）を追加 — UIおよびユーザーガイドで計11言語に完全対応。
- リアルタイムカウンターを備えた17の専用リソースカテゴリーへアップグレード。

本拡張機能の特長
単なるスクリーンショットでは不十分な場面に。圧縮された画像ではなく、高解像度の元画像、実際のストリーミング動画、オリジナルのCSSやJSファイルを直接手に入れることができます。

DevToolsの操作をよりわかりやすく。ネットワーク通信データを、整理された見やすいギャラリー形式で表示。検索やフィルタリング、ワンクリックダウンロードを直感的に行えます。

SPAの動的コンテンツもしっかり捕捉。近年のWebアプリで動的に生成されるAPI通信や非同期リソースも、生成された瞬間に確実に記録します。

主な機能
網羅的なリソース検出
ネットワークリクエストとDOM構造の解析を組み合わせ、メディア、スクリプト、スタイル、埋め込みフレームなどを包括的に検出します。

CSS内のフォント探索：CSSのurl(...)や@importルールを再帰的に解析し、外部読み込みされたWebフォントも逃さず検出します。

15種類のカテゴリ分類：検出されたリソースをメディア、コード、データ、API、ドキュメントなどのタブに自動整理。

検索・フィルタリング・プレビュー
正規表現対応のキーワード検索、ファイル容量や画像の縦横ピクセル数による詳細な絞り込みに対応。

拡大表示可能な画像ライトボックス、動画・音声プレイヤー、フォント見本、構文ハイライト付きコードビューアを内蔵。

多彩なダウンロードオプション
選択したファイルのみ、フィルタ適用後の表示内容、または重複を自動排除した全リソースのZIP一括保存が可能。

HLS動画の結合
ブラウザで直接再生できないHLS形式（.m3u8）のセグメントを結合し、単一の再生可能ファイルとして保存できます。

表データとテキストの抽出
動的なWebテーブルの変化履歴を保持し、Markdown、CSV、または複数シート対応のExcel（XLSX）形式で直接エクスポート可能です。

使い方

### 1. インストール後、任意のページでF12キーを押してDevToolsを開きます。


### 2. DevTools上部のタブから「Source Download」を選択します。


### 3. カテゴリの確認やフィルタリングを行い、必要なファイルを選択します。


### 4. ダウンロードボタンを押して保存します。


プライバシー
100%クライアントサイドで動作します。外部サーバーへの通信やデータ収集、トラッキングは一切行いません。

動作要件
Chrome 114以降（Manifest V3対応）。

Source Downloadはオープンソースプロジェクトです。フィードバックをお待ちしております。
LinkedIn: https://www.linkedin.com/in/turan-burak-yesilyurt/

---

## インストールとクイックスタート

### 方法 1: Chrome Web Store からの公式インストール（推奨）
1. [Chrome Web Store公式ページ](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd) にアクセスします。
2. 「**Chrome に追加**」をクリックして確認します。
3. 任意のWebページで `F12`（macOSは `Cmd+Option+I`）を押し、「**Source Download**」タブに切り替えるか、ページ上で右クリックします。

### 方法 2: ソースコードから開発者モードで読み込む（Unpacked）
1. Gitリポジトリをローカルにクローンします:
```bash
git clone https://github.com/turanburakyesilyurt/source-download.git
cd source-download
```
2. Chromeで `chrome://extensions` を開きます。
3. 画面右上の「**デベロッパーモード**」を有効にします。
4. 「**パッケージ化されていない拡張機能を読み込む**」をクリックし、クローンした `source-download` フォルダを選択します。

---

## ライセンス

[MIT ライセンス](../../LICENSE) の下で公開されています。Copyright © Turan Burak Yeşilyurt. 自由に検査・利用・フォークいただけます。
