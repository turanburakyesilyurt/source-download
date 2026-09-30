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
  <em>专为开发者、设计师、测试人员与数据分析师打造的网页全资源下载、全页长截图与 DOM 数据提取工作台。</em><br>
  轻松审查并下载网页加载的<b>所有资产</b> — 图片、SVG、视频、音频、JS、CSS、字体、JSON、WASM、Manifest、动态表格以及像素级全页长截图 — 统一打包为规范分类的 ZIP 压缩包。
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

## 开发者致辞

多年来，我一直致力于构建自动化 **网络爬虫**、**数据分析** 和 **QA 测试流** 系统。随着单页面应用（SPA）普及，传统工具往往繁琐受限：普通用户无法轻松保存屏幕所见，而 Chrome DevTools 有时又过于复杂。**Source Download** 便是为解决这一痛点而打造的纯粹工具。

欢迎在 [**LinkedIn**](https://www.linkedin.com/in/turan-burak-yesilyurt/) 与我联系，或访问 [**2run.dev**](https://2run.dev)。

> **Chrome Web Store:** [前往 Chrome Web Store 官方安装 Source Download](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd)

---

> **开源理念与手写架构承诺:** 许多同类扩展充斥着臃肿的第三方库包装。Source Download 坚持纯粹手写：包括 **ZIP 引擎**、**XLSX 工作簿生成器**、**HLS 视频合并器**、**GIF 动图编码器** 与 **代码美化器** 在内的每一行代码均完全由纯原生 JavaScript 手写实现，无框架依赖、无第三方外部包、无需构建步骤、无遥测上报。

---

## 功能界面视觉导览与核心模块

探索深度集成于 Google Chrome DevTools、右键快捷上下文菜单与工具栏弹窗的专业工作区。

### 1. 全功能网页资源嗅探与批量下载器
> **★ 开发者专业工程套件 · F12** — 在统一面板中一键探测、分辨率精准过滤并批量打包下载高画质图像、SVG矢量图、HLS流媒体、Web字体、脚本与表格。
> 
> `⚡ 17大网页资源分类` · `🔍 尺寸与文件哈希双重过滤` · `📦 ZIP & ZIP64 并行高速打包` · `🔒 100%纯本地处理 · 零隐私上传`

<p align="center">
  <img src="../../screenshots/en/01-asset-inspector-downloader.png" width="100%" alt="全功能网页资源嗅探与批量下载器">
</p>

---

### 2. 自定义区域屏幕录制与轻量 GIF 动画制作工作室
> **★ 区域屏幕录制 · MP4, WEBM 与 GIF** — 自由拖拽选区且无任何边框溢出。录制硬件加速 MP4、WebM 视频，或输出体积超小的轻量级动图 GIF。
> 
> `🎬 MP4 (H.264 硬件加速编码)` · `✨ 原生纯净 GIF89a 导出 (1-15 FPS)` · `🛡️ 精准零黑边零重影控制` · `⏱️ 60秒安全上限与内存防爆机制`

<p align="center">
  <img src="../../screenshots/en/02-screen-recorder-gif.png" width="100%" alt="自定义区域屏幕录制与轻量 GIF 动画制作工作室">
</p>

---

### 3. 无缝整页长截图与智能悬浮顶栏自动消除
> **★ 像素级超高清截图 · 整页长截图与选区截屏** — 平滑滚动拼接整张网页并输出无损 PNG。自动识别并隐藏吸顶导航栏与聊天气泡，彻底杜绝重复重影。
> 
> `📜 自动平滑滚动无缝长截图` · `🚫 智能吸顶浮动元素消除` · `🎯 像素级十字准星辅助对齐` · `🖼️ 24位全色彩无损 PNG 导出`

<p align="center">
  <img src="../../screenshots/en/03-fullpage-screenshot-capture.png" width="100%" alt="无缝整页长截图与智能悬浮顶栏自动消除">
</p>

---

### 4. 动态网页表格导出 Excel (XLSX) 与 DOM 元素消音器
> **★ 数据提取与干扰元素消除套件** — 跨 SPA 动态分页抓取表格数据并导出为多工作表 Excel 文件。右键一键彻底消除遮挡视线的 Cookie 弹窗和固定遮罩。
> 
> `📊 多工作表 Excel (XLSX) 转换引擎` · `📑 动态 SPA 页面表格快照追溯` · `⚡ 元素消音器 (快速清除页面干扰)` · `📝 支持格式: XLSX, Markdown, CSV, HTML`

<p align="center">
  <img src="../../screenshots/en/04-dom-tables-excel-export.png" width="100%" alt="动态网页表格导出 Excel (XLSX) 与 DOM 元素消音器">
</p>

---

### 5. 屏幕像素级吸色器与内置代码美化展开工具
> **★ 开发者与设计师必备辅助工具** — 通过原生 EyeDropper API 拾取屏幕任意像素并转换为7种色彩格式。毫秒级格式化混淆压缩的代码并支持正则表达式搜索。
> 
> `🎨 原生屏幕滴管与 7 种色彩模型` · `📋 一键将格式化色值拷贝至剪贴板` · `💻 HTML, CSS 与 JavaScript 代码美化` · `🔍 实时代码正则表达式快速搜索`

<p align="center">
  <img src="../../screenshots/en/05-color-picker-palette.png" width="100%" alt="屏幕像素级吸色器与内置代码美化展开工具">
</p>

---

一键无缝探索、查看并以 ZIP 压缩包形式下载网页加载的全部资源。

Source Download — 轻松获取当前页面的所有素材
Source Download 是一款 Chrome 开发者工具（DevTools）面板扩展，用于全面检测、预览和下载网页加载的每一项资源。无论是多媒体素材、开发脚本、样式表还是网络接口响应，您都可以将其作为独立文件保存，或打包为层级清晰的 ZIP 压缩文件。

完全零第三方依赖纯手写打造：内置的 ZIP 压缩引擎、XLSX 导出模块、HLS 视频流合并器以及代码美化工具，全部采用原生纯 JavaScript 手工编写。无任何框架包袱、无需构建打包、无数据埋点统计，一切均在您的浏览器本地高效运行。

v1.15.0 版本更新亮点
- 支持全页面平滑滚动截取长图，以及自由选区屏幕截图。
- 支持屏幕区域录像，并可直接导出为轻量级动态 GIF 动图。
- 内置屏幕吸管取色工具，一键提取并拷贝十六进制颜色代码。
- 全面优化运行性能，大幅提升 DevTools 资源拦截与解析的稳定性。
- 扩展多语言支持：新增 4 种语言（法语、意大利语、韩语、巴西葡萄牙语）——现已在界面与使用指南中全面支持 11 种完全本地化语言。
- 升级至配备实时计数器的 17 个专属资源分类。

核心价值
普通截图无法满足需求。直接提取未经压缩的原始素材——全分辨率高清大图、真实视频流、原始样式与脚本文件，而非单一扁平图片。

解决 DevTools 繁杂难用痛点。Source Download 将相同的网络通信数据转化为清爽直观的分类画廊，支持多维过滤、全文检索与一键批量保存。

轻松应对单页应用（SPA）。现代动态网页加载了大量难以直接在源码中查看的接口与资源，本工具可在数据请求发生的瞬间实时捕获全量素材。

主要功能
全方位深度嗅探
融合网络请求监控与 DOM 节点深度扫描，全面覆盖图片视频、脚本、样式表及嵌入式框架。

智能解析 CSS 引用：深度追踪 url(...) 和 @import 规则，深层嵌套引用的 Web 字体也能精准提取。

15 大专属分类标签：嗅探到的资源自动归类整理至多媒体、代码、数据、接口请求及文档等专属分组。

多维筛选、检索与深度预览
支持使用正则表达式对文件名、URL 地址及 MIME 类型进行精准匹配。

支持按文件体积、图片最小/最大分辨率进行精细过滤。

内置全功能预览视窗：支持高倍率缩放画廊、音视频即时播放、字体瀑布流展示以及带行号的高亮代码预览。

多模式文件下载
支持仅下载勾选项、仅下载当前筛选视图内容，或一键将全部捕获素材打包导出为自动剔除重复项的结构化 ZIP 压缩包。

HLS 视频流智能合并
针对浏览器无法直接单独播放的 HLS (.m3u8) 视频切片，可直接在扩展面板内自动合并为独立的完整视频文件。

数据表格与文本提取
支持捕获动态网页中的 DOM 数据表格，并完整保留翻页历史快照，一键导出为 Markdown、CSV 或多工作表的原生 Excel (XLSX) 文件。

使用方法

### 1. 安装扩展后，在任意网页按下 F12 打开开发者工具。


### 2. 在顶部面板导航中点击进入「Source Download」标签页。


### 3. 浏览各类资源标签，进行检索、过滤和选择。


### 4. 点击下载按钮保存到本地。


隐私安全
100% 纯本地运行。无任何远程服务器通信，不收集任何用户数据与浏览习惯，完全通过 Chrome 原生通道保存文件。

运行环境
Chrome 114 或更高版本（Manifest V3）。

Source Download 属于开源项目，诚邀您的反馈与交流。
LinkedIn: https://www.linkedin.com/in/turan-burak-yesilyurt/

---

## 安装与快速上手

### 方式 1: 通过 Chrome Web Store 官方商店安装（推荐）
1. 访问官方 [Chrome Web Store 商店页面](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd)。
2. 点击 **添加至 Chrome** 并确认权限。
3. 在任意网页按 `F12`（macOS 为 `Cmd+Option+I`）打开开发者工具，切换至 **Source Download** 标签页，或直接在工具栏启动侧边伴侣栏。

### 方式 2: 从源码以开发者模式加载（Unpacked）
1. 克隆 GitHub 官方仓库至本地:
```bash
git clone https://github.com/turanburakyesilyurt/source-download.git
cd source-download
```
2. 在 Chrome 地址栏打开 `chrome://extensions`。
3. 开启右上角的 **开发者模式** (Developer mode) 开关。
4. 点击 **加载已解压的扩展程序** (Load unpacked) 并选择克隆的 `source-download` 项目目录。

---

## 开源协议

采用 [MIT 许可证](../../LICENSE) 发布。版权所有 © Turan Burak Yeşilyurt。欢迎自由审阅、使用及 Fork。
