# CLAUDE.md — MTG Recall

Este ficheiro é lido automaticamente pelo Claude Code em cada sessão. Contém contexto completo do
projecto para evitar repetição e garantir consistência.

---

## O Projecto

App para telemóvel Android, **de uso pessoal**, para jogadores de Magic: The Gathering. Regista
eventos de torneio, matches, decks, estatísticas e a colecção pessoal com tracking de valor.

**Um utilizador só: eu.** Não há contas, não há partilha, não há camada social — ver
`docs/adr/0006-utilizador-unico-sem-contas.md`. Foi uma decisão deliberada: a infraestrutura
multi-utilizador estava a impedir a app de ficar pronta para aquilo que é o objectivo primário, que é
um registo pessoal de torneios.

O developer é um iniciante em programação — explicar conceitos quando relevante, não assumir
conhecimento prévio de padrões ou convenções.

---

## Regras não negociáveis

1. **O GitHub é a source of truth.** Se uma decisão não está no repositório, não foi tomada. Decisão
   estrutural nova = um ADR em `docs/adr/` (`template.md` tem o formato).
2. **Sem servidor e sem base de dados gerida.** Os dados são ficheiros JSON em `data/`, versionados
   em Git. Ler `docs/adr/0002-dados-json-versionados.md` antes de propor uma DB.
3. **Offline-first.** A app é usada numa loja de cartas, entre rondas, muitas vezes sem rede. Tudo
   escreve primeiro em disco; a sincronização com o GitHub vem depois e sozinha (ADR 0004).
4. **Nunca commitar tokens.** O repositório é público (ADR 0005). O token de escrita vive só no
   `expo-secure-store` do telemóvel.

---

## Stack

| Camada | Tecnologia |
| :---- | :---- |
| Mobile | React Native + Expo SDK 54 |
| Linguagem | TypeScript |
| Routing | Expo Router (file-based) |
| State | Zustand (`store/useEventsStore.ts`) |
| Dados | Ficheiros JSON em `data/`, versionados em Git |
| Persistência local | AsyncStorage — uma chave por caminho de ficheiro |
| Sincronização | GitHub Contents API, por outbox (ADR 0004) |
| Segredos | `expo-secure-store` (token do GitHub) |
| Preferências | AsyncStorage, fora de `data/` — ADR 0010 |
| Ecrã aceso | `expo-keep-awake`, só enquanto o contador de vida está aberto |
| Distribuição | APK compilado no GitHub Actions, publicado em Releases (ADR 0008) |
| Câmara / OCR | `expo-camera` + ML Kit Text Recognition, local (ADR 0009) |
| Card data | Scryfall API |
| Card prices | Scryfall (`prices.eur`), por workflow agendado — ADR 0007 |
| Mana symbols | SVG locais — `assets/mana/symbols.ts` (WUBRG) e `costSymbols.ts` (gerado) |

---

## Estrutura de Pastas

