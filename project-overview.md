# MTG Recall — Project Overview

> Estado actual do projecto. Actualizar sempre que uma feature for implementada, uma decisão técnica
> for tomada, ou o estado mudar.
> Última actualização: 2026-09-14

---

## Language

**All app text is in English** — UI labels, menus, placeholders and error messages. Code comments and
project documentation (`docs/`, ADRs) are written in Portuguese.

---

## Estado Actual

**Fases 0 a 4 implementadas, e a Fase 5 com tudo feito menos a decklist por fotografia.** A app
deixou de depender do Supabase e guarda tudo — eventos, decks, colecção — como ficheiros JSON no
próprio repositório, escritos pela Contents API do GitHub. Utilizador único, sem contas. As decisões
estão em `docs/adr/` (0001 a 0009).

`npm run check` passa: dados válidos, typecheck limpo, testes verdes.

O que falta não é código. São quatro passos manuais que dependem das contas do autor — ligar o
Pages, guardar a keystore e correr o workflow do APK, criar o token, registar o primeiro torneio — e
estão em `docs/ops/telemovel-setup.md`.

**`data/events/` está vazio.** Enquanto não houver lá um torneio a sério, a cadeia telemóvel →
commit → bundle → restauro não está provada ponta a ponta, e é a única coisa que interessa a seguir.
A dívida conhecida e o que ficou por confirmar estão em `docs/product/roadmap.md`.

---

## O que está feito

### Design System
- [x] `design-brief.md` — conceito "Scholar's Archive", paleta original, referências
- [x] `design/handoff.md` — spec completa de implementação React Native
- [x] Prints de écran de referência em `/design/`
- [x] `theme/colors.ts`, `theme/typography.ts` (Playfair Display + EB Garamond), `theme/mana.ts`
- [x] `constants/colors.ts` — re-exporta `theme/colors` para retrocompatibilidade

### Componentes
- [x] `ManaPip` — símbolos oficiais MTG em SVG **local** (`assets/mana/symbols.ts`), funciona offline
- [x] `TypeBadge`, `RecordBadge`, `CardThumbnailPlaceholder`, `EventCard`, `MatchCard`, `ConfirmModal`
- [x] `CardArtThumb` — recorte da arte com `expo-image` (cache em disco) e recuo para o placeholder
- [x] `CardArtPicker` — grelha para escolher a carta que ilustra o deck ou o evento; controlada e
      sem store, para servir os dois écrans
- [x] `ManaCost` — o custo inteiro desenhado, com três níveis de recurso até ao texto numa bolha
- [x] `SetSelector`, `CardSearchModal` — lista de sets e procura de cartas da Scryfall, com cache

### Écrans
- [x] **Home** — empty state (com entrada para a colecção) e variante com dados: o **evento activo
      em grande**, 52% da altura do ecrã com a arte a encher, o resultado e o botão de registar a
      ronda lá dentro, seguido do StatsBlock e do histórico
- [x] **Events List** — StatsStrip, secções activo/histórico, OrnamentDivider, procura local por
      nome do evento, local e adversário (`domain/search.ts`)
- [x] **Event Detail** — StatsBar, DeckSection colapsável, lista de matches, concluir evento
      (rank + nº de jogadores), apagar evento e apagar match com confirmação, e "Event details"
      para corrigir o set (só Limited) e escolher a arte do evento
- [x] **Match Registration** — selector de cores com 3 estados por pip, resultado, notas
- [x] **Add Event** — selector de formato (7 tipos), nome, data, local e **set escolhido de uma
      lista da Scryfall** (só em Sealed/Draft), com cache offline e escrita à mão como recurso
- [x] **Deck Detail** — desempenho do deck, curva de mana, cores, tipos e **subtipos** com selector
      de tipo, e decklist agrupada por tipo em duas vistas: com o recorte da arte ou compacta. Os
      terrenos básicos mostram a arte da colecção de onde vem a maioria das cartas do deck —
      deduzida, não gravada no ficheiro; nos decks que não têm colecção própria vale a escolhida em
      *Settings → Basic lands*
