# MTG Recall — Roadmap

> O que vem a seguir e por que ordem. Actualizar quando uma fase fechar ou quando a ordem mudar.
> Última actualização: 2026-09-12

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
- [ ] **Gerar o APK com isto lá dentro.** O ML Kit é nativo: não entra por actualização. Até lá o
      écran diz que falta, em vez de rebentar (`isAvailable()`)
- [ ] Confirmar que o módulo funciona com a **nova arquitectura** do React Native, que está ligada
      (`newArchEnabled`). É da antiga e conta com a camada de compatibilidade
- [ ] Validar contra fotografias reais — **Q10, e é o que decide se isto é viável à primeira**

A fotografia é processada em memória e **nunca guardada nem commitada**.

---

## Ícone da app

O ícone é o **placeholder do Expo** — três círculos cinzentos numa grelha. O brief está em
`design/icon-brief.md`, com as medidas, a zona segura do adaptive icon e onde os ficheiros entram.

- [ ] Desenhar o ícone (Claude Design ou outro), a partir do brief
- [ ] Substituir `assets/icon.png`, `adaptive-icon.png`, `monochrome-icon.png`, `splash-icon.png`
- [ ] Declarar o `monochromeImage` no `app.json` e gerar APK novo — o ícone é nativo

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