```
/app                        écrans (Expo Router)
  _layout.tsx               root layout (fontes + Stack)
  match-registration.tsx    modal: registo de match
  add-event.tsx             modal: criar evento
  deck-editor.tsx           modal: criar/editar deck
  deck-scan.tsx             modal: decklist por fotografia (aviso, porções, confirmação)
  life-counter.tsx          modal: contador de vida (mesa partilhada, ecrã inteiro)
  collection.tsx            a colecção (push, entra pela Home)
  basic-lands.tsx           definições: a colecção de básicos e a arte de cada um (push)
  (tabs)/
    _layout.tsx             tab bar (Home/Events/Decks/Stats/Settings)
    index.tsx               Home
    events.tsx              Events List
    decks.tsx               Decks
    stats.tsx               Stats
    profile.tsx             Settings (token + sincronização)
  event/[id].tsx            Event Detail (push, sem tab bar)
  deck/[id].tsx             Deck Detail + analisador (push, sem tab bar)
  opponent/[id].tsx         Opponent Detail — registo + head-to-head (push, sem tab bar)

/components                 ManaPip, ManaCost, ManaSelector, TypeBadge, RecordBadge, EventCard,
                            MatchCard, CardThumbnailPlaceholder, CardArtThumb, CardArtPicker,
                            SetSymbol, CardImageOverlay, ConfirmModal, SetSelector,
                            CardSearchModal, QuickRecordModal
/domain                     lógica pura, sem I/O e testável — outbox, slug, base64, sets, search,
                            match, manaSelection, manaCost, deck, deckList, basicLands, cards,
                            cardCache, collection, opponents, thumbnails, ocrDecklist, dates,
                            lifeCounter, holdRepeat, placement, eventColors, quickRecord
/services                   tudo o que fala com o mundo: github, localStore, outbox, sync, repoFiles,
                            scryfall, imagePrefetch, ocr, preferences, lifeSession
/store                      useEventsStore (Zustand) + useScanStore (a gaveta do scan)
                            + useLifeStore (a gaveta do contador de vida)
/theme                      colors, typography, mana
/types                      tipos TypeScript — derivam dos schemas
/assets/mana/symbols.ts     símbolos de mana em SVG, locais (WUBRG)
/assets/mana/costSymbols.ts símbolos de custo, gerados a partir da Scryfall por workflow

/data                       OS DADOS (ADR 0002)
  schema/                   o contrato, validado em CI
  events/                   um evento por ficheiro
  decks/                    um deck por ficheiro
  collection/cards.json     a colecção; prices.json e value-history.json são escritos pelo CI
  taxonomies/opponents.json adversários, por referência

/tools                      validate-data.mts, build-bundle.mts, refresh-prices.mts
/site                       o que vai para o GitHub Pages (o bundle é gerado, não commitado)
/docs
  adr/                      decisões estruturais
  product/                  roadmap, perguntas em aberto
  ops/                      instalar no telemóvel, gerar o token
/design                     handoff.md (spec de implementação), icon/ (o ícone: SVG originais,
                            export.py e o porquê), icon-brief.md, icon-canvas/ (as direcções
                            exploradas), life-counter-canvas/ (as duas direcções do contador de
                            vida; a não escolhida ficou na segunda página) e prints de referência

data-model.md               o modelo de dados explicado
design-brief.md             conceito visual
project-overview.md         estado actual detalhado
```

---

## Os dados

**A classificação de um evento é a posição, não o escalão** (ADR 0012): o ficheiro guarda
`placement` (1 = primeiro lugar) e `playersCount`, e os escalões — 1st Place, Top 2, Top 4, Top 8,
Top 16, Top 32 — calculam-se a partir deles em `domain/placement.ts`, como o win rate. Registar um
5.º entre 32 como "Top 8" deitava fora a única coisa que o distingue de um 8.º. **Um escalão só
conta se o campo tiver sido maior do que ele** — um Top 8 entre 6 jogadores era o torneio todo —, e
ganhar conta sempre. O campo `rank`, a string que se escrevia antes, é legado: lê-se, não se
escreve.

**A posição e o campo andam juntos** (Q15, revisão do ADR 0012): registam-se os dois ou nenhum. O
schema recusa a posição órfã (`dependencies` — draft-07, não `dependentRequired`), o `cleanStanding`
deixa-a cair e o `standingWritable` trava o botão antes disso. Fechar um torneio **sem resultado
nenhum** continua a valer, que é o caso do torneio antigo carregado de memória.

**As cores são do torneio, não do deck** (ADR 0013). O campo `deckColors` esteve marcado como
legado e voltou a ser escrito: a decklist não sabe o que foi *splash* e o que foi cor principal —
isso é uma leitura de quem jogou —, e um torneio retroactivo não tem deck nenhum de onde derivar
cor alguma. Onde as cores se leem, leem-se por `domain/eventColors.ts`: as do evento primeiro, as do
deck ligado a seguir, nada em último. Ler `event.deckColors` directamente é um bug — foi o que
manteve a secção por cor das Stats vazia para todos os eventos criados pela app.

