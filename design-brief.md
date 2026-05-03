# MTG Companion App — Design Brief

## Conceito Visual
**"Scholar's Archive"** — uma biblioteca académica semi-minimalista. A app deve evocar o ambiente de um arquivo de estudioso ou biblioteca antiga, mas com clareza e leveza de uso. Não é dark/épico como MTG Arena, nem estéril como uma app de fitness. É culta, organizada, com carácter.

A sensação deve ser: *abrir um livro de referência bem desenhado, não ligar um videojogo.*

---

## Paleta de Cores

### Fundos
- Fundo primário: `#1C1A14` — quase-preto com tom quente
- Fundo secundário (cards, modais): `#252218`
- Fundo terciário (inputs, separadores): `#2E2A1E`

### Acentos
- Dourado principal: `#C9A84C` — âmbar envelhecido
- Dourado sutil: `#7A6535` — para bordas, divisores
- Creme / texto primário: `#EDE8D5` — pergaminho claro
- Texto secundário: `#9A9080` — cinza quente

### Estados
- Sucesso / Win: `#5C8A4A` — verde musgo
- Erro / Loss: `#8A4A4A` — vermelho queimado
- Draw / Neutro: `#6A6A5A` — cinza quente

### Cores MTG (dessaturadas)
- White: `#E8DFB0`
- Blue: `#4A7A9B`
- Black: `#3A3A4A`
- Red: `#9B4A3A`
- Green: `#3A6B4A`
- Colorless / Artifact: `#7A7A6A`

---

## Tipografia

### Títulos - Serifada
- Fonte: Playfair Display (Google Fonts)
- Uso: nomes de eventos, títulos de écran, nome de cartas em destaque

### Corpo - Sans-serif
- Fonte: Inter (Google Fonts)
- Uso: listas, stats, labels, botões

O contraste deliberado entre serifada (carácter) e sans-serif (clareza) é central à identidade.

---

## Elementos Visuais

- Cantos arredondados: `border-radius: 4px`
- Bordas finas em dourado subtil: `1px solid #7A6535` com opacidade 40-60%
- Iconografia: linha fina (stroke), não preenchido
- Símbolos MTG: usar os oficiais como elementos visuais nativos

---

## Tom e Atmosfera

### O que É
- Académico e culto
- Organizado como arquivo ou enciclopédia
- Warm — tons quentes
- Semi-minimalista — espaço a respirar

### O que NÃO É
- Dark mode genérico (azuis frios)
- Épico/gaming (glows, gradientes)
- Vintage/ornamentado (no grimório)

---

## Referências
- [Scryfall.com](https://scryfall.com) — sobriedade académica
- Slay the Spire — UI com carácter, legível
- Notion dark mode com tons quentes

---

## Notas para Claude Design

- Plataforma: mobile iOS/Android (React Native + Expo)
- Dimensões: iPhone 14 Pro (390 x 844px)
- Tab bar na parte inferior com 4 tabs MVP: Home, Events, Stats, Profile
- Safe areas do iOS devem ser respeitadas
- Nome da app: MTG Recall
