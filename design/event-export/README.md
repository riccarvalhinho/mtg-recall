# Exportar um evento — proposta

> Estado: **proposta, por decidir.** Nada disto está na app. O protótipo
> (`prototipo-reality-fracture.html`) é o ficheiro que a app escreveria para o *Pre release — Reality
> Fracture*, gerado a partir dos dados reais — abre-se no telemóvel e manda-se pelo Telegram para
> testar a coisa a sério antes de escrever uma linha na app.

## O que se quer

Um botão **Export** no Event Detail que produz uma página só — o relatório do torneio — para mandar
a um grupo de amigos no Telegram (ou WhatsApp). Pela ordem de importância:

1. o nome do evento e o resultado, com os números que a app já mostra;
2. o deck, com a decklist como se vê no Deck Detail — e **a carta inteira ao toque**, para quem
   recebe poder ler o que ela faz;
3. o recorde de relance, e ronda a ronda contra quem se ganhou e perdeu, expansível.

Não é um registo: não escreve em `data/`, não passa pela outbox. É uma leitura dos dados, como as
Stats.

---

## Parte 1 — o formato

Há três saídas possíveis. **As três partem do mesmo HTML**, e por isso a decisão que importa agora
é por qual começar, não qual deitar fora.

### A · Ficheiro `.html` partilhado pelo telemóvel ← recomendada para começar

A app escreve o HTML num ficheiro (`Pre-release-Reality-Fracture.html`, ~55 KB) e abre a folha de
partilha do Android. Escolhe-se o Telegram, o grupo, e vai como documento.

- **Offline-first de verdade (regra 3):** gerar não precisa de rede. As imagens das cartas são
  links para a Scryfall e carregam no telemóvel de **quem abre**, que tem rede. Na loja sem sinal o
  Telegram guarda a mensagem e manda-a quando houver.
- **Imediato:** não depende de a sincronização ter corrido nem de o Pages ter publicado.
- **Interactivo sem JavaScript.** O ponto delicado: no iPhone, o Telegram e o WhatsApp abrem
  documentos num visualizador próprio que pode não correr scripts. Por isso tudo o que mexe é HTML
  nativo — `<details>` para abrir uma ronda, âncoras `#` com `:target` para a carta inteira. O único
  script da página é conforto (abrir a ronda quando se toca na pastilha) e a página vale sem ele.
- **Contra:** no chat aparece como um ficheiro, sem pré-visualização. No Android, tocar nele abre o
  "Abrir com…" → Chrome. É um toque a mais do que um link.
- **Custo na app:** `expo-file-system` + `expo-sharing`, dois módulos nativos — **APK novo**, como
  qualquer alteração (ADR 0008).

### B · Link para uma página no GitHub Pages

O `build-bundle` passa a escrever também `site/events/<id>.html` com o mesmo renderer, e o botão
partilha só o URL (o `Share` do React Native, sem módulo novo).

- **A melhor experiência no chat:** o Telegram mostra um cartão com o título, o recorde e a arte do
  deck (as `og:` meta tags já estão no protótipo), e abre no browser interno — interactivo em
  qualquer telemóvel, sem descarregar nada.
- O link **continua certo** se o resultado for corrigido depois.
- **Contra:** depende de o evento já estar no repositório e de o Pages ter publicado (1–3 min
  depois do commit). Mandado antes disso, os primeiros a abrir apanham um 404. Não funciona na
  loja sem rede.
- **Não expõe nada de novo** — o repositório já é público (ADR 0005, Q3) —, mas um link num grupo
  põe os nomes dos adversários a um toque de quem não os ia procurar num JSON.

### C · PDF

`expo-print` transforma o mesmo HTML num PDF. Abre em qualquer lado, com pré-visualização no chat.

- **Contra, e decisivo:** perde-se o toque na carta. Para as cartas se lerem num PDF teriam de estar
  todas em tamanho de leitura — um Sealed são ~23 cartas diferentes, 3 por linha, três ou quatro
  páginas. Deixa de ser uma página só.
- E precisa de rede **ao gerar**, para ir buscar as imagens.
- Fica como recurso **só se** o teste do ponto A mostrar que o HTML não abre bem num dos telemóveis
  do grupo.

### A recomendação

**Começar por A, desenhado para B vir depois sem trabalho novo.** O renderer é lógica pura —
`(evento, deck, adversários) → string HTML` — e vive em `domain/eventReport.ts`, com testes. A app
usa-o para escrever o ficheiro; o `tools/build-bundle.mts` pode usá-lo amanhã para escrever as
páginas do Pages, porque `domain/` corre igual em Node.

```
domain/eventReport.ts         buildReport(event, deck, opponents) → modelo
                              renderReportHtml(modelo) → string        (testado)
services/share.ts             escreve em cache + shareAsync(mimeType: text/html)
app/event/[id].tsx            botão Export no cabeçalho
```

O modelo reutiliza o que já existe e está testado: `groupByType` e `manaCurve` (`domain/deck.ts`),
`eventColors`, `formatPlacement` e `tierFor` (`domain/placement.ts`), `withBasicLandArt` para os
básicos terem a arte da colecção, como no Deck Detail. Nada é calculado de novo.

