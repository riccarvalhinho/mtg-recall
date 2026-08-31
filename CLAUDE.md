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
| Distribuição | EAS Build (APK) + EAS Update |
| Card data | Scryfall API |
| Card prices | Cardmarket API (Fase 4) |
| Mana symbols | SVG locais em `assets/mana/symbols.ts` |

---

## Estrutura de Pastas

```
/app                        écrans (Expo Router)
  _layout.tsx               root layout (fontes + Stack)
  match-registration.tsx    modal: registo de match
  add-event.tsx             modal: criar evento
  (tabs)/
    _layout.tsx             tab bar (Home/Events/Stats/Settings)
    index.tsx               Home
    events.tsx              Events List
    stats.tsx               Stats
    profile.tsx             Settings (token + sincronização)
  event/[id].tsx            Event Detail (push, sem tab bar)

/components                 ManaPip, TypeBadge, RecordBadge, EventCard, MatchCard,
                            CardThumbnailPlaceholder, ConfirmModal
/domain                     lógica pura, sem I/O e testável (outbox)
/services                   tudo o que fala com o mundo: github, localStore, outbox, sync, repoFiles
/store                      useEventsStore (Zustand)
/theme                      colors, typography, mana
/types                      tipos TypeScript — derivam dos schemas
/assets/mana/symbols.ts     símbolos de mana em SVG, locais

/data                       OS DADOS (ADR 0002)
  schema/                   o contrato, validado em CI
  events/                   um evento por ficheiro
  taxonomies/opponents.json adversários, por referência

/tools                      validate-data.ts, build-bundle.ts
/docs
  adr/                      decisões estruturais
  product/                  roadmap, perguntas em aberto
  ops/                      instalar no telemóvel, gerar o token
/design                     handoff.md (spec de implementação) + prints de referência

data-model.md               o modelo de dados explicado
design-brief.md             conceito visual
project-overview.md         estado actual detalhado
```

---

## Os dados

Um evento = um ficheiro `data/events/<AAAA-MM-DD-slug>.json`, com os matches lá dentro. Os
adversários são referências para `data/taxonomies/opponents.json`. Nada de campos calculados nos
ficheiros — win rate e pontos calculam-se em runtime. **Ler `data-model.md` antes de mexer em
qualquer coisa relacionada com dados**, e alterar o schema antes de alterar o código.

Comandos na raiz:

```bash
npm run validate    # valida data/**/*.json contra data/schema/*.json
npm run bundle      # gera o bundle.json que a app lê ao instalar/restaurar
npm run test        # testes dos módulos puros (outbox, serializadores)
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

---

## Navegação (Expo Router)

```
Stack principal:
  (tabs)/index        ← Home
  (tabs)/events       ← Events List
  (tabs)/stats        ← Stats
  (tabs)/profile      ← Settings
  event/[id]          ← Event Detail (push, sem tab bar)

Modals (presentation: 'modal'):
  match-registration  ← a partir de Event Detail
  add-event           ← a partir de Events List / Home
```

Params de navegação para match-registration: `{ eventId, round, eventName }`

---

## APIs

### Scryfall
- Base URL: `https://api.scryfall.com`
- Rate limit: 50–100 ms entre requests (respeitar sempre)

### GitHub
- Contents API para escrever; `bundle.json` em GitHub Pages para ler
- Token fine-grained, só este repositório, `Contents: read and write`

---

## Estado Actual

Ver `project-overview.md` para o detalhe e `docs/product/roadmap.md` para o que vem a seguir.

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
