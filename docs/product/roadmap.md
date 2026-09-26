# MTG Recall — Roadmap

> O que vem a seguir e por que ordem. Actualizar quando uma fase fechar ou quando a ordem mudar.
> Última actualização: 2026-09-14

A app é de utilizador único (ADR 0006) e os dados são ficheiros no repositório (ADR 0002). Tudo o que
está aqui assume isso.

---

## Onde estamos

As Fases 0 a 4 estão **implementadas** e a Fase 5 só tem por fazer a decklist por fotografia.
`npm run check` passa: dados válidos, typecheck limpo, testes verdes.

O que falta não é código — são quatro passos manuais que dependem das contas do autor, e usar a app
a sério uma vez. **`data/events/` está vazio**: enquanto não houver lá um torneio verdadeiro, a
cadeia telemóvel → commit → bundle → restauro não está provada ponta a ponta, e é essa a única coisa
que interessa a seguir.

---

## O que falta mesmo

### Passos manuais — só o autor os pode dar

O guia está em `docs/ops/telemovel-setup.md`. Não há código a escrever em nenhum destes.

- [ ] Ligar o GitHub Pages — Settings → Pages → Source: GitHub Actions
- [ ] Guardar a keystore nos segredos (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`)
- [ ] Correr o workflow **Gerar APK (Gradle)** e instalar a partir da Release
- [ ] Criar o token fine-grained e colá-lo no écran de Settings
- [ ] Registar o primeiro torneio a sério e confirmar que aparece um commit

**Pronto quando:** um FNM inteiro se regista em modo de avião e, à saída da loja, aparece um commit
com o evento completo.

### Registos retroactivos — escritos, por usar no arquivo a sério

Feito (ADR 0013): as cores do evento escrevem-se à mão no Event Detail e mandam sobre as do deck
ligado, e o **Quick record** transforma um "6-2" em rondas nuas numa folha só. Um torneio antigo
passa a caber na app com o que dele existe — o nome, a data, as cores, o recorde e a posição —, sem
decklist, sem adversários e sem detalhe por ronda.

Por provar: carregar o arquivo a sério. É aí que se vê se o Quick record tem os toques certos e se
a precedência das cores (evento → deck → nada) dá sempre a resposta esperada. Ver também a **Q16**:
se um splash deve contar para a estatística daquela cor, decidido por omissão a favor de não.

De caminho, isto corrigiu um bug que ninguém tinha visto: os três écrans que desenham cores liam
`event.deckColors` directamente — um campo que nada de novo escrevia — e por isso a secção por cor
das Stats estava **vazia para todos os eventos criados pela app**. Agora passam por
`domain/eventColors.ts`.

### Classificação por posição — escrita, por usar num torneio

O `rank` (`"Top 8"`) deu lugar a `placement` + `playersCount`, e os escalões passaram a
calcular-se — ADR 0012. Os dois números são um par obrigatório desde a Q15, decidida na revisão de
2026-09-15. Falta o mesmo que falta a tudo o resto: um torneio a sério.

- [ ] Fechar um torneio pelos dois campos novos e confirmar o escalão que a folha propõe
- [ ] Confirmar que o botão de concluir trava com só um dos números preenchido
- [ ] Confirmar que `placement` e `playersCount` aparecem no ficheiro do evento
- [ ] Corrigir a posição em *Event details* depois do torneio fechado e ver o commit
- [ ] Ver a pirâmide e o gráfico com mais do que um evento lá dentro

### Contador de vida — escrito, por provar numa mesa

Feito e testado (`domain/lifeCounter.ts`, 39 testes), mas nunca usado num torneio. O que falta é
usá-lo entre rondas e ver se a disposição aguenta — Q13. Ver ADR 0011 para as decisões.

- [ ] Contar uma ronda a sério com o telemóvel pousado entre os dois jogadores
- [ ] Confirmar que o ecrã fica aceso a ronda inteira (`expo-keep-awake` nunca correu num APK)
- [ ] Confirmar que a vida aparece no ficheiro do evento depois de registar a ronda

### Relatório de evento — escrito, por partilhar a sério

Feito (ADR 0014): o botão de partilhar do Event Detail gera o relatório do torneio em HTML, com as
imagens lá dentro, e abre a folha de partilha. A página está testada contra o Reality Fracture
(`domain/eventReport.test.ts`); o que toca no telemóvel — cache das imagens, ficheiro, partilha —
não corre fora de um APK.

- [ ] Partilhar um evento para o Telegram e confirmar que o ficheiro chega com as imagens
- [ ] Abrir o ficheiro num Android **e num iPhone**: as cartas abrem ao toque? as rondas abrem?
- [ ] Exportar em modo de avião, com o deck já aberto antes, e ver o aviso das imagens que faltam
- [ ] Ver o tamanho do ficheiro de um Commander, se algum dia houver um

### Por confirmar no telemóvel

Coisas escritas e testadas contra payloads sintéticos, mas nunca corridas contra o mundo real — o
proxy do ambiente de desenvolvimento recusa ligações à Scryfall.

- [ ] O primeiro pedido verdadeiro a `GET /sets` (selector de set do evento)
- [ ] O primeiro pedido verdadeiro a `GET /cards/search` (procura de cartas)
- [ ] A primeira execução do workflow `refresh-prices.yml` com colecção a sério
- [ ] O primeiro build com Gradle — o `expo prebuild` e a injecção da assinatura
      (`android.injected.signing.*`) nunca correram neste projecto

---

## Fase 0 — Repurpose ✅

Tirar o Supabase do caminho e pôr a app a escrever no repositório.

- [x] Decisões em `docs/adr/` (0001 a 0007)
- [x] Schemas em `data/schema/` e `npm run validate` em CI
- [x] `bundle.json` gerado e publicado em GitHub Pages
- [x] Camada de dados: `services/github.ts`, `domain/outbox.ts`, `services/repoFiles.ts`, `services/localStore.ts`
- [x] Store local-first; Supabase fora do código e das dependências
- [x] Écran de Settings: token, estado da sincronização, sincronizar agora, restaurar
- [x] O restauro deixou de ser desfeito pela fila que não limpava (Q7)

## Fase 1 — Fechar o registo de torneio ✅

- [x] Games por match (2-0, 2-1) — o resultado passa a ser derivado deles
- [x] `wentFirst` por match e por game, com três estados
- [x] Editar um match já registado
- [x] Set do evento a partir da Scryfall API, com cache offline
- [x] Histórico de eventos com procura

## Fase 2 — Decks ✅

- [x] `data/schema/deck.schema.json` e `data/decks/<slug>.json`
- [x] `deckId` no evento, mantendo `deckName`/`deckColors` para os eventos antigos
- [x] Tab Decks, editor e écran de detalhe
- [x] Win rate por deck — a pergunta que justificava a fase
- [x] Deck Analyser: curva de mana, distribuição de cores, contagem por tipo
- [x] Os decks de **Limited** numa secção própria em baixo (`isEventDeck`), para um Sealed por mês
      não soterrar os decks que se afinam durante meses
- [x] **Como correu o torneio de cada deck de Limited**, numa etiqueta ao lado do formato:
      `1st Place`, `Top 8`, ou a posição nua quando escalão não houve. O win rate diz com que deck
      se ganharam mais matches, não diz com qual se chegou mais longe — `deckStanding`, em
      `domain/deck.ts`

## Fase 3 — Cartas e colecção ✅

- [x] Card Search sobre a Scryfall API, com cache local e escrita à mão como recurso
- [x] Edição da decklist: quantidades, main/sideboard
- [x] `data/collection/cards.json` — colecção com quantidade, condição e foil
- [x] Estatísticas por adversário, com nemesis e melhor matchup
- [x] Thumbnail do deck a partir de uma carta escolhida — feito na Fase 5, com o `CardArtPicker`

## Fase 4 — Valor da colecção ✅

- [x] ADR 0007 — os preços vêm da Scryfall e não da Cardmarket API
- [x] `tools/refresh-prices.mts` e o workflow `refresh-prices.yml`, semanal
- [x] Evolução do valor ao longo do tempo, append-only

## Fase 5 — Ver e capturar cartas

As duas coisas que faziam do deck uma lista de texto: **vê-lo** e **enchê-lo sem o escrever**. A
primeira está feita; a segunda depende da Q10, que só uma fotografia verdadeira responde.

### Imagens de cartas

**Feito.** A decklist era texto puro — quantidade, nome, custo de mana — e o
`CardThumbnailPlaceholder` era um rectângulo cinzento em todo o lado. Hoje há arte na decklist, nos
cards de evento e no Event Detail, e o placeholder ficou a ser o que devia ser desde o início: o
recuo para quando não há URL ou a imagem falha.

A referência visual está em `design/referencia-manabox/` — fotogramas do ManaBox que o autor
mandou. **A Q9 está respondida**: não é uma galeria de cartas inteiras, é uma **lista com o recorte
da arte** à esquerda de cada linha. Muda o que é preciso guardar: a Scryfall serve `art_crop`, que é
mais pequeno que a carta inteira e é o que esta lista precisa.

- [x] Recorte da arte (`art_crop`) em cada linha da decklist
- [x] Agrupar a lista por tipo, com contagem por grupo (Creatures 14, Instants 7…) — o
      `typeCounts` do `domain/deck.ts` já sabe fazer esta divisão
- [x] Alternar entre lista com arte e lista compacta (pílula de quantidade + nome + custo)
- [x] Painel de basic lands com contador por cor, à parte da procura — **pedido explícito**, porque
      procurar basics na barra uma a uma é absurdo
- [x] Escolher a carta que ilustra o deck e o evento — `components/CardArtPicker.tsx`, no editor de
      deck e em "Event details". Os campos estavam nos schemas desde a Fase 2 sem nada que os
      escrevesse; o que faltava era só a interface
- [x] Prefetch explícito **só dos thumbnails**, para esses ficarem garantidos offline —
      `services/imagePrefetch.ts`, em lotes de quatro, no arranque e depois de um restauro

### Estatísticas do deck — o que falta e o que já lá está

O `deck/[id].tsx` já mostra curva de mana, distribuição de cores e contagem por tipo, calculados em
`domain/deck.ts`. A referência acrescenta três coisas, por ordem de custo:

- [x] **Subtipos** (Wizard 5, Druid 4, Elf 2…), por `subtypeCounts`. Era o barato dos três: o
      `typeLine` já estava guardado e o `primaryType` já partia a linha no travessão — os subtipos
      são o lado direito, que antes se deitava fora
- ~~**Valor total do deck**~~ — **fora de âmbito por decisão do autor**: "tudo o que é sobre
  valores das cartas e dos decks é dispensável neste scope". O valor da colecção fica como está,
  porque já existe; o dos decks não se faz
- ~~**Produção de mana**~~ — fora de âmbito pela mesma razão, e era a mais cara das três: obrigava a
  guardar o `produced_mana` da Scryfall, ou seja a mexer no schema do deck

**O que não dá para copiar:** a referência mostra preços LOW / AVG / TREND, que são escalões da
Cardmarket. A Scryfall dá um número só (ADR 0007). Fica um valor, não três.

**Fora de âmbito por agora:** tokens gerados pelo deck (precisa das relações `all_parts` da
Scryfall), notas com formatação, e o "Test deck".

**Decidido sobre a cache:** usar `expo-image` e deixar a cache em disco dela funcionar. Desligá-la
para a galeria seria escrever código a mais para ter menos — o barato é forçar o download dos
thumbnails e deixar o resto ficar em cache sozinho, à medida que os decks forem abertos. Resultado
prático: thumbnails sempre disponíveis sem rede, galeria a precisar de rede na primeira vez e não nas
seguintes.

Assume-se que **a loja tem rede** — mas a app não passa a depender disso: sem rede, volta ao
placeholder, que é honesto e já existe.

### Decklist por fotografia

Espalhar as cartas na mesa com os títulos à vista, em várias colunas, fotografar, e sair uma
decklist. A decisão está no **ADR 0009**: OCR local com ML Kit, sem serviço de visão e sem conta.

**A lógica toda já está escrita e testada** — `domain/ocrDecklist.ts`. O ML Kit é código nativo,
mas nada do que decide vive lá dentro: o que ele devolve são blocos de texto com caixas
delimitadoras, e transformá-los numa lista é trabalho puro, que se testa sem telemóvel e sem
fotografia. Ficou feito primeiro de propósito: é a parte que se pode provar antes de haver APK.

- [x] Reconstruir colunas a partir das caixas delimitadoras (`columnsOf`, com o limiar relativo à
      largura dos blocos — a mesma mesa de mais perto ou de mais longe dá o mesmo resultado)
- [x] **Nada é descartado em silêncio.** Houve um filtro pelo tamanho da letra, para o texto de
      regras da carta de baixo não virar cartas ("sacrifice a Mountain"). Saiu: a montagem da mesa
      resolve isso na origem, e os dois erros não custam o mesmo — uma linha a mais vê-se na
      confirmação e apaga-se, uma carta comida pelo filtro não aparece em lado nenhum (ADR 0009)
- [x] `stripManaCost` — o custo está na mesma barra do nome, portanto tapar a carta de baixo não o
      esconde. Em "Opt 1" dois caracteres a mais eram mais erros do que os tolerados
- [x] Comparar nomes com tolerância a erros (`matchCardName`, distância de edição com limite
      proporcional ao comprimento — três erros num nome longo é a mesma carta, um erro em "Opt" é
      outra)
- [x] Contar repetições como quantidade — quatro cópias espalhadas são quatro leituras
- [x] Juntar porções (`mergeBatches`). Um Limited cabe numa fotografia — 22 ou 23 cartas fora os
      terrenos; um Commander fotografa-se em três ou quatro porções de 20 a 30. O mesmo nome em
      duas porções soma **e fica marcado** (`crossBatch`): ou são duas cópias, ou as porções
      sobrepuseram-se, e quem tem a mesa à frente é que sabe
- [x] O que não se reconhece aparece em `unmatched` em vez de desaparecer
- [x] Integrar o ML Kit Text Recognition — `services/ocr.ts`. Usa as **linhas** e não os blocos: o
      ML Kit agrupa em bloco o que lhe parece um parágrafo, e duas barras de título encostadas
      caíam no mesmo, com o texto colado e uma caixa que servia as duas
- [x] Écran de captura com o **aviso da montagem**, porções acumuladas (repetir ou deitar fora a
      última) e confirmação — `app/deck-scan.tsx`. Os básicos não vão na fotografia: entram pelo
      painel de contadores
- [x] Entrega ao editor de deck sem gravar nada pelo caminho (`store/useScanStore.ts`), a somar às
      cartas que já lá estejam
- [x] **Gerar o APK com isto lá dentro** — build 3
- [x] Confirmar que o módulo funciona com a **nova arquitectura** do React Native: funciona, pela
      camada de compatibilidade
- [x] Validar contra fotografias reais — **feito, e passou**: o ML Kit leu todos os nomes de um
      deck de Limited montado como manda o ADR. O que falhou foi o catálogo exigir que a carta já
      fosse conhecida; passou a aceitar a leitura como nome

A fotografia é processada em memória e **nunca guardada nem commitada**.

---

## Fase 6 — Insights (exploratória, sem data)

> Ideia do autor, registada para não se perder. **Não está decidida nem orçamentada** — está aqui
> para que quem a retomar não tenha de a redescobrir, e sobretudo para não repetir as perguntas que
> já se sabe que ela levanta.

Um separador que passe pelo arquivo todo — cores escolhidas, adversários, arquétipos, resultados, e
as cartas que foram parar aos decks — e devolva conselho em vez de números:

- o que tenho priorizado mais do que devia;
- como é o meta de cada set, e se joguei do lado errado dele;
- cartas que deixei passar num draft ou num sealed por não parecerem grandes coisa;
- o que se tira do meu deck building e dos meus resultados;
- e que **melhore à medida que o arquivo cresce** — mais eventos, mais notas de match.

### O que já está a favor

Os dados estão todos em JSON e são poucos: o arquivo inteiro de anos cabe num prompt sem esforço.
Não é preciso índice, nem base de dados, nem recorte. Isso torna a parte técnica invulgarmente
simples — o difícil está noutro sítio.

### As três perguntas que decidem isto

**1. Onde corre o modelo?** É a mesma pergunta do ADR 0009, que já a respondeu duas vezes contra a
nuvem — mas aqui o cálculo muda. Insights não se consultam entre rondas numa loja sem sinal:
consultam-se sentado, com tempo. Uma funcionalidade que **só funciona com rede** não fere o
offline-first, desde que o resto continue a funcionar sem ela.

A saída que encaixa na arquitectura que já existe é um **workflow agendado**, como o dos preços
(ADR 0007): corre no GitHub Actions, lê `data/`, chama o modelo, escreve `data/insights.json`, e a
app lê-o do bundle como lê tudo o resto. A chave vive nos segredos do repositório — **não no
telemóvel**, e sem conta nenhuma no dispositivo. Ver Q12.

**2. De onde vem o meta?** Isto não está nos meus dados. Ou sai do conhecimento do próprio modelo —
que tem data de corte e inventa com confiança — ou de uma fonte a sério (o 17Lands publica dados de
Limited). É o item mais fraco da lista e o primeiro a cortar se for preciso cortar.

**3. Que cartas é que eu deixei passar?** Para dizer que uma escolha foi má é preciso saber **o que
estava disponível**, e hoje só se guarda o deck — não o pool do sealed nem os picks do draft.
Aconselhar picks obriga a registar o que se recusou, que é um custo de registo novo e num sítio
onde há pressa. Talvez só valha para o sealed, onde o pool é estável e se fotografa de uma vez.

### A regra que isto não pode quebrar

**Com meia dúzia de eventos, qualquer padrão é ruído.** Esta app já recusa esse erro noutro sítio —
a nemesis exige três encontros, e um deck por jogar diz "unplayed" em vez de 0%. Um écran de
insights que a partir de quatro matches declare que "jogas mal contra azul" é pior do que não
existir: dá autoridade a acaso. Se isto se fizer, tem de dizer com que confiança fala, e calar-se
enquanto não tiver material.

---

## Ícone da app

Feito: duas cartas douradas sobre o fundo escuro da app, saídas de três direcções exploradas em
canvas. O desenho, os originais em SVG e o que ficou em aberto estão em `design/icon/README.md`; o
brief que lhe deu origem em `design/icon-brief.md`.

- [x] Desenhar o ícone a partir do brief — ganhou o *ex-libris*, sem o anel
- [x] `icon.png`, `adaptive-icon.png`, `monochrome-icon.png`, `splash-icon.png` e `favicon.png`,
      exportados dos SVG por `design/icon/export.py`, que recusa exportar um desenho que passe da
      zona segura
- [x] `monochromeImage` declarado no `app.json`, e o fundo do arranque alinhado com o da app
- [ ] **Gerar APK novo** — o ícone é nativo e não entra por actualização

---

## Dívida conhecida

Coisas que ficaram por fazer de propósito, com a razão à frente. Não são bugs — são decisões
adiadas, e estão aqui para não se perderem. **Neste momento a lista está vazia:** tudo o que aqui
estava foi varrido. Fica o registo do que era e de como ficou, porque saber
que uma coisa foi decidida vale tanto como saber que está por decidir:

- ~~A entrada da colecção só aparece na Home depois do primeiro evento~~ — o estado vazio da Home
  tem agora "or start with your collection".
- ~~Uma carta acrescentada só pelo nome nunca tem preço~~ — a linha "no printing details" passou a
  ser o botão que abre a procura e aponta a carta a uma impressão, guardando quantidade, condição,
  foil e idioma.
- ~~Um adversário deixado órfão por uma edição não é removido da taxonomia~~ — `pruneOpponents`
  varre-os ao editar um match, ao apagar uma ronda e ao apagar um evento.
- ~~Não há écran de detalhe por adversário~~ — `app/opponent/[id].tsx`. A lista das Stats deixou de
  expandir em acordeão e passa a navegar.
- ~~O `TrendChart` das Stats ainda formata datas com `new Date`~~ — `domain/dates.ts`, com testes
  que fixam `TZ=America/Los_Angeles` para o bug não voltar em silêncio.
- ~~O `setCode` de um evento não se edita depois de criado~~ — está em "Event details", no Event
  Detail, e só aparece em Limited.

---

## Fora do roadmap

Contas de utilizador, perfis, partilha, ligação entre jogadores e qualquer camada social. Ver ADR
0006. Se um dia houver vontade de mostrar as estatísticas a alguém, a resposta é uma página de
leitura em GitHub Pages, não contas.