**Um evento pode ser só o recorde.** Parte do arquivo antigo sabe que acabou 6-2 e mais nada. Esses
registam-se por *Quick record* (`domain/quickRecord.ts`), que escreve **rondas nuas** — ronda,
`opponentColors` vazias e resultado. O recorde continua a sair de `matches` e não de dois números
guardados: uma segunda forma de dizer o mesmo obrigaria os seis sítios que somam matches a saber das
duas.

Um evento = um ficheiro `data/events/<AAAA-MM-DD-slug>.json`, com os matches lá dentro. Os
adversários são referências para `data/taxonomies/opponents.json`, e **a referência é opcional**:
um torneio antigo carregado de memória pode não ter adversário nenhum de que alguém se lembre.
Ausente é ausente — nunca uma pessoa chamada "Unknown", que apareceria nas Stats como a mais
enfrentada de todas. O deck do evento é opcional pela mesma razão. Nada de campos calculados nos
ficheiros — win rate e pontos calculam-se em runtime. **Ler `data-model.md` antes de mexer em
qualquer coisa relacionada com dados**, e alterar o schema antes de alterar o código.

Comandos na raiz:

```bash
npm run validate    # valida data/**/*.json contra data/schema/*.json
npm run bundle      # gera o bundle.json que a app lê ao instalar/restaurar
npm run test        # testes dos módulos puros
npm run check       # validate + typecheck + test, o que o CI corre
npm run prices      # actualiza preços da colecção (corre no CI, não à mão)
npm start           # Expo em desenvolvimento
```

## Como a app escreve

Local-first com outbox — ver `docs/adr/0004-escrita-via-github-api-com-outbox.md`:

1. A alteração grava em AsyncStorage e o écran actualiza logo.
2. Entra na outbox (a chave é o **caminho do ficheiro** — cinco rondas do mesmo torneio deixam uma
   entrada e portanto um commit).
3. Um worker esvazia a fila quando há rede, pela Contents API. Falha → recuo exponencial.

A lógica pura vive em `domain/outbox.ts` e tem testes. Os serializadores vivem em
`services/repoFiles.ts` e são testados byte a byte contra os ficheiros reais de `data/` — um ficheiro
mal formado só daria erro **depois** do commit.

---

## Convenções

- **Toda a app está em inglês** — texto, labels, menus, placeholders, mensagens de erro. Os
  comentários de código e a documentação (`docs/`, ADRs) são em **português de Portugal**.
- Ficheiros e variáveis: **camelCase**; componentes React: **PascalCase**
- Sempre **TypeScript**, nunca JavaScript puro. Functional components e hooks.
- **Os tipos derivam dos schemas JSON**, não o contrário. Mudar um campo é mudar
  `data/schema/*.json` primeiro e `types/` depois.
- Cada ficheiro tem **uma responsabilidade** clara
- Chamadas a APIs e I/O **sempre** em `/services` — nunca nos écrans
- Imports de tema: sempre de `../theme/colors`, `../theme/typography`
- **Datas `AAAA-MM-DD` formatam-se com `domain/dates.ts`**, nunca com `new Date(string)` — que lê a
  data como meia-noite em UTC e num fuso negativo mostra o dia anterior. `new Date()` sem argumentos,
  para o instante actual, não tem este problema e continua bem
- `npm install` requer sempre `--legacy-peer-deps` (conflito react-dom@19.2.5 vs react@19.1.0)
- Metro cache: limpar com `npx expo start --clear` ao adicionar novas pastas

---

## Design System — "Scholar's Archive"

**Conceito:** biblioteca académica semi-minimalista. Warm, culta, organizada. Não épico/gaming.

### Cores principais (theme/colors.ts)
- Fundo: `#130F0A` / Card: `#1E1812` / Hover: `#252019`
- Gold accent: `#C9A96E` / Gold dim: `#8B7248`
- Texto: `#E8DCC8` (prim) / `#A8967A` (sec) / `#6B5C3E` (dim)
- Border: `#3A3020` / Tab bar: `#16120D`
- Win bg/border/text: `#1E2E1F` / `#3A5C3C` / `#5A8B5C`
- Loss bg/border/text: `#2E1E1E` / `#5C3A3A` / `#8B4A4A`
- Draw bg/border/text: `#252019` / `#4A4030` / `#7A7060`

