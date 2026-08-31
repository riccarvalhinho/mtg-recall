# MTG Recall — Project Overview

> Estado actual do projecto. Actualizar sempre que uma feature for implementada, uma decisão técnica
> for tomada, ou o estado mudar.
> Última actualização: 2026-08-31

---

## Language

**All app text is in English** — UI labels, menus, placeholders and error messages. Code comments and
project documentation (`docs/`, ADRs) are written in Portuguese.

---

## Estado Actual

**Fase 0 — Repurpose.** A app deixa de depender do Supabase e passa a guardar os dados como ficheiros
JSON no próprio repositório, escritos pela app através da Contents API do GitHub. Utilizador único,
sem contas. As decisões estão em `docs/adr/`; o que falta está em `docs/product/roadmap.md`.

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
- [x] **Events List** — StatsStrip, secções activo/histórico, OrnamentDivider
- [x] **Event Detail** — StatsBar, DeckSection colapsável, lista de matches, concluir evento
      (rank + nº de jogadores), apagar evento e apagar match com confirmação
- [x] **Match Registration** — selector de cores com 3 estados por pip, resultado, notas
- [x] **Add Event** — selector de formato (7 tipos), nome, data e local
- [x] **Stats** — gráfico de tendência, desempenho por cor, pirâmide de classificações
- [ ] **Settings** (hoje o tab Profile é um placeholder) — token e estado da sincronização

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
- [x] `store/useEventsStore.ts` local-first; Supabase removido do código e das dependências
- [x] 46 testes nos módulos puros

---

## O que falta (Fase 0)

- [ ] Correr `eas init` e o primeiro `eas build --profile preview --platform android`
- [ ] Ligar o GitHub Pages (Settings → Pages → Source: GitHub Actions)
- [ ] Criar o token e colá-lo no écran de Settings
- [ ] Registar o primeiro torneio a sério e confirmar que aparece um commit

Os três primeiros são passos manuais, com o guia em `docs/ops/telemovel-setup.md`.

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
