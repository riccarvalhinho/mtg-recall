# ADR 0002 — Dados em ficheiros JSON versionados, sem base de dados gerida

**Data:** 2026-08-31
**Estado:** Aceite
**Substitui:** a decisão "Backend: Supabase" registada em `project-overview.md`

## Contexto

O MVP foi construído sobre Supabase: PostgreSQL, Anon Auth e Row Level Security. Funcionou — os
eventos e os matches chegaram a ser gravados na nuvem — mas o custo apareceu noutro sítio.

Manter uma base de dados partilhável obriga a pensar em contas, em políticas de RLS, em quem vê o
quê, em migrações de schema e em o que acontece quando o free tier adormece por inatividade. Nada
disso é o produto. O produto é registar cinco matches num FNM e saber, três meses depois, com que
cores é que se ganha mais. O trabalho de infraestrutura ficou entre o autor e a app que ele queria
usar, e uma app que não se acaba não serve para nada.

As restrições reais, escritas sem otimismo:

- **Um utilizador.** Não há partilha, não há amigos, não há perfis públicos (ADR 0006).
- **Volume minúsculo.** Cinquenta eventos por ano, com cinco a nove matches cada, é uma estimativa
  generosa. São dezenas de kilobytes por ano.
- **Leitura muito mais frequente do que escrita.**
- **Tem de funcionar sem rede.** Numa loja de cartas, num torneio, o Wi-Fi é o que é e os dados
  móveis muitas vezes não entram.
- **Não pode depender de um serviço que adormeça ou que passe a custar dinheiro.**

## Decisão

Os dados são ficheiros JSON dentro do repositório, versionados em Git. Não há base de dados.

- Um evento = um ficheiro `data/events/<AAAA-MM-DD-slug>.json`, com os matches e os games lá dentro
- Adversários = `data/taxonomies/opponents.json`, referenciados por id
- Definições = `data/state/settings.json`
- Decks (Fase 2) = `data/decks/<slug>.json`; colecção (Fase 3) = `data/collection/cards.json`
- Os schemas em `data/schema/` são o contrato, validado em CI a cada push

Os matches vivem dentro do ficheiro do evento em vez de terem ficheiro próprio porque um match não
existe fora do seu evento, e porque o diff de uma noite de FNM deve ler-se de uma vez só. A ronda
identifica o match dentro do evento — não há UUIDs a gerar nem a sincronizar.

Os adversários são a excepção: são referências e não texto livre, porque sem isso as estatísticas por
adversário nunca conseguem agregar dois registos do mesmo nome escrito de duas maneiras.

## Alternativas consideradas

**Manter o Supabase.** SQL a sério, queries ricas, sincronização instantânea. Rejeitada pelo custo de
manutenção descrito acima e pelo risco do free tier adormecer — para uma app que pode passar um mês
sem ser aberta entre torneios.

**SQLite no telemóvel (`expo-sqlite`), com exportações periódicas.** Rápido e verdadeiramente offline,
e tentador. Rejeitada porque faz do telemóvel o único sítio onde os dados existem: um telemóvel
perdido leva o histórico todo. As exportações periódicas resolveriam isso, mas só se acontecerem —
e a alternativa escolhida faz a exportação acontecer sozinha, a cada alteração.

**SQLite commitado no repositório.** Junta o pior dos dois: binário, diffs inúteis, conflitos
irresolúveis.

**Um ficheiro único `data/events.json`.** Mais simples de escrever. Rejeitada porque cada match
reescreve o ficheiro inteiro, e o histórico do Git deixa de dizer o que mudou — que é metade da razão
para estar em Git.

## Consequências

**Fica fácil:** custo zero e nada que adormeça. Histórico completo de graça — dá para ver quando um
evento mudou e voltar atrás. Os dados sobrevivem à app: se o código for deitado fora amanhã, os
eventos continuam a ser ficheiros legíveis. Corrigir o nome de um adversário é abrir um ficheiro no
computador. Não há migrações para correr, só validação.

**Fica difícil:** não há queries. Filtrar, ordenar e calcular estatísticas acontece em memória, o que
é irrelevante para centenas de eventos e deixaria de ser para dezenas de milhares. As escritas são
commits, com latência de segundos em vez de milissegundos — daí o modelo otimista do ADR 0004.

**A vigiar:** o momento em que o `bundle.json` passe a ser grande de mais para se carregar de uma vez
no arranque. Com o volume previsto, isso são décadas.

**Saída de emergência:** os JSON importam-se para SQL sem perda. Os schemas já descrevem as tabelas —
o `data-model.md` mantém a correspondência.
