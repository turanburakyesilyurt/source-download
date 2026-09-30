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
  <em>O baixador universal de recursos web, motor de captura de página inteira e bancada DOM.</em><br>
  Navegue, inspecione e baixe <b>todos os recursos</b> que uma página carrega — imagens, SVGs, vídeos, áudio, JS, CSS, fontes, JSON, WASM, manifestos, tabelas ao vivo e capturas de tela contínuas — em um arquivo ZIP estruturado em pastas.
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

## Mensagem do Autor

Durante anos desenvolvi automações para **raspagem de dados**, **análise web** e **fluxos de QA**. O Source Download nasceu da necessidade real de capturar o que vemos na tela de forma limpa, confiável e sem atritos.

Conecte-se comigo no [**LinkedIn**](https://www.linkedin.com/in/turan-burak-yesilyurt/) ou visite [**2run.dev**](https://2run.dev).

> **Chrome Web Store:** [Instalar Source Download na Chrome Web Store](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd)

---

> **Filosofia de Código Aberto e Zero Dependências:** O Source Download foi construído com arquitetura artesanal: o **motor ZIP**, o **gerador XLSX**, o **unificador HLS**, o **codificador de GIF** e o **formatador de código** foram programados à mão em JavaScript puro. Sem frameworks pesados, sem build steps e sem rastreamento de dados.

---

## Guia Visual da Interface e Módulos Principais

Explore os recursos profissionais integrados ao Google Chrome DevTools, menu de contexto e popup da barra de ferramentas.

### 1. Inspetor e Baixador Universal de Recursos da Web
> **★ SUÍTE DE ENGENHARIA DEVTOOLS · F12** — Detecte, inspecione, filtre por resolução e baixe imagens, vetores SVG, fluxos HLS, fontes, scripts e tabelas em um único estúdio.
> 
> `⚡ 17 Categorias de Recursos` · `🔍 Filtros de Dimensão e Hash` · `📦 Empacotador Paralelo ZIP e ZIP64` · `🔒 100% Lado do Cliente · Zero Telemetria`

<p align="center">
  <img src="../../screenshots/en/01-asset-inspector-downloader.png" width="100%" alt="Inspetor e Baixador Universal de Recursos da Web">
</p>

---

### 2. Gravador de Tela Regional e Estúdio de GIF Puro
> **★ GRAVADOR DE TELA REGIONAL · ZERO SANFONA** — Demarque áreas personalizadas de gravação sem bordas excedentes. Exporte em MP4 acelerado, WebM ou GIFs animados sem bibliotecas.
> 
> `🎬 MP4 (Aceleração de Hardware H.264)` · `✨ Motor GIF89a Puro sem Bibliotecas (1-15 FPS)` · `🛡️ Engenharia com Borda Zero Sangramento` · `⏱️ Limite de 60s e Proteção de Memória`

<p align="center">
  <img src="../../screenshots/en/02-screen-recorder-gif.png" width="100%" alt="Gravador de Tela Regional e Estúdio de GIF Puro">
</p>

---

### 3. Captura de Página Inteira com Supressão Inteligente de Cabeçalhos
> **★ CAPTURAS DE TELA DE ALTA PRECISÃO · PÁGINA INTEIRA E ÁREA** — Role e monte páginas completas em arquivos PNG sem perdas. Oculta automaticamente cabeçalhos fixos e avisos flutuantes para evitar duplicatas.
> 
> `📜 Montagem Automática de Página Inteira` · `🚫 Supressão Inteligente de Itens Flutuantes` · `🎯 Mira Reticulada de Alta Precisão` · `🖼️ Exportação PNG de 24 Bits sem Perdas`

<p align="center">
  <img src="../../screenshots/en/03-fullpage-screenshot-capture.png" width="100%" alt="Captura de Página Inteira com Supressão Inteligente de Cabeçalhos">
</p>

---

### 4. Tabelas DOM para Excel (XLSX) e Removedor DOM
> **★ EXTRAÇÃO DE DADOS E REMOVEDOR DOM** — Extraia tabelas com paginação SPA para planilhas Excel com várias abas. Elimine banners de cookies e popups com clique direito.
> 
> `📊 Gerador de Excel Multiabas (XLSX)` · `📑 Histórico de Capturas de SPAs Dinâmicas` · `⚡ Eliminação de Banners e Distrações` · `📝 Formatos: XLSX, Markdown, CSV e HTML`

<p align="center">
  <img src="../../screenshots/en/04-dom-tables-excel-export.png" width="100%" alt="Tabelas DOM para Excel (XLSX) e Removedor DOM">
</p>

---

### 5. Conta-Gotas de Cores da Tela e Formatador de Código Embutido
> **★ FERRAMENTAS PARA DESENVOLVEDORES E DESIGNERS** — Capture cores de qualquer pixel na tela com a API EyeDropper nativa. Descompacte e formate arquivos CSS e scripts JavaScript em segundos.
> 
> `🎨 Conta-Gotas Nativo e 7 Modelos de Cores` · `📋 Cópia com 1 Clique para a Área de Transferência` · `💻 Formatador de HTML, CSS e JavaScript` · `🔍 Busca de Código com Regex em Tempo Real`

<p align="center">
  <img src="../../screenshots/en/05-color-picker-palette.png" width="100%" alt="Conta-Gotas de Cores da Tela e Formatador de Código Embutido">
</p>

---

Navegue, inspecione e baixe todos os recursos carregados por uma página web com facilidade em formato ZIP.

Source Download — Todos os ativos de uma página a um clique de distância
Source Download é um painel do Chrome DevTools que descobre, inspeciona e baixa todos os recursos carregados por qualquer página da web. Sejam arquivos multimídia, scripts, folhas de estilo ou respostas de rede, salve tudo individualmente ou em um arquivo ZIP estruturado em pastas.

Construído do zero sem nenhuma biblioteca de terceiros: o empacotador ZIP, o gerador XLSX, o unificador HLS e os formatadores de código foram desenvolvidos em JavaScript puro. Sem frameworks pesados, sem etapas de build e sem telemetria. Tudo roda localmente no seu próprio navegador.

Novidades da versão 1.15.0
- Capturas de tela de página inteira contínuas e recorte de área regional customizado.
- Gravação de vídeo de tela e exportador de GIFs animados otimizados.
- Ferramenta conta-gotas para coletar e copiar códigos de cores na tela em tempo real.
- Melhorias substanciais de desempenho e estabilidade do interceptor DevTools.
- Suporte multilíngue expandido: 4 novos idiomas (francês, italiano, coreano, português do Brasil) adicionados — agora 11 idiomas totalmente localizados na interface e no guia do usuário.
- Atualizado para 17 categorias dedicadas de recursos com contagem em tempo real.

Por que você precisa dele
Uma simples captura de imagem nem sempre resolve. Obtenha os arquivos reais: imagens em resolução nativa, transmissões de vídeo reais, folhas de estilo e códigos-fonte originais.

O DevTools nativo pode parecer confuso. O Source Download oferece uma galeria organizada e intuitiva para os dados de rede, com filtros rápidos, busca avançada e download com um clique.

Aplicações web modernas costumam ocultar recursos gerados sob demanda. O Source Download rastreia requisições da API e elementos dinâmicos durante toda a navegação.

Principais Recursos
Detecção Completa e Inteligente
Combina a interceptação de tráfego de rede com varredura do DOM para mapear cada recurso visível ou estrutural.

Varredura CSS Recursiva: analisa regras url(...) e @import para encontrar fontes e imagens de fundo profundamente incorporadas.

Identificação por Assinatura Binária: analisa os bytes iniciais de arquivos desconhecidos para classificá-los na categoria correta.

17 Categorias com contagem em tempo realas Organizadas: imagens, vetores, vídeos, estilos, scripts, dados e documentos organizados com clareza.

Filtros e Visualização Avançada
Filtro de busca com suporte a texto simples e expressões regulares (Regex) em nomes, URLs e tipos MIME.

Filtros de tamanho (KB) e dimensões de imagem (largura e altura mínimas/máximas em pixels).

Alternância entre visualização em grade e lista, com reprodutor de mídia e visualizador de código com realce de sintaxe.

Download Otimizado e Sem Duplicatas
Baixe arquivos selecionados, a lista filtrada atual ou todos os recursos da página em um arquivo ZIP organizado com remoção automática de imagens repetidas.

Suporte para Vídeos HLS
Identifica playlists HLS (.m3u8) e permite juntar todos os segmentos em um único arquivo de vídeo para download.

Captura de Tabelas e Conteúdo
Extrai tabelas de dados dinâmicas preservando o histórico de alterações e exporta diretamente para Markdown, CSV ou planilha Excel XLSX com várias abas.

Como Utilizar

### 1. Instale o Source Download e pressione F12 em qualquer página.


### 2. Acesse a aba Source Download dentro do painel do DevTools.


### 3. Explore as categorias, defina os filtros desejados e selecione os itens.


### 4. Clique para baixar em ZIP ou individualmente.


Privacidade e Segurança
Execução 100% no dispositivo do usuário. Sem servidores externos, sem rastreamento de navegação e sem coleta de informações confidenciais.

Requisitos
Google Chrome 114 ou superior (Manifest V3).

O Source Download é um projeto de código aberto. Agradecemos suas avaliações e sugestões.
LinkedIn do desenvolvedor: https://www.linkedin.com/in/turan-burak-yesilyurt/

---

## Instalação e Primeiros Passos

### Método 1: Instalação via Chrome Web Store Oficial (Recomendado)
1. Acesse a [página oficial na Chrome Web Store](https://chromewebstore.google.com/detail/source-download/nockdgincmpfojabnhbofkddgcmnodpd).
2. Clique em **Usar no Chrome** e confirme a instalação.
3. Pressione `F12` (ou `Cmd+Option+I` no macOS) em qualquer página e selecione a aba **Source Download**.

### Método 2: Carregar do Código Fonte (Modo Desenvolvedor)
1. Clone o repositório oficial no seu computador:
```bash
git clone https://github.com/turanburakyesilyurt/source-download.git
cd source-download
```
2. Acesse `chrome://extensions` no Chrome.
3. Ative o botão **Modo do desenvolvedor** no canto superior direito.
4. Clique em **Carregar sem compactação** e selecione o diretório `source-download`.

---

## Licença

Distribuído sob a [Licença MIT](../../LICENSE). Copyright © Turan Burak Yeşilyurt. Livre para usar, inspecionar e bifurcar.
