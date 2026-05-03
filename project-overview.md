# MTG Recall — Project Overview

> Estado actual do projecto. Actualizar sempre que uma feature for implementada, uma decisão técnica for tomada, ou o estado mudar.
> Última actualização: 2026-05-03

---

## Estado Actual

**Fase:** MVP — infraestrutura pronta, a implementar écrans reais

---

## O que está feito

### Infraestrutura
- [x] Expo + React Native + TypeScript configurados
- [x] Supabase client (`services/supabase.ts`) com variáveis de ambiente
- [x] Anon Auth (`services/auth.ts`) — login anónimo automático no arranque
- [x] Expo Router instalado e configurado

### Navegação
- [x] Root layout (`app/_layout.tsx`) — inicia Supabase auth, StatusBar dark
- [x] Tab layout (`app/(tabs)/_layout.tsx`) — 4 tabs: Home, Events, Stats, Profile
- [x] 4 écrans placeholder

### Design System
- [x] `design-brief.md` — conceito "Scholar's Archive", paleta original, referências
- [x] `design/handoff.md` — spec completa de implementação React Native (tipografia, cores exactas, todos os écrans, componentes, animações, tipos de dados, navegação)
- [x] `design/screen-home.png` — print do Home Screen
- [x] `design/screen-events.png` — print do Events List Screen
- [x] `design/screen-event-detail.png` — print do Event Detail Screen
- [x] `design/screen-match-registration.png` — print do Match Registration Screen
- [x] `theme/colors.ts` — paleta completa e definitiva (bg, gold, texto, estados win/loss/draw, tabBar)
- [x] `theme/typography.ts` — fontes Playfair Display + EB Garamond com variantes
- [x] `theme/mana.ts` — cores por símbolo de mana (W/U/B/R/G) com estados normal/selected
- [x] `constants/colors.ts` — re-exporta theme/colors para retrocompatibilidade

### Tipos TypeScript
- [x] `types/index.ts` — tipos completos:
  - `ManaColor`, `MatchResult`, `EventType`
  - `ManaSelection` (main + splash)
  - `Match`, `Event`, `EventStats`
  - `calcEventStats()` — função utilitária

---

## O que falta (MVP)

### Componentes base
- [x] `components/ManaPip.tsx` — pip de cor de mana com isSplash
- [ ] `components/TypeBadge.tsx` — badge Sealed/Draft
- [ ] `components/RecordBadge.tsx` — score W–L com win rate
- [ ] `components/CardThumbnailPlaceholder.tsx`
- [ ] `components/EventCard.tsx`
- [ ] `components/MatchCard.tsx`

### Écrans (em ordem de prioridade)
- [x] **Home** — empty state implementado (ornamento SVG, CTA, flavour text)
- [ ] Home — variante "com dados" (StatsBlock + EventoActivo + EventosRecentes)
- [ ] **Events List** — lista de eventos com StatsStrip
- [ ] **Event Detail** — detalhe de evento com matches
- [ ] **Match Registration** — modal de registo de match
- [ ] Add Event — formulário novo evento

### Fontes
- [x] Instalar `@expo-google-fonts/playfair-display` + `@expo-google-fonts/eb-garamond` + `expo-font`
- [x] Instalar `react-native-svg` + `expo-linear-gradient`
- [x] Configurar `useFonts()` no root layout (aguarda fontes antes de renderizar)

### Base de Dados (Supabase)
- [ ] Criar tabelas conforme `data-model.md`
- [ ] Activar Row Level Security (RLS)
- [ ] `services/events.ts` — CRUD de eventos
- [ ] `services/matches.ts` — CRUD de matches

---

## Estrutura de Pastas Actual

```
/app
  _layout.tsx
  (tabs)/
    _layout.tsx
    index.tsx       — Home (empty state ✓)
    events.tsx      — Events (placeholder)
    stats.tsx       — Stats (placeholder)
    profile.tsx     — Profile (placeholder)

/assets
/constants
  colors.ts         — re-exporta theme/colors
/design
  handoff.md        — spec completa de implementação
  screen-home.png
  screen-events.png
  screen-event-detail.png
  screen-match-registration.png
/services
  supabase.ts
  auth.ts
/theme
  colors.ts         — paleta (fonte de verdade)
  typography.ts     — fontes e tamanhos
  mana.ts           — cores MTG por símbolo
/types
  index.ts          — todos os tipos TypeScript

/components
  ManaPip.tsx       — pip de mana (W/U/B/R/G) com isSplash

design-brief.md     — conceito visual original
data-model.md       — modelo de dados Supabase
```

---

## Decisões Técnicas

| Decisão | Escolha | Razão |
|---|---|---|
| Backend | Supabase | PostgreSQL + Auth + RLS integrados |
| Dados de cartas | Scryfall API | Gratuita, completa, bem documentada |
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
| **MVP** | Event Tracker, Match Registration, Stats, Cloud (Anon Auth) |
| **Fase 2** | Deck Manager, Deck Analyser, User Auth completo |
| **Fase 3** | Card Search (Scryfall), Portfolio Manager |
| **Fase 4+** | Preços (Cardmarket), Life Point Tracker, Social Layer |
