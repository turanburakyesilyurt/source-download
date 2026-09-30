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
  <em>Il downloader universale di risorse web, motore di screenshot a tutta pagina e banco di lavoro DOM in tempo reale.</em><br>
  Esplora, ispeziona e scarica <b>ogni risorsa</b> caricata da una pagina web — immagini, vettori SVG, video, audio, JS, CSS, font, JSON, WASM, manifest, tabelle dinamiche e screenshot senza cuciture — in un archivio ZIP ordinato in cartelle.
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

## Messaggio dell'Autore

Per anni ho creato automazioni per **web scraping**, **analisi dati** e **pipeline QA**. Con la diffusione delle moderne Single Page Application, estrarre i dati visualizzati è diventato spesso complesso. Per questo ho creato **Source Download**.

Collegati con me su [**LinkedIn**](https://www.linkedin.com/in/turan-burak-yesilyurt/) o visita [**2run.dev**](https://2run.dev).

> **Chrome Web Store:** [Installa Source Download dal Chrome Web Store](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd)

---

> **Filosofia Open Source e Zero Dipendenze:** Molte estensioni sono pesanti involucri di librerie esterne. Source Download è scritto interamente a mano: il **motore ZIP**, il **creatore XLSX**, l’**unificatore HLS**, l’**encoder GIF** e il **formattatore di codice** sono realizzati in puro JavaScript vanilla, senza dipendenze, senza passaggi di build e senza telemetria.

---

## Panoramica Visiva dell’Interfaccia e Moduli Principali

Scopri la suite professionale integrata in Chrome DevTools, nel menu contestuale e nel popup della barra degli strumenti.

### 1. Ispettore e Downloader Universale di Risorse Web
> **★ SUITE DI INGEGNERIA DEVTOOLS · F12** — Rileva, esamina, filtra per risoluzione e scarica immagini, vettori SVG, flussi HLS, caratteri, script e tabelle in un unico studio.
> 
> `⚡ 17 Categorie di Risorse` · `🔍 Filtri per Dimensione e Hash` · `📦 Creatore Parallelo ZIP e ZIP64` · `🔒 100% Lato Client · Zero Telemetria`

<p align="center">
  <img src="../../screenshots/en/01-asset-inspector-downloader.png" width="100%" alt="Ispettore e Downloader Universale di Risorse Web">
</p>

---

### 2. Registratore dello Schermo Regionale e Studio GIF Puro
> **★ REGISTRATORE SCHERMO REGIONALE · ZERO SBORDATURE** — Traccia aree personalizzate senza imperfezioni di bordo. Esporta in MP4 accelerato da hardware, WebM o GIF animate senza dipendenze.
> 
> `🎬 MP4 (Accelerazione Hardware H.264)` · `✨ Motore GIF89a Puro senza Librerie (1-15 FPS)` · `🛡️ Struttura con Bordo a Zero Sbordatura` · `⏱️ Limite 60s e Salvaguardia della Memoria`

<p align="center">
  <img src="../../screenshots/en/02-screen-recorder-gif.png" width="100%" alt="Registratore dello Schermo Regionale e Studio GIF Puro">
</p>

---

### 3. Screenshot a Pagina Intera con Soppressione Intelligente delle Intestazioni
> **★ SCREENSHOT AD ALTA PRECISIONE · PAGINA INTERA E AREA** — Scorri e unisci pagine complete in immagini PNG senza perdita di qualità. Nasconde automaticamente le barre fisse per prevenire duplicazioni.
> 
> `📜 Unione Automatica a Pagina Intera` · `🚫 Soppressione Intelligente di Elementi Flottanti` · `🎯 Mirino di Precisione a Croce` · `🖼️ Esportazione PNG a 24 Bit senza Perdita`

<p align="center">
  <img src="../../screenshots/en/03-fullpage-screenshot-capture.png" width="100%" alt="Screenshot a Pagina Intera con Soppressione Intelligente delle Intestazioni">
</p>

---

### 4. Tabelle DOM in Excel (XLSX) e Rimozione Elementi DOM
> **★ ESTRAZIONE DATI E RIMOZIONE ELEMENTI DOM** — Estrai tabelle con paginazione SPA in cartelle di lavoro Excel a più fogli. Elimina banner di cookie e finestre modali con il tasto destro.
> 
> `📊 Generatore Excel a Più Fogli (XLSX)` · `📑 Storico di Cattura da SPA Dinamiche` · `⚡ Eliminazione di Banner e Distrazioni` · `📝 Formati: XLSX, Markdown, CSV e HTML`

<p align="center">
  <img src="../../screenshots/en/04-dom-tables-excel-export.png" width="100%" alt="Tabelle DOM in Excel (XLSX) e Rimozione Elementi DOM">
</p>

---

### 5. Contagocce Colore Schermo e Formattatore di Codice Integrato
> **★ STRUMENTI PER SVILUPPATORI E DESIGNER** — Preleva colori da qualsiasi pixel dello schermo con le API EyeDropper native. Formatta ed esplora fogli CSS e script JavaScript all'istante.
> 
> `🎨 Contagocce Nativo e 7 Modelli di Colore` · `📋 Copia negli Appunti con 1 Clic` · `💻 Formattatore HTML, CSS e JavaScript` · `🔍 Ricerca Regex nel Codice in Tempo Reale`

<p align="center">
  <img src="../../screenshots/en/05-color-picker-palette.png" width="100%" alt="Contagocce Colore Schermo e Formattatore di Codice Integrato">
</p>

---

Esplora, ispeziona e scarica tutte le risorse caricate da una pagina web facilmente in formato ZIP.

Source Download — Tutte le risorse di una pagina a portata di clic
Source Download è un pannello di Chrome DevTools che rileva, esamina e scarica ogni risorsa caricata da una pagina web. Che si tratti di contenuti multimediali, script, fogli di stile o risposte di rete, salvali come singoli file o in un comodo archivio ZIP strutturato in cartelle.

Sviluppato completamente da zero senza dipendenze esterne: il generatore ZIP, il creatore XLSX, l'unificatore HLS e i formattatori di codice sono scritti a mano in puro JavaScript vanilla. Nessun framework, nessun passaggio di compilazione, nessuna telemetria. Tutto funziona localmente nel tuo browser.

Novità della versione 1.15.0
- Screenshot a tutta pagina con unione continua e ritaglio di aree personalizzate.
- Registrazione video dello schermo ed esportazione di GIF animate leggere.
- Strumento contagocce per prelevare e copiare istantaneamente i codici colore dallo schermo.
- Miglioramenti delle prestazioni e maggiore stabilità del tracker DevTools.
- Supporto multilingua esteso: 4 nuove lingue (francese, italiano, coreano, portoghese brasiliano) aggiunte — ora 11 lingue interamente localizzate nell'interfaccia e nella guida utente.
- Passaggio a 17 categorie dedicate di risorse con conteggio in tempo reale.

Perché è indispensabile
Uno screenshot piatto non è sempre sufficiente. Ottieni i file autentici: immagini alla massima risoluzione, flussi video originali, fogli di stile e script di codice completi.

Il DevTools standard può apparire complicato. Source Download mette a disposizione una galleria chiara e ordinata sugli stessi dati di rete, con filtri intuitivi e download rapido.

I siti moderni caricano risorse dinamiche in background. Source Download intercetta le chiamate API e le risorse generate in tempo reale, compresi gli stati intermedi.

Funzionalità Principali
Rilevamento Approfondito
Combina l'analisi delle richieste di rete con l'ispezione della struttura DOM per individuare ogni singolo elemento della pagina.

Scansione CSS Ricorsiva: segue le direttive url(...) e @import per scovare font e grafiche incorporati nel foglio di stile.

Riconoscimento Tramite Firme File: controlla i primi byte delle risorse con estensione non standard per assegnarle alla categoria giusta.

17 Categorie con conteggio in tempo realee Ben Organizzate: elementi multimediali, codice, dati e documenti suddivisi con ordine.

Filtri e Anteprima
Ricerca tramite testo normale o espressioni regolari (Regex) su nomi file, indirizzi URL e tipi MIME.

Filtri per dimensione del file (KB) e dimensioni grafiche (larghezza e altezza in pixel per le immagini).

Visualizzazione a griglia o ad elenco, con visualizzatore interno per immagini, audio, video, vettori SVG e sorgenti formattati.

Download Ordinato e Senza Duplicati
Scarica i file selezionati, la vista filtrata o l'intero pacchetto della pagina in un archivio ZIP con filtro automatico delle immagini duplicate.

Gestione Flussi Video HLS
Riconosce i flussi di streaming HLS (.m3u8) e consente di unire i segmenti video direttamente dal pannello in un file scaricabile.

Estrazione di Testo e Tabelle
Cattura tabelle di dati in tempo reale mantenendo la cronologia degli aggiornamenti ed esporta in formato Markdown, CSV o foglio di calcolo Excel XLSX multischeda.

Guida Rapida all'Uso

### 1. Installa Source Download e premi F12 su qualsiasi scheda del browser.


### 2. Seleziona il pannello Source Download negli strumenti per sviluppatori.


### 3. Consulta le categorie, applica i filtri necessari e spunta i file desiderati.


### 4. Avvia il download nell'archivio o nel formato prescelto.


Tutela della Privacy
Funziona al 100% in locale nella sandbox del tuo browser. Nessun server remoto, nessun invio di dati statistici e nessuna raccolta di informazioni.

Requisiti
Google Chrome 114 o versione successiva (Manifest V3).

Source Download è un software open source. Il tuo riscontro è sempre benvenuto.
Profilo LinkedIn: https://www.linkedin.com/in/turan-burak-yesilyurt/

---

## Installazione e Avvio Rapido

### Metodo 1: Installazione ufficiale tramite Chrome Web Store (Consigliato)
1. Visita la [pagina ufficiale del Chrome Web Store](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd).
2. Fai clic su **Aggiungi a Chrome** e conferma.
3. Premi `F12` (oppure `Cmd+Option+I` su Mac) su qualsiasi pagina e seleziona la scheda **Source Download**.

### Metodo 2: Caricamento dal codice sorgente (Modalità Sviluppatore)
1. Clona il repository ufficiale sul tuo computer:
```bash
git clone https://github.com/turanburakyesilyurt/source-download.git
cd source-download
```
2. Apri `chrome://extensions` nella barra degli indirizzi di Chrome.
3. Abilita la levetta **Modalità sviluppatore** in alto a destra.
4. Fai clic su **Carica estensione non pacchettizzata** e seleziona la cartella `source-download`.

---

## Licenza

Rilasciato sotto la [Licenza MIT](../../LICENSE). Copyright © Turan Burak Yeşilyurt. Libero da usare, esaminare e clonare.