**Antes de decidir: o teste de 5 minutos.** Mandar o protótipo para o grupo no Telegram e ver, num
Android e num iPhone: abre? as imagens carregam? tocar numa carta mostra-a? tocar numa ronda
abre-a? Se o iPhone falhar, é a resposta a favor de B (ou de C). É a Q19.

---

## Parte 2 — o layout

Coluna única, largura de telemóvel (máx. 600 px), o sistema da app — "Scholar's Archive": fundo
`#130F0A`, dourado `#C9A96E`, Playfair Display nos títulos e EB Garamond no resto. Sempre escuro,
como a app. Os nomes e textos em inglês (convenção da app).

```
┌──────────────────────────────────────┐
│  [arte do deck, a encher]            │  1 · CABEÇALHO
│  SEALED   ◆ FRA                      │     badges: formato + set
│  Pre release - Reality Fracture      │     nome (Playfair 700)
│  25 Sep 2026 · Arena Porto · ⚪⚫      │     data · local · cores do evento
│  5th of 32 · Top 8                   │     classificação (ou "In progress")
├──────────────┬─────────┬─────────────┤
│   4 – 2 – 0  │   12    │    67%      │  2 · NÚMEROS — a StatsBar do Event
│   W – L – D  │   PTS   │  WIN RATE   │     Detail, igual
├──────────────┴─────────┴─────────────┤
│ [L][W][L][W][W][W]   Games 9–7       │     o recorde de relance: uma pastilha
│  R1 R2 R3 R4 R5 R6                   │     por ronda, toca → salta p/ a ronda
├──────────────────────────────────────┤
│ THE DECK                             │  3 · O DECK
│ Pre release - Reality Fracture       │     nome, cores, arquétipo, nº cartas
│ ⚪⚫  Grind graveyard · 40 cards       │
│ ┌ curva de mana ─────────────────┐   │     curva + contagem por tipo
│ │ ▁ ▂ █ █ ▂ ▁ ▂                  │   │     (o analisador, em pequeno)
│ └ Creatures 10 · Instants 7 … ───┘   │
│ LANDS                            17  │     a decklist como no Deck Detail:
│ [arte] 1 Meticulous Commons  ◆       │     recorte da arte, qtd, nome,
│ CREATURES                        10  │     raridade, custo de mana
│ [arte] 2 Campus Crier      ◆ (1)⚪    │
│   … toque → a carta inteira por cima │     ← o ponto da coisa
├──────────────────────────────────────┤
│ ROUND BY ROUND                       │  4 · MATCHES
│ R1 [L] Marcelo Marino  ⚪🟢·🔴 1–2 ›  │     fechadas: quem, cores, games
│ R3 [L] João Rocha             0–2 ⌄  │     abertas: game a game, quem
│      Game 1  Lost  · on the play     │     começou, vida final, notas
│      Game 2  Lost                    │
├──────────────────────────────────────┤
│ Recorded with MTG Recall             │  5 · RODAPÉ
└──────────────────────────────────────┘
```

Decisões dentro do layout, e porquê:

- **A arte do deck no topo** — `deckThumbnailCardId` do evento, senão a do deck, como a Home. É a
  pré-visualização no Telegram (opção B) e é o que distingue este relatório de todos os outros.
- **Os números são os da app, e só esses:** recorde, pontos, win rate. Mais os games (9–7), que a app
  não mostra em número mas cabem numa linha e dizem se os 4-2 foram apertados.
- **As pastilhas W/L por ronda** são o "track record" de relance, e levam à ronda.
- **A decklist agrupa por tipo pela ordem da app** (`groupByType`: pela contagem, por isso num
  Limited os terrenos saem primeiro). Pô-los no fim leria melhor para quem recebe, mas desviava do
  "igual ao que vejo na app". Fica a questão em aberto na Q19.
- **A carta inteira abre por cima**, com `:target`: a imagem `normal` da Scryfall (~70 KB) só
  descarrega quando se toca — os recortes pequenos da lista é que carregam logo.
- **As rondas vêm fechadas** e mostram já o adversário e os games; abrir dá game a game. Uma ronda de
  *Quick record* (ronda nua) diz que só o resultado ficou registado, em vez de ficar vazia.
- **Sem adversário** escreve-se *Unknown opponent*, em itálico e apagado — é texto de apresentação,
  não um registo, e não contamina nada (ao contrário do que o `data-model.md` proíbe nos dados).

## O que o protótipo não faz (e a versão a sério fará)

- As fontes vêm do Google Fonts; sem rede cai para Georgia. A versão a sério pode embutir as duas
  famílias (~150 KB) — decidir depois do teste.
- Os básicos aparecem sem arte: o protótipo não aplica `withBasicLandArt`.
- Os símbolos WUBRG vão embutidos (os mesmos SVG de `assets/mana/symbols.ts`); os híbridos
  (`{R/W}`) vêm da Scryfall — na app usam-se os de `costSymbols.ts`.
- O gerador do protótipo é um script descartável e não está no repositório.
