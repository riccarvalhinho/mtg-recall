# MTG Recall — Project Overview

> Estado actual do projecto. Actualizar sempre que uma feature for implementada, uma decisão técnica for tomada, ou o estado mudar.
> Última actualização: 2026-05-09

---

## Estado Actual

**Fase:** MVP — écrans e navegação completos com mock data; a integrar Supabase DB

---

## O que está feito

### Infraestrutura
- [x] Expo + React Native + TypeScript configurados
- [x] Supabase client (`services/supabase.ts`) com variáveis de ambiente
- [x] Anon Auth (`services/auth.ts`) — login anónimo automático no arranque
- [x] Expo Router instalado e configurado
- [x] `npm install --legacy-peer-deps` necessário (conflito react-dom@19.2.5 vs react@19.1.0)

### Design System
- [x] `design-brief.md` — conceito "Scholar's Archive", paleta original, referências
- [x] `design/handoff.md` — spec completa de implementação React Native
- [x] 4 prints de écran em `/design/`
- [x] `theme/colors.ts` — paleta definitiva (bg, gold, texto, win/loss/draw, tabBar, border)
- [x] `theme/typography.ts` — Playfair Display + EB Garamond (variantes italic: `_400Regular_Italic`)
- [x] `theme/mana.ts` — cores MTG por símbolo (referência; ManaPip usa Scryfall CDN)
- [x] `constants/colors.ts` — re-exporta theme/colors para retrocompatibilidade

### Tipos TypeScript
- [x] `types/index.ts` — tipos completos: `ManaColor`, `MatchResult`, `EventType`, `ManaSelection`, `Match`, `Event`, `EventStats`, `calcEventStats()`

### State Management
- [x] `store/useEventsStore.ts` — Zustand store com estado reactivo
  - Estado inicial: `mockEvents` (substituir por Supabase na Fase 2)
  - Acção `addMatch(eventId, data)` — adiciona match e actualiza lista de matches do evento

### Mock Data
- [x] `data/mock.ts` — 5 eventos de exemplo (1 activo: "FNM Sealed — Aetherdrift" com 5 matches, 4 passados)

### Dependências instaladas
- [x] `@expo-google-fonts/playfair-display` + `@expo-google-fonts/eb-garamond` + `expo-font`
- [x] `react-native-svg` + `expo-linear-gradient`
- [x] `zustand`
- [x] `@expo/vector-icons` (Feather)
- [x] `react-native-safe-area-context`

### Navegação
- [x] Root layout (`app/_layout.tsx`) — carrega 9 variantes de fonte, auth init, StatusBar
- [x] Tab layout (`app/(tabs)/_layout.tsx`) — 4 tabs: Home, Events, Stats, Profile
- [x] Event Detail fora do grupo de tabs → sem tab bar
- [x] Modals: `match-registration` e `add-event` com `presentation: 'modal'`

### Componentes
- [x] `components/ManaPip.tsx` — SVGs oficiais MTG via Scryfall CDN (`SvgUri`), com `isSplash`
- [x] `components/TypeBadge.tsx` — badge Sealed/Draft com cores distintas
- [x] `components/RecordBadge.tsx` — score W–L com win rate
- [x] `components/CardThumbnailPlaceholder.tsx` — LinearGradient placeholder 36×50 / 40×56
- [x] `components/EventCard.tsx` — card com accent bar (activo), TypeBadge, ManaPips, RecordBadge
- [x] `components/MatchCard.tsx` — pill W/L/D, ronda, adversário, mana pips do adversário

### Écrans
- [x] **Home** (`app/(tabs)/index.tsx`) — empty state completo (ScholarOrnament SVG, CTA dourado, flavour text)
- [ ] Home — variante "com dados" (StatsBlock + Evento Activo + Eventos Recentes)
- [x] **Events List** (`app/(tabs)/events.tsx`) — StatsStrip, secções activo/histórico, OrnamentDivider
- [x] **Event Detail** (`app/event/[id].tsx`) — StatsBar, DeckSection colapsável, lista de MatchCards, AddMatchButton
- [x] **Match Registration** (`app/match-registration.tsx`) — modal com seletor de cores (3 estados por pip), ResultSelector, notas opcionais, guarda via Zustand
- [x] **Add Event** (`app/add-event.tsx`) — modal com seletor de formato (6 tipos), inputs de nome/data/local (sem persistência por ora)
- [x] **Stats** (`app/(tabs)/stats.tsx`) — placeholder estilizado
- [x] **Profile** (`app/(tabs)/profile.tsx`) — placeholder estilizado