### Tipografia (theme/typography.ts)
- **Playfair Display** — títulos, nomes de eventos
  - `fonts.display` = `PlayfairDisplay_700Bold`
  - `fonts.displaySemi` = `PlayfairDisplay_600SemiBold`
  - `fonts.displayMed` = `PlayfairDisplay_500Medium`
  - `fonts.displayItal` = `PlayfairDisplay_400Regular_Italic` ← atenção ao nome exacto
- **EB Garamond** — corpo, labels, listas
  - `fonts.body` = `EBGaramond_400Regular`
  - `fonts.bodyItal` = `EBGaramond_400Regular_Italic`
  - `fonts.bodyMed` = `EBGaramond_500Medium`

### ManaPip (components/ManaPip.tsx)
- SVGs locais (`assets/mana/symbols.ts`), sem rede — funciona offline
- Props: `color: ManaColor`, `size?: number` (default 16), `isSplash?: boolean`
- `isSplash`: tamanho ×0.70, opacidade 0.65

### ManaSelector (components/ManaSelector.tsx)
- O selector de cores de três estados: um toque é principal, dois é splash, três limpa.
- Desenha o bloco inteiro — etiqueta, `clear` e legenda —, e os três écrans que escrevem cores usam
  este e mais nenhum: registo de match, editor de deck e as cores do evento. Estava copiado à letra
  nos dois primeiros; o terceiro seria a terceira cópia.
- A lógica dos estados é `domain/manaSelection.ts` e é testada lá. Isto é só o dedo em cima dela.

### ManaCost (components/ManaCost.tsx)
- Desenha um custo inteiro (`{2}{G}{U}`), não um pip só. `domain/manaCost.ts` separa a string.
- Três níveis de recurso: símbolo da Scryfall em `assets/mana/costSymbols.ts` → os cinco WUBRG de
  `symbols.ts` → o texto numa bolha. O terceiro existe para funcionar **antes** de alguém correr o
  workflow que descarrega os símbolos, e para o dia em que a Scryfall invente um símbolo novo.
- `costSymbols.ts` é **gerado** por `tools/fetch-mana-symbols.mts`, pelo workflow **Actualizar
  símbolos de mana**. Começa vazio; correr o workflow enche-o e commita.

---

## Navegação (Expo Router)

```
Stack principal:
  (tabs)/index        ← Home (entra também para /collection)
  (tabs)/events       ← Events List
  (tabs)/decks        ← Decks
  (tabs)/stats        ← Stats
  (tabs)/profile      ← Settings
  event/[id]          ← Event Detail (push, sem tab bar)
  deck/[id]           ← Deck Detail + analisador (push, sem tab bar)
  opponent/[id]       ← Opponent Detail (push, sem tab bar) — entra pela lista das Stats
  collection          ← Colecção (push)
  basic-lands         ← Definições → Basic lands (push)

Modals (presentation: 'modal'):
  match-registration  ← a partir de Event Detail
  add-event           ← a partir de Events List / Home
  deck-editor         ← a partir de Decks / Deck Detail
  deck-scan           ← a partir do editor de deck ("Scan photo")
  life-counter        ← contador de vida, ecrã inteiro (`fullScreenModal`). Três entradas:
                        a pastilha no registo de match, o quadrado ao lado de "Register round N"
                        (Home e Event Detail), e o ícone no cabeçalho da Home — este sem evento
                        nenhum, para uma partida casual
```

Params de navegação:
- `match-registration`: `{ eventId, round, eventName, mode? }` — `mode: 'edit'` corrige a ronda
  indicada em vez de registar uma nova
- `life-counter`: `{ eventId?, round?, eventName?, returnTo? }` — sem `eventId` é uma partida casual
  e nada se grava; `returnTo: 'form'` diz que veio de dentro do registo, e aí sair é voltar atrás em
  vez de abrir um segundo formulário por cima do primeiro
