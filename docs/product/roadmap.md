# MTG Recall — Roadmap

> O que vem a seguir e por que ordem. Actualizar quando uma fase fechar ou quando a ordem mudar.
> Última actualização: 2026-09-11

A app é de utilizador único (ADR 0006) e os dados são ficheiros no repositório (ADR 0002). Tudo o que
está aqui assume isso.

---

## Onde estamos

As Fases 0 a 4 estão **implementadas**. `npm run check` passa: dados válidos, typecheck limpo, 219
testes verdes.

O que falta não é código — são quatro passos manuais que dependem das contas do autor, e usar a app
a sério uma vez. **`data/events/` está vazio**: enquanto não houver lá um torneio verdadeiro, a
cadeia telemóvel → commit → bundle → restauro não está provada ponta a ponta, e é essa a única coisa
que interessa a seguir.

---

## O que falta mesmo

### Passos manuais — só o autor os pode dar

O guia está em `docs/ops/telemovel-setup.md`. Não há código a escrever em nenhum destes.

- [ ] Ligar o GitHub Pages — Settings → Pages → Source: GitHub Actions
- [ ] `eas init` e o primeiro `eas build --profile preview --platform android`
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
- [ ] Thumbnail do deck a partir de uma carta escolhida (`thumbnailCardId` está no schema, falta a
      interface para o escolher)

## Fase 4 — Valor da colecção ✅

- [x] ADR 0007 — os preços vêm da Scryfall e não da Cardmarket API
- [x] `tools/refresh-prices.mts` e o workflow `refresh-prices.yml`, semanal
- [x] Evolução do valor ao longo do tempo, append-only

---

## Dívida conhecida

Coisas que ficaram por fazer de propósito, com a razão à frente. Não são bugs — são decisões
adiadas, e estão aqui para não se perderem.

- **A entrada da colecção só aparece na Home depois do primeiro evento.** Quem queira montar a
  colecção antes do primeiro torneio não tem por onde lá chegar.
- **Uma carta acrescentada só pelo nome nunca tem preço.** Sem a impressão concreta não se sabe de
  que carta se está a falar (ADR 0007). Falta uma forma de, mais tarde, ligar uma carta escrita à
  mão a uma impressão da Scryfall.
- **Um adversário deixado órfão por uma edição não é removido da taxonomia.** Corrigir o nome de um
  adversário num match deixa a entrada antiga em `opponents.json`. É barato e não parte nada, mas
  suja a lista com o tempo.
- **Não há écran de detalhe por adversário.** O head-to-head vive expandido dentro da lista das
  Stats. `headToHead` e `opponentRecord` já servem um `opponent/[id]` se um dia valer a pena.
- **O `TrendChart` das Stats ainda formata datas com `new Date`**, que interpreta `2026-02-14` em
  UTC e num fuso negativo dá o dia anterior. O resto do écran já usa `split('-')`.
- **O `setCode` de um evento não se edita depois de criado**, e não aparece no Event Detail.

---

## Fora do roadmap

Contas de utilizador, perfis, partilha, ligação entre jogadores e qualquer camada social. Ver ADR
0006. Se um dia houver vontade de mostrar as estatísticas a alguém, a resposta é uma página de
leitura em GitHub Pages, não contas.