---

## O que falta (MVP)

### Base de Dados (Supabase)
- [ ] Criar tabelas conforme `data-model.md` (events, matches, opponents, games, decks)
- [ ] Activar Row Level Security (RLS) nas tabelas
- [ ] `services/events.ts` — CRUD de eventos via Supabase
- [ ] `services/matches.ts` — CRUD de matches via Supabase
- [ ] Substituir Zustand mock data por queries Supabase (store actions chamam services)

### Écrans
- [ ] Home — variante "com dados"
- [ ] Add Event — persistir evento no Supabase (actualmente faz `router.back()` sem guardar)

### Produção / Qualidade
- [ ] ManaPip: migrar de Scryfall CDN para assets locais em `assets/mana/` (offline + performance)
- [ ] Actualizar `project-overview.md` e `CLAUDE.md` após cada sessão

---

## Estrutura de Pastas Actual

```
/app
  _layout.tsx           — root layout (fonts + auth)
  match-registration.tsx — modal
  add-event.tsx         — modal
  (tabs)/
    _layout.tsx         — tab bar (4 tabs)
    index.tsx           — Home (empty state ✓)
    events.tsx          — Events List ✓
    stats.tsx           — placeholder
    profile.tsx         — placeholder
  event/
    [id].tsx            — Event Detail ✓ (fora dos tabs)

/assets
/components
  ManaPip.tsx           — pip oficial MTG (Scryfall CDN SVG)
  TypeBadge.tsx         ✓
  RecordBadge.tsx       ✓
  CardThumbnailPlaceholder.tsx ✓
  EventCard.tsx         ✓
  MatchCard.tsx         ✓

/constants
  colors.ts             — re-exporta theme/colors

/data
  mock.ts               — mockEvents (5 eventos de exemplo)

/design
  handoff.md            — spec completa de implementação
  screen-home.png
  screen-events.png
  screen-event-detail.png
  screen-match-registration.png

/services
  supabase.ts
  auth.ts

/store
  useEventsStore.ts     — Zustand (events + addMatch)

/theme
  colors.ts             — paleta (fonte de verdade)
  typography.ts         — fontes e tamanhos
  mana.ts               — cores MTG por símbolo

/types
  index.ts              — todos os tipos TypeScript

design-brief.md
data-model.md
```

---

## Decisões Técnicas

| Decisão | Escolha | Razão |
|---|---|---|
| Backend | Supabase | PostgreSQL + Auth + RLS integrados |
| State management | Zustand | Simples, reactivo, fácil de migrar para Supabase |
| Dados de cartas | Scryfall API | Gratuita, completa, bem documentada |
| Mana symbols | Scryfall CDN SVG (dev) → assets locais (prod) | Oficial MTG, zero manutenção |
| Preços | Cardmarket API | Fase 4+ |
| Navegação | Expo Router | File-based routing, padrão moderno |
| Auth MVP | Supabase Anon Auth | Cloud storage sem forçar login |
| Design tokens | theme/ (não constants/) | Separação clara design/código |
| Tipos | types/index.ts centralizado | Uma fonte de verdade |
| Dark mode | `userInterfaceStyle: dark` | Design brief |

---

## Roadmap

| Fase | Features |
|---|---|
| **MVP** | Event Tracker ✓, Match Registration ✓, Supabase DB (próximo), Stats, Cloud Sync |
| **Fase 2** | Deck Manager, Deck Analyser, User Auth completo, Home "com dados" |
| **Fase 3** | Card Search (Scryfall), Portfolio Manager |
| **Fase 4+** | Preços (Cardmarket), Life Point Tracker, Social Layer |
