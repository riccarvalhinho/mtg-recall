# CLAUDE.md — MTG Companion App

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

## Estrutura de Pastas (a criar)

/app              — écrans (Expo Router)

/components       — componentes reutilizáveis

/services         — chamadas a APIs externas (Scryfall, Cardmarket, Supabase)

/hooks            — lógica reutilizável

/types            — definições TypeScript

/constants        — cores, tamanhos, configurações fixas

/assets           — imagens, ícones, fontes

---

## Convenções

- Linguagem dos comentários: **português**  
- Ficheiros e variáveis: **camelCase** em inglês (convenção da linguagem)  
- Componentes React: **PascalCase**  
- Sempre usar **TypeScript** — nunca JavaScript puro  
- Prefer **functional components** e **hooks**  
- Cada ficheiro deve ter **uma responsabilidade** clara

---

## Decisões Técnicas Já Tomadas

1. **Supabase** como backend — não Firebase  
2. **Scryfall API** como fonte única de dados de cartas (pesquisa, imagens, metadata)  
3. **Cardmarket API** para preços — actualização frequente, não real-time por cada request  
4. **Expo Router** para navegação (file-based routing, padrão moderno do Expo)  
5. Dados do utilizador guardados **na cloud** (Supabase) — não apenas local  
6. **MVP usa Supabase Anonymous Auth** — utilizador invisível criado automaticamente no primeiro uso, sem login. Na Fase 2, quando o utilizador criar conta, os dados do anónimo migram para a conta real. Isto permite cloud storage no MVP sem forçar login.

---

## APIs — Informação Importante

### Scryfall

- Base URL: `https://api.scryfall.com`  
- Endpoints principais: `/cards/search`, `/cards/autocomplete`, `/cards/named`  
- Rate limit: 50-100ms entre requests (respeitar sempre)  
- Imagens: disponíveis em vários tamanhos no objecto de cada carta  
- Documentação: [https://scryfall.com/docs/api](https://scryfall.com/docs/api)

### Cardmarket

- Requer autenticação OAuth 1.0  
- Base URL: `https://api.cardmarket.com/ws/v2.0`  
- Documentação: [https://api.cardmarket.com/ws/documentation](https://api.cardmarket.com/ws/documentation)

### Supabase

- URL e anon key guardadas em variáveis de ambiente (`.env`)  
- Nunca hardcode credenciais no código

---

## Modelo de Dados (Supabase) — Definido

Ver ficheiro `data-model.md` para detalhe completo. Resumo:

users           — auth (Anon no MVP, real na Fase 2\)

events          — torneios (type, set\_code, date, status, rank)

opponents       — entidade própria para stats cross-event (ligação a app\_user\_id na Fase 4+)

matches         — resultado W/L/D, ronda, went\_first, opponent\_colors (com splash)

games           — games individuais dentro de cada match (1, 2 ou 3\) — opcional no registo rápido

decks           — 1 por evento, com colors (com splash) e thumbnail\_card\_id

deck\_cards      — Fase 2+ (in\_deck bool para separar deck de card pool)

portfolio\_cards — Fase 3+ (condition, foil)

**Campos calculados (não guardados):** points (W*3+D*1), win\_rate, record W-L-D, ELO (Fase 3\) **Cores:** sempre `{ color: string, splash: boolean }` — nunca array plano **Sets MTG:** não é tabela — vêm da Scryfall API (`/sets`), cache local

---

## Estado Actual do Projecto

- **Fase:** Planning — ainda não há código  
- **Roadmap definido:**  
  - MVP: Event Tracker, Match Registration, Tournament Stats, Cloud Storage (Supabase Anon Auth)  
  - Fase 2: Deck Manager, Deck Analyser, User Auth completo  
  - Fase 3: Card Search (Scryfall), Portfolio Manager  
  - Fase 4+: Portfolio Value (Cardmarket), Life Point Tracker, Social Layer  
- **Próximo passo:** Prototipar écrans MVP no Claude Design

---

## Regras de Trabalho

1. Antes de criar um novo ficheiro, verificar se já existe algo semelhante em `/components` ou `/services`  
2. Sempre criar tipos TypeScript para dados que vêm de APIs externas  
3. Chamadas a APIs externas **sempre** em `/services` — nunca directamente nos écrans  
4. Quando houver dúvida sobre uma abordagem, apresentar 2 opções com prós/contras antes de implementar  
5. **Antes de cada acção que requer aprovação, explicar em português o que vai fazer e porquê, em 2-3 linhas simples**