- `deck-editor`: `{ deckId?, linkToEventId?, presetFormat?, presetName? }` — sem `deckId` cria um
  deck novo; com `linkToEventId` (vindo do Event Detail) o deck criado fica ligado a esse evento, e
  os *preset* chegam preenchidos a partir do torneio

**O tab Decks é uma grelha de dois**, com a arte do deck (`deckThumbnailUrl`) a encher o quadrado e
o nome, o registo e as cores por cima. Tem duas secções: os decks que se guardam e, em baixo, os de
**Limited** — Sealed e
Draft existiram para um torneio só (`isEventDeck`, em `domain/deck.ts`). Continuam a valer pelo
registo, mas um Limited por mês soterrava os decks a sério ao fim de um ano. A regra é o formato e
mais nada: não há campo novo no ficheiro.

**A Home é o evento activo.** Quando há um torneio a decorrer, ele é um cartão-herói com a arte a
encher **52% da altura do ecrã**, com o resultado em grande e o botão de registar a ronda lá dentro
— e vem **antes** do bloco de números. Na esmagadora maioria dos dias há zero ou um evento activo,
nunca uma lista, e quando há um entrou-se na app entre rondas para registar um resultado. Sem evento
activo a secção não existe e o resto sobe sozinho: não há decisão a tomar. Spec em
`design/handoff.md` §3.3.

**A colecção não é um tab de propósito:** cinco tabs num telemóvel já é o limite, e a colecção
consulta-se de vez em quando, não entre rondas.

---

## APIs

### Scryfall
- Base URL: `https://api.scryfall.com`
- Rate limit: 50–100 ms entre requests (respeitar sempre), e nunca pedidos em paralelo
- Tudo o que fala com a Scryfall vive em `services/scryfall.ts`. O que decide — filtrar, ordenar,
  validar — vive em `domain/sets.ts` e tem testes.
- **Todos os pedidos passam por um portão único** em `services/scryfall.ts`, que serializa e espera
  o intervalo mínimo. Duas filas independentes respeitariam 100 ms cada uma e mandariam o dobro.
- `GET /sets` alimenta o selector de set do evento. Cache em `mtgrecall.scryfall.sets`, validade de
  7 dias.
- `GET /cards/search` alimenta a procura de cartas. Cache em `mtgrecall.scryfall.cards`, validade de
  1 dia — o que uma procura devolve muda quando sai uma colecção nova.
- `POST /cards/collection` completa cartas lidas só pelo nome (ADR 0009), 75 por pedido.
- `GET /cards/search` com `unique=prints` traz **todas as impressões de básicos de uma colecção** —
  todas e não só os seis nomes, porque muitas colecções têm a versão normal e a *full art* do mesmo
  terreno e o selector das definições precisa das duas. Cache em `mtgrecall.scryfall.basics`,
  **sem validade** — as impressões de uma colecção publicada não mudam.
- **É cache, não são dados nossos**: não passa pela outbox nem pelo `localStore`, e por isso nunca
  aparece num commit.
- **Sem rede nada falha**: o set escreve-se à mão, a carta acrescenta-se só pelo nome. O schema só
  exige `name` e `quantity`, e numa loja sem sinal é a diferença entre a app servir e não servir.

### Preços (ADR 0007)
- Vêm da Scryfall (`prices.eur`), **nunca da Cardmarket API** — exigiria aplicação aprovada e OAuth.
- Escritos por `tools/refresh-prices.mts` num workflow semanal, **nunca pelo telemóvel**. A app lê-os
  do bundle e não lhes toca; `data/collection/prices.json` não passa pela outbox de propósito.

### GitHub
- Contents API para escrever; `bundle.json` em GitHub Pages para ler
- Token fine-grained, só este repositório, `Contents: read and write`

---

## Distribuição

O APK é compilado pelo GitHub Actions (`expo prebuild` + Gradle) e publicado como ficheiro de uma
**Release** — ver `docs/adr/0008-apk-compilado-no-github-actions.md`. Sem EAS, sem conta na Expo.

