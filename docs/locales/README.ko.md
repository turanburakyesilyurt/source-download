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
  <em>웹 리소스 일괄 다운로더, 무손실 전체 페이지 스크린샷 엔진 및 실시간 DOM 추출 스위트.</em><br>
  웹 페이지가 로드하는 <b>모든 자산</b>을 손쉽게 검사하고 다운로드하세요 — 이미지, SVG, 동영상, 오디오, JS, CSS, 폰트, JSON, WASM, 매니페스트, 실시간 테이블 데이터 및 픽셀 단위 전체 페이지 스크린샷을 폴더별로 정리된 ZIP 아카이브로 보관할 수 있습니다.
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

## 개발자 인사말

오랫동안 **웹 스크래핑**, **데이터 분석**, **QA 자동화** 파이프라인을 구축해 오면서 화면에 보이는 자산을 손쉽게 수집하지 못하는 불편함을 겪었습니다. 개발자와 사용자 모두를 위해 직관적이고 강력한 도구로 완성한 것이 바로 **Source Download**입니다.

[**LinkedIn**](https://www.linkedin.com/in/turan-burak-yesilyurt/) 또는 [**2run.dev**](https://2run.dev)에서 언제든지 소통하실 수 있습니다.

> **Chrome Web Store:** [Chrome 웹 스토어 공식 페이지에서 Source Download 설치](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd)

---

> **오픈 소스 철학 및 100% 무의존성 순수 구현 약속:** 수많은 확장 프로그램이 무거운 외부 패키지에 의존합니다. Source Download는 순수함을 추구합니다: **ZIP 패키징 엔진**, **XLSX 스프레드시트 빌더**, **HLS 비디오 병합기**, **GIF 애니메이션 인코더**, **코드 포맷터**를 포함한 모든 기능이 외부 라이브러리 없이 100% 바닐라 자바스크립트로 직접 구현되었으며, 빌드 단계와 텔레메트리 수집이 전혀 없습니다.

---

## 기능 인터페이스 시각 가이드 및 주요 모듈

Google Chrome DevTools, 마우스 우클릭 컨텍스트 메뉴 및 툴바 팝업에 완벽하게 통합된 전문가용 작업 공간을 둘러보세요.

### 1. 올인원 웹 리소스 인스펙터 및 일괄 다운로더
> **★ DEVTOOLS 엔지니어링 스위트 · F12** — 하나의 통합 스튜디오에서 이미지, SVG 벡터, HLS 스트리밍 비디오, 웹 폰트, 스크립트 및 테이블 데이터를 탐색, 검사, 필터링 및 다운로드하세요.
> 
> `⚡ 17가지 웹 리소스 카테고리` · `🔍 해상도 치수 및 해시 중복 필터` · `📦 대용량 ZIP & ZIP64 병렬 압축기` · `🔒 100% 클라이언트 사이드 · 텔레메트리 제로`

<p align="center">
  <img src="../../screenshots/en/01-asset-inspector-downloader.png" width="100%" alt="올인원 웹 리소스 인스펙터 및 일괄 다운로더">
</p>

---

### 2. 정밀 영역 화면 녹화기 및 순수 GIF 스튜디오
> **★ 정밀 영역 화면 녹화기 · 제로 블리드** — 테두리 번짐 없는 맞춤형 화면 영역을 지정하여 녹화하세요. 하드웨어 가속 MP4, WebM 또는 외부 라이브러리 없는 순수 GIF로 내보낼 수 있습니다.
> 
> `🎬 MP4 (H.264 하드웨어 가속 지원)` · `✨ 외부 라이브러리 없는 순수 GIF89a (1-15 FPS)` · `🛡️ 외곽 프레임 제로 블리드 엔지니어링` · `⏱️ 1분(60초) 제한 및 메모리 보호`

<p align="center">
  <img src="../../screenshots/en/02-screen-recorder-gif.png" width="100%" alt="정밀 영역 화면 녹화기 및 순수 GIF 스튜디오">
</p>

---

### 3. 스티키 헤더 자동 억제 기능이 탑재된 전체 페이지 스크린샷
> **★ 고정밀 스크린샷 스위트 · 전체 페이지 & 영역** — 페이지 전체를 부드럽게 스크롤하여 무손실 PNG 이미지로 자동 병합합니다. 고정 상단바와 플로팅 챗봇을 자동으로 숨겨 중복 왜곡을 방지합니다.
> 
> `📜 자동 스크롤 전체 페이지 스크린샷` · `🚫 플로팅/스티키 요소 스마트 억제` · `🎯 고정밀 십자선 영역 가이드` · `🖼️ 무손실 24비트 고해상도 PNG 출력`

<p align="center">
  <img src="../../screenshots/en/03-fullpage-screenshot-capture.png" width="100%" alt="스티키 헤더 자동 억제 기능이 탑재된 전체 페이지 스크린샷">
</p>

---

### 4. 동적 DOM 표를 Excel(XLSX)로 변환 & DOM 요소 제거기
> **★ 데이터 스크래핑 & DOM 요소 제거기** — SPA 페이지의 동적 테이블 데이터를 여러 시트로 구성된 Excel 통합 문서로 추출하세요. 방해되는 배너와 팝업은 마우스 우클릭으로 즉시 숨길 수 있습니다.
> 
> `📊 멀티 시트 지원 Excel 생성기 (XLSX)` · `📑 동적 SPA 테이블 변경 이력 스냅샷` · `⚡ 광고 및 방해 요소 원클릭 제거` · `📝 XLSX, Markdown, CSV, HTML 내보내기`

<p align="center">
  <img src="../../screenshots/en/04-dom-tables-excel-export.png" width="100%" alt="동적 DOM 표를 Excel(XLSX)로 변환 & DOM 요소 제거기">
</p>

---

### 5. 화면 색상 스포이트 및 내장 소스 코드 정렬 뷰어
> **★ 개발자 및 디자이너를 위한 필수 유틸리티** — 기본 EyeDropper API를 사용해 화면의 모든 픽셀에서 색상을 추출하세요. 압축된 CSS 및 자바스크립트 코드를 읽기 쉽게 정렬하고 실시간 정규식으로 검색할 수 있습니다.
> 
> `🎨 네이티브 스포이트 및 7가지 색상 포맷` · `📋 원클릭 클립보드 형식 복사` · `💻 HTML, CSS, JavaScript 코드 정렬기` · `🔍 실시간 정규식 코드 검색 및 하이라이트`

<p align="center">
  <img src="../../screenshots/en/05-color-picker-palette.png" width="100%" alt="화면 색상 스포이트 및 내장 소스 코드 정렬 뷰어">
</p>

---

웹 페이지가 로드하는 모든 리소스를 손쉽게 검사하고 ZIP 파일로 일괄 다운로드하세요.

Source Download — 클릭 한 번으로 웹 페이지의 모든 리소스 추출
Source Download는 웹 페이지가 로드하는 모든 리소스를 자동으로 탐색, 검사 및 다운로드할 수 있는 강력한 Chrome 개발자 도구(DevTools) 확장 프로그램입니다. 미디어 파일, 자바스크립트, CSS 스타일시트, 네트워크 API 응답 등 필요한 모든 파일을 개별 저장하거나 폴더별로 깔끔하게 정리된 ZIP 아카이브로 보관할 수 있습니다.

외부 라이브러리 없이 100% 순수 바닐라 자바스크립트로 개발되었습니다. 내장 ZIP 패키징 엔진, XLSX 생성기, HLS 비디오 병합 모듈, 소스 코드 포맷터까지 모두 자체 구현되었습니다. 무거운 프레임워크나 외부 빌드 도구, 사용자 추적 텔레메트리가 전혀 없어 모든 작업이 브라우저 내부에서만 안전하게 실행됩니다.

v1.15.0 최신 업데이트 내역
- 스티키 헤더 숨김 처리가 적용된 끊김 없는 전체 페이지 스크린샷 및 사용자 지정 영역 캡처.
- 화면 비디오 녹화 및 초경량 애니메이션 GIF 내보내기 기능 추가.
- 화면의 색상 코드를 실시간으로 추출하여 클립보드에 복사하는 스포이트 도구.
- 개발자 도구 네트워크 스니퍼 안정화 및 렌더링 성능 대폭 개선.
- 다국어 지원 대폭 확장: 4개 신규 언어 추가(프랑스어, 이탈리아어, 한국어, 브라질 포르투갈어) — UI 및 사용자 가이드 11개 언어 100% 완벽 현지화.
- 실시간 카운터를 갖춘 17개 전용 리소스 카테고리로 업그레이드.

Source Download가 필요한 이유
단순한 화면 캡처로는 원본 데이터의 가치를 온전히 담아낼 수 없습니다. 고해상도 원본 이미지, 실제 비디오 스트림, 원본 CSS 스타일시트와 소스 스크립트를 손실 없이 그대로 확보하세요.

복잡한 네트워크 탭 대신 직관적인 인터페이스를 제공합니다. 방대한 네트워크 데이터를 17개 카테고리로 명확하게 분류하고 해상도 및 파일 크기 필터, 미리보기 갤러리를 지원합니다.

동적으로 생성되는 웹 리소스도 빠짐없이 캡처합니다. 단일 페이지 애플리케이션(SPA)의 비동기 API 응답과 런타임 DOM 변화를 실시간으로 추적하여 필요한 데이터를 놓치지 않습니다.

핵심 주요 기능
포괄적인 리소스 탐색 엔진
네트워크 요청 모니터링과 DOM 트리 재귀 분석을 결합하여 화면에 보이는 이미지뿐만 아니라 내부 구조적 자산까지 모두 감지합니다.

재귀적 CSS 심층 분석: stylesheet 내부의 url(...) 및 @import 규칙을 끝까지 추적하여 웹 폰트와 배경 이미지를 완벽하게 찾아냅니다.

매직 바이트 서명 감지: 확장자가 모호하거나 누락된 응답도 바이너리 헤더를 정밀 분석하여 올바른 파일 카테고리로 자동 분류합니다.

체계적인 카테고리 구성: 이미지, 벡터 SVG, 동영상, 폰트, 소스 코드, 데이터 시트 및 문서를 한눈에 파악할 수 있습니다.

정밀 필터링 및 라이브 뷰어
파일 이름, URL 경로, MIME 형식 및 정규 표현식(Regex)을 활용한 다기능 검색을 지원합니다.

파일 용량(KB) 필터 및 이미지 가로/세로 픽셀 치수 필터로 필요한 규격의 에셋만 선별할 수 있습니다.

그리드/리스트 뷰 전환 지원과 함께 이미지, 비디오, 오디오 재생 및 SVG, 소스 코드 구문 강조 뷰어를 기본 제공합니다.

중복 제거 및 최적화된 ZIP 패키징
선택된 에셋, 필터링된 결과, 또는 페이지의 전체 자산을 폴더별로 정돈된 ZIP 파일로 즉시 다운로드합니다. 바이트 단위 해시 계산을 통해 중복 이미지를 자동 배제하여 용량을 절약합니다.

HLS 스트리밍 비디오 병합 지원
브라우저에서 직접 재생할 수 없는 HLS(.m3u8) 스트림을 감지하고, 모든 세그먼트를 단일 동영상 파일로 직접 병합하여 저장할 수 있습니다.

실시간 표(Table) 데이터 스크래핑
페이지 내의 동적 데이터 테이블을 감지하고 변경 내역 스냅샷을 보존합니다. 마크다운, CSV 또는 멀티 시트 Excel(XLSX) 문서로 즉각 변환하여 내보낼 수 있습니다.

사용 방법

### 1. 확장 프로그램을 설치한 후 원하는 웹 페이지에서 F12 키를 눌러 개발자 도구를 엽니다.


### 2. 상단 메뉴에서 Source Download 탭을 클릭합니다.


### 3. 카테고리를 선택하거나 필터를 조정한 뒤 원하는 리소스를 확인합니다.


### 4. 개별 다운로드 또는 ZIP 일괄 다운로드를 진행합니다.


개인정보 보호 및 보안
100% 로컬 브라우저 샌드박스 내에서 독립적으로 실행됩니다. 외부 서버와의 통신이 발생하지 않으며, 어떠한 개인 데이터나 브라우징 기록도 수집하지 않습니다.

시스템 요구 사항
Google Chrome 114 이상 (Manifest V3 호환).

Source Download는 지속적으로 발전하는 오픈 소스 프로젝트입니다. 사용 중 소중한 피드백을 언제든지 환영합니다.
개발자 링크: https://www.linkedin.com/in/turan-burak-yesilyurt/

---

## 설치 및 빠른 시작 가이드

### 방법 1: Chrome 웹 스토어 공식 설치 (권장)
1. 공식 [Chrome 웹 스토어 페이지](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd)에 접속합니다.
2. **Chrome에 추가** 버튼을 클릭하고 권한을 확인합니다.
3. 원하는 웹 페이지에서 `F12` (macOS는 `Cmd+Option+I`) 키를 누르고 **Source Download** 탭을 클릭합니다.

### 방법 2: 소스 코드에서 개발자 모드로 직접 로드 (Unpacked)
1. GitHub 공식 저장소를 로컬 컴퓨터로 클론합니다:
```bash
git clone https://github.com/turanburakyesilyurt/source-download.git
cd source-download
```
2. Chrome 브라우저 주소창에 `chrome://extensions`를 입력하여 이동합니다.
3. 우측 상단의 **개발자 모드**(Developer mode) 토글을 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다**(Load unpacked)를 클릭하고 클론한 `source-download` 디렉터리를 선택합니다.

---

## 라이선스

[MIT 라이선스](../../LICENSE) 라이선스 하에 배포됩니다. Copyright © Turan Burak Yeşilyurt. 자유롭게 검토, 사용 및 포크할 수 있습니다.
