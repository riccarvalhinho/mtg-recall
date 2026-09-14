# ADR 0011 — O contador de vida é efémero; o que fica no ficheiro é a vida de cada game

**Data:** 2026-09-14
**Estado:** Aceite

## Contexto

Entre rondas, a vida conta-se num dado, num bloco de papel ou numa app à parte. Contá-la na app que
já está aberta para registar o resultado evita o telemóvel a alternar entre duas coisas, e evita a
pergunta que aparece sempre no fim de uma ronda apertada: *foi 2-1 ou 2-0?*

A app já sabe registar um match game a game. `domain/match.ts` deriva o resultado dos games
(`resultFromGames`) porque o `tools/validate-data.mts` recusa um match cujo `result` não bata certo
com eles. Um contador de vida produz exactamente a mesma informação — quem ganhou cada game, e por
que ordem — e portanto não precisa de inventar um caminho novo até ao ficheiro: chega ao já existente.

Ficava por decidir uma coisa: o que é que sobra quando o jogo acaba. Um contador de vida gera muito
estado — totais a cada instante, a ordem dos toques, a partida a meio — e nada disso é registo de
torneio.

## Decisão

**O contador é uma ferramenta, não um registo.** Vive num écran próprio e entrega o que contou a
quem o chamou, pela mesma gaveta Zustand que o `deck-scan` usa para entregar cartas ao editor
(`store/useScanStore.ts`). Não escreve em `data/`, não passa pela outbox e não produz commits.

**Do jogo inteiro fica uma coisa só: a vida com que cada game acabou**, em `games[].life`, como
`{ "me": n, "opponent": n }`. É opcional: um game registado à mão não a tem, e ausente é ausente.
Não tem mínimo nem máximo — perde-se a menos de zero, e um `-3` é a verdade do que aconteceu.

**A `life` não entra em conta nenhuma.** Quem decide o resultado são os `games`, como já decidia; a
vida não aparece em nenhuma estatística e não é validada contra o resultado. Está lá para se poder
reler uma ronda daqui a um ano, que é o que a app tem por nome.

**Pela Home, sem evento, não se grava nada.** O contador aberto para uma partida casual é só um
contador: sai-se e não fica registo nenhum. O estado de uma partida a meio — para a app poder ser
fechada entre rondas — vive no AsyncStorage, como as preferências (ADR 0010), e não em `data/`.

**Com dois jogadores o ecrã parte-se ao meio, frente a frente, e isso é a disposição** — não uma de
duas. Aproveita o telemóvel inteiro, portanto não há escolha a oferecer e não se constrói um
selector para uma escolha que não existe.

## Alternativas consideradas

**Não guardar vida nenhuma.** Era a opção mais barata e mantinha `data/` sem um campo novo. Recusada
porque deitava fora a única coisa que o contador sabe e que o registo à mão nunca vai saber. Ter
ganho o terceiro game a 2 de vida é precisamente o tipo de coisa que uma app chamada Recall existe
para guardar.

**Guardar o rasto todo dos totais** — cada 20, 17, 14 por que o jogo passou. Recusada por três
razões: enche o ficheiro de um registo que ninguém vai ler linha a linha, obriga a um schema bastante
maior para um ganho difuso, e a ordem dos toques não é fiável — corrige-se um engano tocando ao
contrário, e o rasto passaria a guardar os enganos com a mesma dignidade que os ataques.

**O contador ser ele próprio o registo do match** — contar a vida e gravar a ronda no fim, sem passar
pelo formulário. É a versão com menos toques na mesa e continua a ser o destino provável. Recusada
por agora porque obrigava a reescrever o `match-registration` antes de o contador estar provado num
torneio a sério, e porque as cores do adversário não cabem numa folha que sobe no fim de um jogo.

**Meter o contador dentro do modal de registo**, como a secção dos games ou das notas. Recusada por
ser inutilizável na mesa: o modal é um formulário com scroll e teclado, os alvos seriam pequenos, não
haveria lado virado ao adversário, e um toque falhado faria scroll em vez de tirar vida.

**A vida por match e não por game.** Mais simples de gravar, mas não quer dizer nada: um match são
até cinco jogos e a vida do último não resume os outros.

## Consequências

**Fica fácil:** registar uma ronda contada no telemóvel sem escrever nada — os games chegam
preenchidos ao formulário e o resultado sai deles, pela regra que já existia. E uma partida casual
tem finalmente onde ser contada, sem sujar o registo de torneios.

**Fica difícil:** `data/schema/event.schema.json` ganhou um campo, e tudo o que lê ou escreve games
passou a ter de o conhecer. Mais: a vida vai ficar quase sempre ausente nos eventos antigos e
presente nos novos, e qualquer coisa que um dia queira mostrá-la tem de aguentar as duas hipóteses
sem fingir um zero.

**A vigiar:** duas coisas. Se, num FNM a sério, a metade virada ao contrário se ler mal com o
telemóvel pousado entre os dois — ou se a mesa estiver sempre demasiado cheia para ele lá ficar —,
a disposição está errada e a alternativa está desenhada em
`design/life-counter-canvas/DirectionB.dc.html`. E se a `life` continuar a não ser lida por nada
daqui a um ano, era para não ter sido guardada.
