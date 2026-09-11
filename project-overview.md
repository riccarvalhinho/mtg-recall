# MTG Recall — Project Overview

> Estado actual do projecto. Actualizar sempre que uma feature for implementada, uma decisão técnica
> for tomada, ou o estado mudar.
> Última actualização: 2026-09-11

---

## Language

**All app text is in English** — UI labels, menus, placeholders and error messages. Code comments and
project documentation (`docs/`, ADRs) are written in Portuguese.

---

## Estado Actual

**Fase 0 — Repurpose, feita no código.** A app deixou de depender do Supabase e guarda os dados como
ficheiros JSON no próprio repositório, escritos através da Contents API do GitHub. Utilizador único,
sem contas. As decisões estão em `docs/adr/`.

`npm run check` passa — dados válidos, typecheck limpo, 46 testes verdes.

Falta uma correcção (o restauro não descarta a outbox, Q7) e quatro passos manuais que dependem das
contas do autor: ligar o Pages, correr o `eas build`, criar o token e registar o primeiro torneio. O
detalhe está em `docs/product/roadmap.md` e o guia em `docs/ops/telemovel-setup.md`.

**`data/events/` está vazio.** Enquanto não houver lá um torneio a sério, a cadeia telemóvel →
commit → bundle → restauro não está provada ponta a ponta.

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

### Écrans
- [x] **Home** — empty state e variante com dados (StatsBlock + evento activo)
- [x] **Events List** — StatsStrip, secções activo/histórico, OrnamentDivider, procura local por
      nome do evento, local e adversário (`domain/search.ts`)
- [x] **Event Detail** — StatsBar, DeckSection colapsável, lista de matches, concluir evento
      (rank + nº de jogadores), apagar evento e apagar match com confirmação
- [x] **Match Registration** — selector de cores com 3 estados por pip, resultado, notas
- [x] **Add Event** — selector de formato (7 tipos), nome, data, local e **set escolhido de uma
      lista da Scryfall** (só em Sealed/Draft), com cache offline e escrita à mão como recurso
- [x] **Stats** — gráfico de tendência, desempenho por cor, pirâmide de classificações e
      **Opponents** (nemesis, melhor matchup, mais enfrentados e head-to-head por toque)
- [x] **Settings** — token (verificado antes de guardar), estado da sincronização, sincronizar
      agora, restauro a partir do GitHub

### Navegação
- [x] Root layout com 9 variantes de fonte carregadas por `expo-font`
- [x] 4 tabs; Event Detail fora do grupo de tabs; modais com `presentation: 'modal'`

### Decisões
- [x] `docs/adr/0001` a `0006` — GitHub como source of truth, dados JSON versionados, app nativa em
      vez de PWA, escrita por outbox, repositório público, utilizador único
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
- [x] `store/useEventsStore.ts` local-first; Supabase removido do código e das dependências
- [x] 46 testes nos módulos puros

---

## O que falta (Fase 0)

**A corrigir:**

- [ ] O restauro não descarta a outbox. `localStore.replaceAll` limpa `mtgrecall.file:*` e
      `mtgrecall.files`, mas a fila vive em `mtgrecall.outbox` e sobrevive — o worker envia-a a
      seguir, por cima do que acabou de ser restaurado. O modal promete o contrário. Ver Q7 em
      `docs/product/open-questions.md`

**Passos manuais**, com o guia em `docs/ops/telemovel-setup.md`:

- [ ] Ligar o GitHub Pages (Settings → Pages → Source: GitHub Actions)
- [ ] Correr `eas init` e o primeiro `eas build --profile preview --platform android`
- [ ] Criar o token e colá-lo no écran de Settings
- [ ] Registar o primeiro torneio a sério e confirmar que aparece um commit

O detalhe das fases seguintes está em `docs/product/roadmap.md`.

---

## Decisões Técnicas

| Decisão | Escolha | Porquê |
|---|---|---|
| Onde vivem os dados | Ficheiros JSON no repositório | ADR 0002 — custo zero, nada que adormeça, histórico de graça |
| Como a app escreve | Local-first + outbox → Contents API | ADR 0004 — instantâneo e funciona sem rede |
| Forma da app | Nativa (Expo), APK por EAS Build | ADR 0003 — seis écrans já feitos; sideload no Android é grátis |
| Utilizadores | Um só, sem contas | ADR 0006 — a infraestrutura multi-utilizador estava a travar o produto |
| Visibilidade do repo | Público | ADR 0005 — Pages gratuito; a saída para privacidade são alcunhas |
| State management | Zustand | Simples e reactivo |
| Dados de cartas | Scryfall API | Gratuita, completa, bem documentada |
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
