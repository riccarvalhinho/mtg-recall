# ADR 0010 — As preferências da app vivem no telemóvel, fora de `data/`

**Data:** 2026-09-13
**Estado:** Aceite

## Contexto

A app precisou da primeira preferência que não é um segredo nem um registo: qual a colecção de
terrenos básicos a usar nos decks que não dizem de onde são. Um Sealed diz — as cartas saem todas da
mesma caixa e a app deduz a colecção sozinha —, mas um deck de Modern feito de dez colecções não diz
nada. Na vida real os básicos desses decks são sempre os mesmos, os que estão na caixa de básicos, e
faz sentido escolhê-los uma vez.

Até aqui só havia dois sítios onde guardar coisas, e nenhum dos dois servia:

- **`data/`**, versionado em Git (ADR 0002), com schema validado em CI e escrita pela outbox
  (ADR 0004). É o registo: torneios, matches, decks, colecção.
- **`expo-secure-store`**, só para o token do GitHub (ADR 0005).

Uma preferência de aparência não é um registo nem um segredo, e faltava dizer onde vai.

## Decisão

As preferências da app vivem no **AsyncStorage do telemóvel**, em `services/preferences.ts`, sob
chaves `mtgrecall.preferences.*`. Não passam pela outbox, não têm schema, não aparecem em nenhum
commit e não fazem parte do bundle.

A fronteira é esta: **`data/` é o que aconteceu; as preferências são como se olha para isso.** Um
torneio jogado é um facto e tem de durar, ser versionado e poder ser restaurado noutro telemóvel. A
colecção de básicos preferida não é facto nenhum — é gosto, e muda quando se compra uma caixa nova.

Uma preferência ilegível — de uma versão anterior da app, ou corrompida — é tratada como preferência
ausente. A app abre à mesma: nada disto pode ficar entre o utilizador e o registo de um match
(regra 3, offline-first).

## Alternativas consideradas

**Um ficheiro `data/settings.json`, versionado como o resto.** Traria a preferência para um telemóvel
novo junto com o restauro, que é a vantagem real. Recusada pelo custo por mudança: um schema a manter
em CI, uma entrada na outbox e **um commit no repositório de cada vez que se muda de ideias sobre
uma arte**. O histórico de um registo de torneios ficaria salpicado de commits que não registam nada.

**Guardar dentro de cada deck, no próprio ficheiro.** Resolveria o restauro e até permitiria básicos
diferentes por deck. Recusada por duas razões: obrigava a repetir a mesma escolha em cada deck novo,
que é exactamente o trabalho que a preferência existe para evitar; e a app já tem a regra de não pôr
campos calculados nos ficheiros — a colecção dos básicos de um deck é derivada das cartas dele.

**`expo-secure-store`, como o token.** Recusada por ser a ferramenta errada: é armazenamento cifrado
para segredos, mais lento e com limites de tamanho apertados, e uma preferência de arte não é
segredo nenhum.

## Consequências

**Fica fácil:** acrescentar preferências. Uma chave nova em `services/preferences.ts`, sem tocar em
schemas, sem tocar no CI, sem commits. E o registo em `data/` continua a ser só registo, que é o que
o torna legível como histórico.

**Fica difícil:** um telemóvel novo, ou um restauro a partir do GitHub, começa sem preferências
nenhumas e é preciso escolher outra vez. O preço é escolher uma vez por telemóvel — contra um commit
por cada mudança de ideias, que era o preço da outra alternativa.

**A vigiar:** o dia em que as preferências deixarem de ser duas ou três, ou em que perder uma custar
mais do que um minuto a repor. Aí vale a pena um `data/settings.json`, escrito de propósito com
pouca frequência, e não a lista a crescer em silêncio no AsyncStorage.