- Gerar: separador **Actions → Gerar APK (Gradle) → Run workflow**. Abre no browser do telemóvel.
- Instalar: **Releases** → tocar no `.apk`.
- **Instalar por cima mantém os dados** (eventos, decks, colecção, token), porque a assinatura é
  sempre a mesma chave, guardada nos segredos `ANDROID_KEYSTORE_BASE64` e
  `ANDROID_KEYSTORE_PASSWORD`. Assinar com outra chave faria o Android recusar e obrigaria a
  desinstalar.
- **Não há entrega de JavaScript pelo ar.** Qualquer alteração exige APK novo. É o custo assumido
  no ADR 0008; os workflows do EAS ficaram no repositório caso um dia se queira voltar atrás.

Os passos todos — token, Pages, build, restauro — estão em `docs/ops/telemovel-setup.md`.

---

## Estado Actual

Ver `project-overview.md` para o detalhe e `docs/product/roadmap.md` para o que vem a seguir.

**Fase 5, quase fechada.** A decklist do Deck Detail mostra o **recorte da arte** (`artCropUrl`) de
cada carta — grande e encostada à margem, com o ícone do set ao lado do nome (`SetSymbol`, URL
construído a partir do `setCode`, **colorido pela raridade** — um símbolo só, como nas cartas a
sério; as cores estão em `design/handoff.md` §1.2b e distinguem-se pela matiz, não pelo brilho) e a carta inteira numa sobreposição ao toque (`CardImageOverlay`,
URL construído a partir do `scryfallId`) —, por `components/CardArtThumb.tsx` — `expo-image` com cache em disco, e recuo para o
`CardThumbnailPlaceholder` quando não há URL ou a imagem falha. O mesmo écran alterna entre lista
com arte e lista compacta, agrupa por tipo (`groupByType`) e analisa subtipos (`subtypeCounts`).

**Os terrenos básicos ganham a arte da colecção do deck.** Um Sealed sai todo da mesma caixa e os
básicos que se jogam são os dessa caixa — mas entram na app sem impressão escolhida, de propósito
(perguntar qual das centenas de Ilhas se tem no deck é trabalho a troco de nada). A colecção
**deduz-se**: `dominantSetCode` em `domain/basicLands.ts` conta as cartas por quantidade e só
decide quando uma colecção é **maioria absoluta** — um Sealed passa com folga, um Commander de
trinta colecções não passa nenhuma, que é o que se quer. A arte é emprestada só a quem se desenha
(`withBasicLandArt`, no écran); **o ficheiro do deck não muda**, porque a colecção dominante é um
campo calculado e um deck que troca de cartas trocaria de colecção. Um básico com impressão
escolhida à mão fica sempre como está.

**Para os decks que não dizem de onde são** há a preferência em *Settings → Basic lands*
(`app/basic-lands.tsx`): escolhe-se a colecção e, dentro dela, a arte de cada básico — muitas
colecções trazem a normal e a *full art*, e escolher só a colecção não dizia qual. Escolhe-se uma
vez e serve todos esses decks; **a colecção do próprio deck ganha sempre à preferência**, que sabe
mais do que uma escolha geral. A preferência vive no AsyncStorage e não em `data/`: é gosto, não é
registo — **ADR 0010**.

**A ordem do Deck Detail serve o uso:** a decklist primeiro, a análise a seguir (é sobre a lista), e
o desempenho no fim. Em Sealed e Draft o deck joga um torneio só e o win rate dele é o mesmo do
evento — pô-lo no topo era repetir no sítio mais nobre uma coisa já sabida.

As **miniaturas** estão ligadas ponta a ponta: `domain/thumbnails.ts` decide a arte de um deck ou de
um evento a partir da própria decklist (o ficheiro guarda um `scryfallId`, não um URL),
`components/CardArtPicker.tsx` é a grelha que a escolhe no editor de deck e no Event Detail, e
`services/imagePrefetch.ts` garante-as em disco no arranque — só as miniaturas, que as cem cartas de
um deck de Commander ficam em cache sozinhas à medida que se abre.

