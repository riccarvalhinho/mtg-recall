# CLAUDE.md — MTG Recall

Este ficheiro é lido automaticamente pelo Claude Code em cada sessão. Contém contexto completo do projecto para evitar repetição e garantir consistência.

---

## O Projecto

App mobile para jogadores de Magic: The Gathering. Permite gerir eventos de torneio, decks, matches, estatísticas, e coleção pessoal de cartas com tracking de valor.

O developer é um iniciante em programação — explicar conceitos quando relevante, não assumir conhecimento prévio de padrões ou convenções.

---

## Stack

| Camada | Tecnologia |
| :---- | :---- |
| Mobile | React Native \+ Expo SDK 54 |
| Linguagem | TypeScript |
| Routing | Expo Router (file-based) |
| State | Zustand (`store/useEventsStore.ts`) |
| Base de dados | Supabase (PostgreSQL) — tabelas ainda por criar |
| Auth | Supabase Anon Auth (activo) |
| Card data | Scryfall API |
| Card prices | Cardmarket API (Fase 4+) |
| Mana symbols | Scryfall CDN SVG via `react-native-svg` `SvgUri` |

---

## Estrutura de Pastas (actual)

```
/app
  _layout.tsx             — root layout (fonts + auth + Stack screens)
  match-registration.tsx  — modal: registo de match
  add-event.tsx           — modal: criar evento
  (tabs)/
    _layout.tsx           — tab bar (Home/Events/Stats/Profile)
    index.tsx             — Home (empty state implementado)
    events.tsx            — Events List (completo)
    stats.tsx             — placeholder
    profile.tsx           — placeholder
  event/
    [id].tsx              — Event Detail (completo, fora dos tabs)

/components
  ManaPip.tsx             — pip oficial MTG (Scryfall CDN SVG, isSplash)
  TypeBadge.tsx           — badge Sealed/Draft
  RecordBadge.tsx         — score W–L + win rate
  CardThumbnailPlaceholder.tsx
  EventCard.tsx           — card de evento com accent bar
  MatchCard.tsx           — resultado de match com pill W/L/D

/data
  mock.ts                 — mockEvents (5 eventos de exemplo)

/services
  supabase.ts             — Supabase client
  auth.ts                 — Anon Auth

/store
  useEventsStore.ts       — Zustand: events[], addMatch()

/theme
  colors.ts               — paleta completa (fonte de verdade)
  typography.ts           — fontes e tamanhos
  mana.ts                 — cores MTG por símbolo (referência)

/types
  index.ts                — todos os tipos TypeScript

/constants
  colors.ts               — re-exporta theme/colors (retrocompatibilidade)

/design
  handoff.md              — spec completa de implementação React Native
  screen-*.png            — prints de écran de referência

design-brief.md           — conceito visual, paleta original
data-model.md             — modelo de dados Supabase
```

---

## Convenções

- **Toda a app está em inglês** — texto, labels, menus, placeholders, mensagens de erro, comentários de código, tudo
- Ficheiros e variáveis: **camelCase** em inglês (convenção da linguagem)
- Componentes React: **PascalCase**
- Sempre usar **TypeScript** — nunca JavaScript puro
- Prefer **functional components** e **hooks**
- Cada ficheiro deve ter **uma responsabilidade** clara
- Imports de tema: sempre de `../theme/colors`, `../theme/typography`
- `npm install` requer sempre `--legacy-peer-deps` (conflito react-dom@19.2.5 vs react@19.1.0)
- Metro cache: limpar com `npx expo start --tunnel --clear` ao adicionar novas pastas

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
  - `fonts.displayItal` = `PlayfairDisplay_400Regular_Italic` ← atenção ao nome exato
- **EB Garamond** — corpo, labels, listas
  - `fonts.body` = `EBGaramond_400Regular`
  - `fonts.bodyItal` = `EBGaramond_400Regular_Italic`
  - `fonts.bodyMed` = `EBGaramond_500Medium`

### ManaPip (components/ManaPip.tsx)
- Usa `SvgUri` de `react-native-svg` com URLs do Scryfall CDN
- Props: `color: ManaColor`, `size?: number` (default 16), `isSplash?: boolean`
- `isSplash`: tamanho ×0.70, opacidade 0.65
- URLs: `https://svgs.scryfall.io/card-symbols/{W|U|B|R|G}.svg`

---

## State Management — Zustand

**`store/useEventsStore.ts`** é a fonte de verdade durante a sessão.

```ts
useEventsStore(s => s.events)         // lista reactiva de eventos
useEventsStore(s => s.addMatch)       // acção: adicionar match a um evento
```

Estado inicial vem de `data/mock.ts`. Na Fase 2, as acções chamarão `services/events.ts` e `services/matches.ts` em vez de modificar estado local.

---

## Navegação (Expo Router)

```
Stack principal:
  (tabs)/index        ← Home (tab 1)
  (tabs)/events       ← Events List (tab 2)
  (tabs)/stats        ← Stats (tab 3, placeholder)
  (tabs)/profile      ← Profile (tab 4, placeholder)
  event/[id]          ← Event Detail (push, sem tab bar)

Modals (presentation: 'modal'):
  match-registration  ← a partir de Event Detail
  add-event           ← a partir de Events List
```

Params de navegação para match-registration: `{ eventId, round, eventName }`

---

## APIs — Informação Importante

### Scryfall
- Base URL: `https://api.scryfall.com`
- Mana SVGs: `https://svgs.scryfall.io/card-symbols/{COLOR}.svg`
- Rate limit: 50-100ms entre requests (respeitar sempre)

### Supabase
- URL e anon key em `.env` — nunca hardcode credenciais
- Auth anónimo activo; tabelas DB ainda não criadas

---

## Estado Actual do Projecto (2026-05-10)

- **Fase:** MVP — integração Supabase completa; app persiste dados reais
- **Écrans prontos:** Home (empty state + detecção hasEvents), Events List, Event Detail (com delete), Match Registration, Add Event (persiste no Supabase), Stats/Profile (placeholders)
- **Componentes prontos:** ManaPip, TypeBadge, RecordBadge, CardThumbnailPlaceholder, EventCard, MatchCard, ConfirmModal
- **Estado reactivo:** Zustand store chama services Supabase (loadEvents, addMatch, createEvent, deleteEvent, deleteMatch)
- **Próximo passo:** Home "com dados" (StatsBlock + EventoActivo + EventosRecentes) + ligar CTA do empty state a Add Event
- **Ver também:** `project-overview.md` para estado detalhado, `design/handoff.md` para spec completa, `data-model.md` para schema das tabelas

---

## Regras de Trabalho

1. Antes de criar um ficheiro, verificar se já existe algo semelhante
2. Sempre criar tipos TypeScript para dados que vêm de APIs externas
3. Chamadas a APIs **sempre** em `/services` — nunca nos écrans
4. Quando houver dúvida, apresentar 2 opções com prós/contras antes de implementar
5. **Antes de cada acção, explicar em português o que vai fazer e porquê, em 2-3 linhas**
6. **Sempre que se implementar uma feature ou o estado mudar — actualizar CLAUDE.md e project-overview.md**
7. Para implementar um écran, consultar sempre `design/handoff.md` para a spec exacta
