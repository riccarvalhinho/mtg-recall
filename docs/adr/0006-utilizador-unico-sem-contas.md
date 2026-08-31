# ADR 0006 — Um utilizador só: sem contas, sem partilha, sem camada social

**Data:** 2026-08-31
**Estado:** Aceite

## Contexto

O plano original tinha contas de utilizador (Fase 2), adversários ligados ao perfil de quem também
tivesse a app (Fase 4) e uma camada social. O MVP já trazia parte da estrutura para lá chegar:
Supabase Anon Auth, `user_id` em todas as tabelas, Row Level Security em todas as políticas.

Nada disso chegou a ser usado por mais do que uma pessoa, e a estrutura cobrou o preço à mesma: cada
funcionalidade nova passava a ter uma pergunta de segurança antes da pergunta do produto. O resultado
prático foi a app não ficar pronta para aquilo que era o objectivo primário — um registo pessoal de
torneios.

## Decisão

O MTG Recall é uma app de utilizador único. Não há contas, não há autenticação, não há partilha nem
distribuição a terceiros.

Consequências directas no código e nos dados:

- Sai o Supabase Anon Auth e sai o `user_id` de todas as entidades
- Não há RLS a escrever nem políticas a manter
- Os adversários são nomes num ficheiro do próprio autor, sem qualquer ligação a perfis
- O que autentica a escrita é o token pessoal do ADR 0004, e o que ele protege é o repositório —
  não os dados uns dos outros

O que **não** muda: todas as funcionalidades de produto continuam no roadmap. Eventos, matches,
games, decks, win rates, estatísticas por cor e por adversário, colecção e preços. A app é a mesma;
só deixou de ser multi-utilizador.

## Alternativas consideradas

**Manter a autenticação anónima "por precaução", para o caso de um dia haver contas.** É o que estava
feito, e é o custo sem o benefício: paga-se a complexidade hoje por uma funcionalidade que pode nunca
existir. Se um dia existir, o ADR 0002 já descreve a saída para SQL.

**Utilizador único, mas com um modo de exportar para partilhar com amigos.** Tentador e prematuro. O
repositório é público (ADR 0005): partilhar já é mandar um link.

## Consequências

**Fica fácil:** cada funcionalidade nova é só produto. Não há sessões a expirar, não há login para
abrir a app — abre e está lá.

**Fica difícil:** dois telemóveis a escrever ao mesmo tempo passariam a perder alterações
(última-escrita-ganha, ADR 0004). É um telemóvel.

**A vigiar:** se aparecer mesmo vontade de partilhar estatísticas com o grupo de jogo, a resposta
provável é uma página de leitura em GitHub Pages sobre o `bundle.json` — não contas.