**Decklist por fotografia (ADR 0009): escrita ponta a ponta, por provar no telemóvel.**
`domain/ocrDecklist.ts` reconstrói colunas pelas caixas delimitadoras, compara nomes com tolerância
a erros, conta repetições como quantidade e junta porções (`mergeBatches`) — um Limited cabe numa
fotografia, um Commander fotografa-se em três ou quatro, e o mesmo nome em duas porções soma **e
fica marcado**. `services/ocr.ts` liga o ML Kit a isso, usando as **linhas** e não os blocos.
`app/deck-scan.tsx` é o fluxo: aviso da montagem, porções, confirmação — e entrega as cartas ao
editor pela `useScanStore`.

A montagem da mesa é **parte do fluxo** (ADR 0009, passo 0): as cartas de baixo vão tapadas com uma
sleeve ou com o verso de outra carta, para o único texto da fotografia serem nomes. Por isso **nada
é descartado em silêncio** — cada leitura ou vira carta ou vai para `unmatched`, e o filtro pelo
tamanho da letra que existia saiu, com a razão no ADR.

**Provado numa fotografia a sério (build 3):** o ML Kit lê todos os nomes de um deck montado como
o ADR manda, e funciona com a nova arquitectura. O que falhou na primeira tentativa foi o
**catálogo**: exigia que a carta já fosse conhecida pela app, e num deck novo nenhuma é — a lista
saía vazia. Agora o catálogo serve para corrigir a grafia, e o que ele não conhecer entra com o
nome tal como foi lido, marcado na confirmação como `as read`. Só fica de fora o que nem cara de
nome tem, como um pedaço de custo de mana.

**E um nome não chega:** a confirmação completa os nomes contra a Scryfall (`resolveCardNames`,
`POST /cards/collection`, 75 por pedido) antes de entregar a lista ao editor — sem `typeLine`,
`cmc` e `artCropUrl` o Deck Detail não tem o que analisar. Sem rede as cartas entram só com o nome
e completam-se depois pelo botão *Get card data* do editor, que só aparece quando há o que
completar.

**O contador de vida (ADR 0011).** Com dois jogadores o telemóvel fica entre os dois e o ecrã
parte-se ao meio, a metade do adversário virada para ele — e isso **é** a disposição, não uma de
duas: usa o telemóvel inteiro, portanto não há orientação a escolher nem selector para a escolher.
Toca-se à esquerda de uma metade para tirar e à direita para pôr; manter o dedo em baixo repete,
porque um ataque de 12 não se conta com doze toques.

A repetição é `domain/holdRepeat.ts` e tem testes, incluindo o do erro que já lá esteve: a tocar
depressa chegam dois `onPressIn` sem um `onPressOut` pelo meio, e a primeira versão deixava um
temporizador sem dono a descontar vida sozinho, sem forma de o parar. **A invariante é existir no
máximo um temporizador vivo** — `press` começa sempre por `release`, e cada passo confirma que o
dedo ainda está em baixo.

**O contador é uma ferramenta, não um registo.** Não escreve em `data/` e não passa pela outbox: ao
sair entrega os games à `useLifeStore` — a mesma gaveta que o `deck-scan` usa para o editor — e é o
registo de match que grava. O resultado continua a sair dos games por `resultFromGames`, sem caminho
novo nenhum até ao ficheiro. Do jogo inteiro fica uma coisa só: a vida com que cada game acabou, em
`games[].life`.

`domain/lifeCounter.ts` é a lógica toda e tem testes. Três regras lá dentro que não são óbvias: os
dois a zero **não** propõem resultado (em Magic é empate, e um game empatado não cabe no schema);
fechar um game guarda a vida do momento em que se fecha, não a de quando alguém chegou a zero, para
a correcção de um engano valer; e a sessão guardada tem chave da ronda, senão fechar a app a meio da
ronda 2 trazia esses totais para dentro da ronda 3. O jogo a meio vive no AsyncStorage
(`services/lifeSession.ts`), como as preferências e pela mesma razão.

