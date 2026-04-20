# CLAUDE.md — MTG Companion App

> Este ficheiro é lido automaticamente pelo Claude Code em cada sessão.
> Contém contexto completo do projecto para evitar repetição e garantir consistência.

---

## O Projecto

App mobile para jogadores de Magic: The Gathering. Permite gerir eventos de torneio, decks, matches, estatísticas, e coleção pessoal de cartas com tracking de valor.

O developer é um iniciante em programação — explicar conceitos quando relevante, não assumir conhecimento prévio de padrões ou convenções.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Mobile | React Native + Expo |
| Linguagem | TypeScript |
| Base de dados | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Card data | Scryfall API |
| Card prices | Cardmarket API |
| State management | A decidir (provavelmente Zustand) |

---

## Decisões Técnicas Já Tomadas

1. **Supabase** como backend — não Firebase
2. **Scryfall API** como fonte única de dados de cartas
3. **Cardmarket API** para preços — actualização frequente, não real-time
4. **Expo Router** para navegação
. Dados na cloud (Supabase) -- não apenas local
6. **MVP usa Supabase Anonymous Auth**

---

## Estado Actual

- Fase: Planning
- Próximo passo: Prototipar écrans MVP no Claude Design (começar por Events tab)

## Regras de Trabalho

1. Verificar se já existe componente/servico semelhante antes de criar
2. Sempre criar tipos TypeScript para dados de APIs externas
3. Chamadas a APIs externas sempre em /services -- nunca directamente nos écrans
4. Apresentar 2 opções com prós/contras antes de implementar quando houver dúvida