- [x] **Stats** — gráfico de tendência, desempenho por cor, pirâmide de classificações e
      **Opponents** (nemesis, melhor matchup e mais enfrentados), que abrem o Opponent Detail
- [x] **Collection** — valor, evolução, procura, e ligar uma carta escrita à mão a uma impressão
- [x] **Deck Scan** — decklist por fotografia: aviso da montagem, porções acumuladas e confirmação
      antes de entregar as cartas ao editor. Falta correr num APK com o ML Kit lá dentro
- [x] **Life Counter** — contador de vida em mesa partilhada (ecrã ao meio, a metade do adversário
      virada para ele), com fim de game proposto sozinho, gaveta de opções para a vida inicial e
      resumo à saída. Entrega os games ao registo de match já com a vida de cada um. Falta usá-lo
      numa mesa a sério — ver Q13
- [x] **Basic lands** (em Settings) — a colecção de básicos e a arte de cada um, para os decks que
      não têm colecção própria. Guardada no telemóvel, fora de `data/` (ADR 0010)
- [x] **Settings** — token (verificado antes de guardar), estado da sincronização, sincronizar
      agora, restauro a partir do GitHub

### Navegação
- [x] Root layout com 9 variantes de fonte carregadas por `expo-font`
- [x] 5 tabs; Event, Deck e Opponent Detail fora do grupo de tabs; modais com
      `presentation: 'modal'`

### Decisões
- [x] `docs/adr/0001` a `0006` — GitHub como source of truth, dados JSON versionados, app nativa em
      vez de PWA, escrita por outbox, repositório público, utilizador único
- [x] `docs/adr/0011` — o contador de vida é efémero; o que fica no ficheiro é `games[].life`
- [x] `data-model.md` reescrito para o modelo de ficheiros

### Dados e ferramentas
- [x] `data/schema/{event,opponents}.schema.json` — o contrato
- [x] `tools/validate-data.mts` — schema + coerência (ids, rondas, adversários, games vs resultado)
- [x] `tools/build-bundle.mts` — `bundle.json` para instalação e restauro
- [x] CI a validar, compilar tipos e correr testes em cada push; Pages a publicar o bundle a partir de `main`
- [x] `npm run check` — o que o CI corre, num comando

### Camada de dados na app
- [x] `services/github.ts` — Contents API (escrita e apagar), token no `expo-secure-store`
- [x] `services/localStore.ts` — cópia local em AsyncStorage, uma chave por ficheiro
- [x] `domain/outbox.ts` (puro) + `services/outbox.ts` (fila persistente e worker)
- [x] `services/repoFiles.ts` — serializadores validados contra o schema verdadeiro
- [x] `services/sync.ts` — restauro a partir do bundle publicado
- [x] `domain/base64.ts` — base64 UTF-8 que bate certo com o Node byte a byte
- [x] `services/scryfall.ts` — lista de sets da Scryfall, com cache própria em AsyncStorage
      (`mtgrecall.scryfall.sets`, validade de 7 dias) fora da outbox e do `localStore`
- [x] `domain/sets.ts` (puro) — filtra os tipos jogáveis, ordena por data e valida o código
      contra o padrão do schema
- [x] `domain/search.ts` (puro) — predicado da procura de eventos
- [x] `domain/opponents.ts` (puro) — registo contra cada adversário, ranking por número de
      encontros, nemesis/melhor matchup (mínimo de 3 encontros) e head-to-head
- [x] `app/opponent/[id].tsx` — écran de detalhe por adversário: registo, destaque (nemesis ou
      melhor matchup) e histórico de confrontos, cada um a abrir o evento. A lista das Stats deixou
      de expandir o histórico em acordeão e passa a navegar para aqui
