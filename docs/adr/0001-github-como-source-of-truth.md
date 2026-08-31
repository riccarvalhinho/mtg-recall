# ADR 0001 — O GitHub é a source of truth do MTG Recall

**Data:** 2026-08-31
**Estado:** Aceite

## Contexto

Até aqui o projecto tinha o código no GitHub e os dados numa base de dados Supabase. O planeamento
vivia em `CLAUDE.md`, `project-overview.md` e `data-model.md` — bem — mas as decisões estruturais não
estavam registadas em lado nenhum: existiam na cabeça de quem as tomou e nas mensagens de commit.

Ao mesmo tempo, o desenvolvimento é feito em grande parte com sessões de agente, que precisam de
carregar o contexto do produto sem depender de alguém o colar num chat.

O projecto irmão Ratatouille resolveu isto com uma regra só: se uma decisão não está no repositório,
não foi tomada.

## Decisão

Todo o MTG Recall vive no repositório: código, dados dos eventos, decisões, especificações e
documentação de operação.

- `docs/adr/` — decisões estruturais, uma por ficheiro, imutáveis depois de aceites
- `docs/product/` — roadmap e questões em aberto
- `docs/ops/` — como operar (instalar no telemóvel, gerar o token)
- `design/` — o handoff visual e os prints de referência
- `data/` — os eventos, matches e taxonomias, em JSON versionado (ADR 0002)
- `CLAUDE.md` — o contexto que cada sessão de agente carrega automaticamente

Uma decisão nova é um ADR. Uma alteração ao modelo de dados começa por um schema.

## Alternativas consideradas

**Manter as decisões só no `project-overview.md`.** É o estado actual e tem um problema conhecido: um
ficheiro de estado é reescrito a cada sessão, portanto o "porquê" de uma decisão desaparece na
primeira vez que alguém actualiza a linha onde ele estava. Um ADR é imutável de propósito.

**Notion ou um documento à parte.** Segunda fonte, atrás de uma API e de uma subscrição — o problema
que este projecto inteiro está a tentar deixar para trás.

## Consequências

**Fica fácil:** uma alteração ao produto e o código que a implementa entram no mesmo commit. Qualquer
sessão futura sabe porque é que as coisas estão como estão sem perguntar.

**Fica difícil:** escrever um ADR custa vinte minutos que apetece poupar quando a decisão parece
óbvia. As decisões óbvias são precisamente as que ninguém se lembra de justificar seis meses depois.

**A vigiar:** documentação que apodrece. Se um commit muda o que a app faz e não toca em `docs/`,
alguma coisa está errada.