**A classificação passou a ser um número (ADR 0012).** Fechar um torneio pede dois: a posição e
quantos jogadores eram — *Finished [5] out of [32]* —, e a folha mostra ali mesmo em que escalão
isso cai, ou porque não cai em nenhum. `domain/placement.ts` é a lógica toda e tem testes. Três
coisas lá dentro que não são óbvias: **um escalão só conta se o campo tiver sido maior do que ele**
(o 5.º entre 6 é, à letra, um Top 8 — mas o escalão era o torneio todo), ganhar é a excepção e conta
sempre, e quem fica fora de todos os escalões vai para o degrau `Outside` da pirâmide em vez de
desaparecer, para as percentagens serem sobre os torneios todos.

**Os dois números são um par** e não dois campos independentes: sem o número de jogadores a posição
não se grava, e o botão de concluir fica travado até os dois fazerem sentido. Deixar os dois em
branco continua a valer. Isto foi a Q15, decidida a favor de apertar.

O **gráfico de tendência** deixou de desenhar escalões e passou a desenhar a **fracção do campo que
ficou atrás**: um 5.º entre 32 (0.87) foi mais difícil do que um 5.º entre 8 (0.43), e a posição
sozinha diria que são iguais. Um evento que só tem o `rank` antigo entra por estimativa, com a barra
apagada — estimar e medir não se desenham igual. Desde a Q15 a barra apagada é **só** sinal de
legado: dados novos têm sempre os dois números, e no dia em que não houver eventos antigos ela
desaparece sozinha.

E o resultado passou a **ver-se e a poder corrigir-se**: aparece no cabeçalho do evento, e os mesmos
dois campos estão em *Event details* para emendar um engano. Antes só se escrevia uma vez, numa
folha que nunca mais voltava a abrir.

**Os registos retroactivos deixaram de precisar de detalhe que não existe (ADR 0013).** Metade do
arquivo antigo é só isto: o torneio, as cores, o resultado e talvez o tema do deck. Duas coisas
faltavam para esses registos caberem na app.

As **cores voltaram a ser um campo que se escreve**, no Event Detail, com o mesmo selector de três
estados do deck e do match. Não se derivam do deck de propósito: a decklist não sabe o que foi
*splash*, e um torneio retroactivo não tem deck nenhum. `domain/eventColors.ts` é a precedência
inteira — evento, depois deck ligado, depois nada — e toda a gente a usa. Isto arrumou de caminho um
bug que ninguém tinha visto: os três écrans que desenham cores liam `event.deckColors` directamente,
um campo que nada de novo escrevia, e por isso **a secção por cor das Stats estava vazia para todos
os eventos criados pela app**.

E o **Quick record** dá casa ao "6-2" de um torneio sem detalhe por ronda: toca-se W/L/D pela ordem
que se quiser — a ordem é de quem escreve, inventada ou não —, vê-se o recorde a formar-se e
gravam-se as N rondas de uma vez. `domain/quickRecord.ts` tem a lógica e os testes. Duas decisões lá
dentro: gera **rondas nuas** em vez de guardar dois números, porque o recorde sai sempre de
`matches` e uma segunda verdade obrigaria seis sítios a saber das duas; e grava **uma vez só** para
as N rondas, que é um commit e não oito.

**Pela Home, sem evento, não se grava nada.** A app é um registo de torneios; meia dúzia de jogos na
mesa da cozinha estragariam o win rate de sempre e a lista de adversários.

---

## Regras de Trabalho

1. Antes de criar um ficheiro, verificar se já existe algo semelhante
2. Antes de implementar um écran, consultar `design/handoff.md` para a spec exacta
3. Antes de mexer em dados, consultar `data-model.md` e alterar o schema primeiro
4. Chamadas a APIs **sempre** em `/services` — nunca nos écrans
5. Uma decisão estrutural nova é um ADR em `docs/adr/`
6. Uma pergunta que aparece a meio vai para `docs/product/open-questions.md` em vez de ser
   respondida em silêncio
7. Quando houver dúvida, apresentar 2 opções com prós/contras antes de implementar
8. **Antes de cada acção, explicar em português o que vai fazer e porquê, em 2-3 linhas**
9. **Sempre que se implementar uma feature ou o estado mudar — actualizar `CLAUDE.md`,
   `project-overview.md` e o roadmap**
