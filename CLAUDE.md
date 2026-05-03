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
| Mobile | React Native \+ Expo |
| Linguagem | TypeScript |
| Base de dados | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Card data | Scryfall API |
| Card prices | Cardmarket API |
| State management | A decidir (provavelmente Zustand) |

---

## Estrutura de Pastas (actual)

```
/app              — écrans (Expo Router)
  _layout.tsx     — root layout (auth init)
  (tabs)/
    _layout.tsx   — tab bar
    index.tsx     — Home (placeholder)
    events.tsx    — Events (placeholder)
    stats.tsx     — Stats (placeholder)
    profile.tsx   — Profile (placeholder)

/components       — componentes reutilizáveis (a criar)
/services         — Supabase client + auth
/hooks            — lógica reutilizável (a criar)
/types
  index.ts        — todos os tipos TypeScript (Event, Match, ManaSelection, etc.)
/theme
  colors.ts       — paleta completa (fonte de verdade)
  typography.ts   — fontes e tamanhos
  mana.ts         — cores MTG por símbolo (W/U/B/R/G)
/constants
  colors.ts       — re-exporta theme/colors (retrocompatibilidade)
/design
  handoff.md      — spec completa de implementação React Native
  screen-home.png
  screen-events.png
  screen-event-detail.png
  screen-match-registration.png
design-brief.md   — conceito visual, paleta original, referências
```

---

## Convenções

- Linguagem dos comentários: **português**
- Ficheiros e variáveis: **camelCase** em inglês (convenção da linguagem)
- Componentes React: **PascalCase**
- Sempre usar **TypeScript** — nunca JavaScript puro
- Prefer **functional components** e **hooks**
- Cada ficheiro deve ter **uma responsabilidade** clara
- Imports de tema: sempre de `../theme/colors`, `../theme/typography`, `../theme/mana`

---

## Design System — "Scholar's Archive"

**Conceito:** biblioteca académica semi-minimalista. Warm, culta, organizada. Não épico/gaming.

### Cores principais (theme/colors.ts)
- Fundo: `#130F0A` / Card: `#1E1812` / Hover: `#252019`
- Gold accent: `#C9A96E` / Gold dim: `#8B7248`
- Texto: `#E8DCC8` (prim) / `#A8967A` (sec) / `#6B5C3E` (dim)
- Win: `#5A8B5C` / Loss: `#8B4A4A` / Draw: `#7A7060`

### Tipografia (theme/typography.ts)
- **Playfair Display** — títulos, nomes de eventos (`fonts.display`, `.displaySemi`, etc.)
- **EB Garamond** — corpo, labels, listas (`fonts.body`, `.bodyItal`, etc.)
- Instalar: `@expo-google-fonts/playfair-display` + `@expo-google-fonts/eb-garamond`

### Componentes partilhados (a criar em /components)
- `ManaPip` — pip de cor de mana (W/U/B/R/G), com estado `isSplash`
- `TabBar` — 4 tabs: Home, Events, Stats, Profile
- `TypeBadge` — badge de formato (Sealed/Draft)
- `RecordBadge` — score W–L com win rate
- `CardThumbnailPlaceholder` — placeholder 36×50 ou 40×56px
- `EventCard` — card de evento com record, mana pips, chevron
- `MatchCard` — resultado de match com pill W/L/D

### Elementos visuais
- `border-radius: 4px` (pequeno) a `12px` (cards)
- Bordas: `1px solid #3A3020`
- Accent bar: `3px` wide, gold gradient (eventos activos)
- Iconografia: linha fina (stroke), não preenchido

---

## Decisões Técnicas Já Tomadas

1. **Supabase** como backend — não Firebase
2. **Scryfall API** como fonte única de dados de cartas
3. **Cardmarket API** para preços — Fase 4+
4. **Expo Router** para navegação (file-based routing)
5. Dados guardados **na cloud** (Supabase)
6. **MVP usa Supabase Anonymous Auth** — sem login forçado; dados migram na Fase 2
7. **theme/** pasta separada de **constants/** — fonte de verdade do design
8. **types/index.ts** — tipos centralizados (Event, Match, ManaSelection, etc.)

---

## APIs — Informação Importante

### Scryfall
- Base URL: `https://api.scryfall.com`
- Endpoints: `/cards/search`, `/cards/autocomplete`, `/cards/named`
- Rate limit: 50-100ms entre requests (respeitar sempre)
- Documentação: https://scryfall.com/docs/api

### Cardmarket
- Requer autenticação OAuth 1.0
- Base URL: `https://api.cardmarket.com/ws/v2.0`

### Supabase
- URL e anon key em `.env` — nunca hardcode credenciais

---

## Modelo de Dados (Supabase) — Definido

Ver `data-model.md` para detalhe completo. Tipos TypeScript em `types/index.ts`.

Resumo das tabelas:
- `users` — auth (Anon no MVP)
- `events` — torneios (type, date, active, rank)
- `matches` — resultado W/L/D, ronda, opponent_colors (com splash)
- `opponents` — entidade própria para stats cross-event
- `games` — games individuais (opcional no registo rápido)
- `decks` — 1 por evento, Fase 2+
- `deck_cards` — Fase 2+
- `portfolio_cards` — Fase 3+

**Campos calculados (não guardar):** points (W×3+D×1), win_rate, record W-L-D
**Cores:** sempre `ManaSelection { main: ManaColor[], splash: ManaColor[] }`

---

## Navegação (design/handoff.md § 8)

```
Stack principal:
  Home          ← tab 1
  Events List   ← tab 2
    Event Detail  ← push
  Stats         ← tab 3 (Fase 2+)
  Profile       ← tab 4 (Fase 2+)

Modal (sheet, bottom-up):
  Match Registration ← a partir de Event Detail + Home CTA
```

Usar `@react-navigation/native` com `createBottomTabNavigator` + `createNativeStackNavigator`.

---

## Estado Actual do Projecto

- **Fase:** MVP — infraestrutura pronta, a implementar écrans reais
- **O que está feito:**
  - Supabase client + Anon Auth (`services/supabase.ts`, `services/auth.ts`)
  - Expo Router com 4 tabs (écrans placeholder)
  - Design system completo: `theme/colors.ts`, `theme/typography.ts`, `theme/mana.ts`
  - Tipos TypeScript: `types/index.ts` (Event, Match, ManaSelection, calcEventStats)
  - Design assets: `design/handoff.md` + 4 prints de écran
- **Próximo passo:** Implementar écrans — começar pelo **Home Screen**
- **Ver também:** `project-overview.md` para estado detalhado e `design/handoff.md` para spec completa

---

## Regras de Trabalho

1. Antes de criar um ficheiro, verificar se já existe algo semelhante
2. Sempre criar tipos TypeScript para dados que vêm de APIs externas
3. Chamadas a APIs **sempre** em `/services` — nunca nos écrans
4. Quando houver dúvida, apresentar 2 opções com prós/contras antes de implementar
5. **Antes de cada acção, explicar em português o que vai fazer e porquê, em 2-3 linhas**
6. **Sempre que se implementar uma feature ou o estado mudar — actualizar CLAUDE.md e project-overview.md**
7. Para implementar um écran, consultar sempre `design/handoff.md` para a spec exacta
