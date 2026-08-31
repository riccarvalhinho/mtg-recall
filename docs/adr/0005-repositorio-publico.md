# ADR 0005 — O repositório é público

**Data:** 2026-08-31
**Estado:** Aceite

## Contexto

Do ADR 0002, os dados dos eventos vivem no repositório. Isso transforma a visibilidade do
repositório numa decisão sobre privacidade, e não só sobre código.

Há também uma consequência prática: o GitHub Pages só é gratuito em repositórios públicos, e o ADR
0004 usa o Pages para servir o `bundle.json` que a app lê ao instalar ou restaurar.

O que fica visível: nomes de eventos, datas, locais, cores dos decks, resultados, e os nomes dos
adversários registados.

## Decisão

O repositório é público.

Os nomes dos adversários são registados como o autor os escreve. Se um dia isso incomodar, a saída
está preparada pelo ADR 0002: os adversários já são referências (`data/taxonomies/opponents.json`), o
que permite guardar alcunhas nesse ficheiro sem tocar em nenhum evento.

## Alternativas consideradas

**Repositório privado.** Esconde os dados e custa o Pages gratuito, o que obrigaria a app a ler
sempre pela API autenticada — mais complexidade e um limite de rate para resolver um problema que,
para resultados de torneios amadores, é pequeno.

**Repositório privado com um host estático à parte.** Reintroduz um serviço externo. Contra o ADR 0002.

## Consequências

**Fica fácil:** Pages gratuito, `raw.githubusercontent.com` acessível sem token, e as ferramentas
comunitárias de GitHub funcionam todas.

**Fica difícil:** tudo o que for commitado é público e fica no histórico mesmo depois de apagado.
Isto vale sobretudo para o **token**: um token commitado por engano tem de ser revogado, não
apagado. Por isso vive só no `expo-secure-store` do telemóvel e o `.gitignore` cobre `.env`.

**A vigiar:** o dia em que um adversário peça para não aparecer. A resposta é a alcunha em
`opponents.json`, não tornar o repositório privado.