- [x] `domain/dates.ts` (puro) — formatação de datas `AAAA-MM-DD` sem passar pelo `Date`, que as lê
      em UTC e num fuso negativo recua um dia
- [x] `domain/lifeCounter.ts` (puro) — o contador de vida: totais, fim de game proposto, sequência
      de games e a conversão para `Game[]`. O resultado do match continua a sair de
      `resultFromGames`, sem segundo caminho até ao ficheiro
- [x] `domain/holdRepeat.ts` (puro) — manter o dedo em baixo para repetir, com o temporizador único
      que corrige o erro do primeiro feitio: a tocar depressa ficava uma repetição sem dono
- [x] `services/lifeSession.ts` — a partida a meio, no AsyncStorage e com chave da ronda; nunca
      atira, como as preferências
- [x] `store/useLifeStore.ts` — a gaveta que entrega os games contados ao registo de match
- [x] `store/useEventsStore.ts` local-first; Supabase removido do código e das dependências
- [x] 448 testes nos módulos puros

---

## O que falta

**Passos manuais**, com o guia em `docs/ops/telemovel-setup.md`:

- [ ] Ligar o GitHub Pages (Settings → Pages → Source: GitHub Actions)
- [ ] Guardar a keystore nos segredos e correr o workflow **Gerar APK (Gradle)** (ADR 0008 — sem
      EAS e sem conta na Expo)
- [ ] Criar o token e colá-lo no écran de Settings
- [ ] Registar o primeiro torneio a sério e confirmar que aparece um commit

**Por confirmar contra o mundo real** — escrito e testado contra payloads sintéticos, mas o proxy do
ambiente de desenvolvimento recusa ligações à Scryfall:

- [ ] `GET /sets` e `GET /cards/search` no telemóvel
- [ ] A primeira execução do workflow `refresh-prices.yml`

A dívida conhecida está listada em `docs/product/roadmap.md`.

---

## Decisões Técnicas

| Decisão | Escolha | Porquê |
|---|---|---|
| Onde vivem os dados | Ficheiros JSON no repositório | ADR 0002 — custo zero, nada que adormeça, histórico de graça |
| Como a app escreve | Local-first + outbox → Contents API | ADR 0004 — instantâneo e funciona sem rede |
| Forma da app | Nativa (Expo), APK compilado no GitHub Actions | ADR 0003 e ADR 0008 — os écrans já estavam feitos; sideload no Android é grátis, e o Gradle no CI dispensa conta na Expo |
| Utilizadores | Um só, sem contas | ADR 0006 — a infraestrutura multi-utilizador estava a travar o produto |
| Visibilidade do repo | Público | ADR 0005 — Pages gratuito; a saída para privacidade são alcunhas |
| State management | Zustand | Simples e reactivo |
| Dados de cartas | Scryfall API | Gratuita, completa, bem documentada |
| Preços das cartas | Scryfall, por workflow semanal | ADR 0007 — a Cardmarket API exigia app aprovada e OAuth |
| Decks | Entidade própria com `deckId` | Fase 2 — texto livre não se somava entre torneios |
| Lista de cartas do deck | Campos da Scryfall copiados para o ficheiro | Uma impressão não muda; copiar deixa a análise funcionar sem rede |
| Mana symbols | SVG locais | Offline e sem dependência de CDN |
| Design tokens | `theme/` (não `constants/`) | Separação clara design/código |
| Tipos | `types/index.ts` centralizado, derivado dos schemas | Uma fonte de verdade |
| Dark mode | `userInterfaceStyle: dark` | Design brief |

---

## Histórico de arquitectura

O MVP foi construído sobre Supabase (PostgreSQL + Anon Auth + RLS) e chegou a persistir dados reais.
Foi abandonado em 2026-08-31: manter uma base de dados partilhável obrigava a pensar em contas, RLS e
free tiers que adormecem, e esse trabalho estava entre o autor e a app que ele queria usar. O
raciocínio completo está no ADR 0002 e no ADR 0006.
