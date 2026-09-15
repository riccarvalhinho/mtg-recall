# ADR 0013 — As cores de um evento são registo próprio, não derivadas do deck

**Data:** 2026-09-15
**Estado:** Aceite

## Contexto

O campo `deckColors` do evento estava marcado como **legado**: escrevia-se antes da Fase 2, quando
não havia ficheiros de deck, e desde que passou a haver `deckId` nada de novo o escreve. A intenção
era que as cores viessem do deck ligado.

Nunca vieram. Três sítios leem as cores de um evento, e os três leem `event.deckColors` directamente,
sem cair para o deck:

- `components/EventCard.tsx` — os pips na lista de eventos
- `app/(tabs)/index.tsx` — os pips do cartão-herói da Home
- `app/(tabs)/stats.tsx`, em `getColorStats` — `events.filter(e => e.deckColors?.main?.includes(color))`

Como nada escreve o campo, **um evento criado pela app não tem pips em lado nenhum e não conta para a
estatística por cor.** A secção "por cor" das Stats está, para dados novos, vazia por construção.
Não é um écran por acabar: é um campo que foi declarado morto sem que o seu substituto existisse.

A isso juntou-se um segundo facto, vindo do arquivo de torneios antigos que falta carregar. Uma parte
desses registos tem as cores e mais nada — sem decklist, sem adversários, muitas vezes sem sequer o
nome do deck. Não há deck de onde derivar cor nenhuma, e não vai haver.

E mesmo quando há deck, derivar não chega. **A lista de cartas não diz o que foi splash.** Um deck
com uma carta vermelha entre quarenta cartas azuis e brancas tanto pode ter sido um Azorius com um
splash de vermelho como um Jeskai a sério, e quem jogou o torneio sabe qual — a contagem de símbolos
não sabe. A distinção entre `main` e `splash` é uma leitura de quem esteve lá, não uma propriedade
da decklist.

## Decisão

**`deckColors` deixa de ser legado e passa a ser o registo das cores com que se jogou aquele
torneio.** Escreve-se à mão, no Event Detail, com o mesmo selector de três estados que o deck e o
match já usam (`domain/manaSelection.ts`: um toque é principal, dois é splash, três limpa).

A precedência, onde as cores se leem, é esta e está num sítio só — `domain/eventColors.ts`:

1. as cores escritas à mão no evento, se existirem;
2. senão, as cores do deck ligado;
3. senão, nada — e quem desenha não mostra pips, em vez de mostrar cinco pips apagados.

O degrau 2 é o que corrige o bug: um evento com deck ligado passa a ter pips e a contar para as
estatísticas por cor sem ninguém escrever nada. O degrau 1 é o que dá a última palavra a quem jogou,
que é o ponto deste ADR — **o deck responde por omissão, nunca por cima**.

O campo continua opcional. Um torneio de que não se lembra a cor é um torneio sem cores registadas,
como é um torneio sem adversários: ausente é ausente, e nunca uma cor inventada.

## Alternativas consideradas

**Derivar sempre do deck ligado e não deixar escrever nada.** É a intenção original, e é menos um
campo a manter. Recusada por duas razões independentes, e qualquer uma chegava: não serve os
torneios retroactivos, que não têm deck nenhum e nunca terão; e não sabe distinguir splash de
principal, que é informação que só existe na cabeça de quem jogou. Uma derivação que acerta em
metade dos casos e inventa na outra metade é pior do que um campo vazio, porque não se vê qual é
qual.

**Guardar as cores no deck e ligar um deck de casca a cada evento retroactivo.** Funcionaria — o
schema do deck já diz que `cards` é opcional de propósito. Recusada porque enche o tab Decks de
dezenas de fichas sem cartas, sem arte e sem uso, só para carregar duas ou três cores; e porque um
deck que se reusa em cinco torneios tem uma linha de cores só, quando o splash pode ter mudado de
torneio para torneio. As cores são do torneio, não do deck.

**Um campo novo, `colors`, deixando `deckColors` morto.** Mais honesto no nome — o que se regista são
as cores com que se jogou, e não necessariamente "as cores do deck". Recusada pelo custo: obrigava a
migrar os eventos antigos ou a ler os dois campos para sempre, e o que o campo antigo guarda é
exactamente o que o campo novo guardaria. Fica o nome imperfeito e uma descrição de schema que o
explica.

## Consequências

**Fica fácil:** um torneio retroactivo regista-se com as cores e mais nada, que é o mínimo de que
esses registos são feitos. As estatísticas por cor voltam a ter dados — tanto dos eventos antigos
como, pelo degrau 2, de todos os que já foram criados com deck ligado. Nenhum écran passa a precisar
dos decks para desenhar pips: pede-os ao `eventColors` e segue.

**Fica difícil:** passa a haver dois sítios que sabem cores — o evento e o deck — e eles podem
divergir. É deliberado (a divergência é a informação: o splash daquele dia), mas quer dizer que
trocar de deck num evento **não** actualiza as cores escritas à mão, e ninguém avisa. Quem escreveu
as cores fica responsável por elas.

**A vigiar:** se ao fim de um ano as cores escritas à mão forem sempre iguais às do deck ligado, o
degrau 1 não estava a ganhar nada e a derivação pura bastava. O sinal contrário — cores que diferem
do deck — é a prova de que valeu a pena.
