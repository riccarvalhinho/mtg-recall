# MTG Recall — Roadmap

> O que vem a seguir e por que ordem. Actualizar quando uma fase fechar ou quando a ordem mudar.
> Última actualização: 2026-09-11

A app é de utilizador único (ADR 0006) e os dados são ficheiros no repositório (ADR 0002). Tudo o que
está aqui assume isso.

---

## Onde estamos

A reestruturação está **feita no código**. O Supabase saiu do projecto e das dependências, a app
escreve ficheiros JSON no repositório por outbox, os schemas são validados em CI e o écran de
Settings liga o telemóvel ao GitHub. `npm run check` passa: dados válidos, typecheck limpo, 46 testes
verdes.

O que falta para a app ser **usada** não é arquitectura — é uma correcção no restauro e quatro passos
manuais que só o autor pode dar, porque dependem das contas dele.

`data/events/` está vazio. Enquanto não houver lá um torneio a sério, nada disto está provado
ponta a ponta.

---

## Fase 0 — Repurpose (quase fechada)

Tirar o Supabase do caminho e pôr a app a escrever no repositório. Nenhuma funcionalidade nova; o
objectivo é ficar com uma app que se usa a sério num torneio, instalada no telemóvel.

### Código — feito

- [x] Decisões registadas em `docs/adr/` (0001 a 0006)
- [x] `data-model.md` reescrito para ficheiros
- [x] Schemas em `data/schema/` e `npm run validate` a correr em CI
- [x] `bundle.json` gerado e publicado em GitHub Pages
- [x] Camada de dados: `services/github.ts`, `domain/outbox.ts`, `services/repoFiles.ts`, `services/localStore.ts`
- [x] Store local-first; Supabase removido do código e das dependências
- [x] Écran de Settings: token, estado da sincronização, sincronizar agora, puxar do GitHub

### Código — a corrigir antes do primeiro torneio

- [ ] **O restauro não descarta a outbox.** O modal avisa que as alterações por enviar "will be
      lost", mas `localStore.replaceAll` só limpa as chaves `mtgrecall.file:*` e `mtgrecall.files` —
      a fila vive em `mtgrecall.outbox` e sobrevive ao restauro. O worker envia-a a seguir, por cima
      do que acabou de ser restaurado. O telemóvel e o GitHub ficam a dizer coisas diferentes, que é
      exactamente o que o restauro existia para resolver. Ver Q7 em `open-questions.md`: ou a fila é
      descartada (e o aviso passa a ser verdade), ou o restauro esvazia-a primeiro e só depois puxa.

### Passos manuais — só o autor os pode dar

O guia está em `docs/ops/telemovel-setup.md`. Não há código a escrever em nenhum destes.

- [ ] Ligar o GitHub Pages — Settings → Pages → Source: GitHub Actions
- [ ] `eas init` e o primeiro `eas build --profile preview --platform android`
- [ ] Criar o token fine-grained e colá-lo no écran de Settings
- [ ] Registar o primeiro torneio a sério e confirmar que aparece um commit

**Pronto quando:** um FNM inteiro se regista em modo de avião e, à saída da loja, aparece um commit
com o evento completo.

---

## Fase 1 — Fechar o registo de torneio

O que falta para o registo ser completo em vez de suficiente. É a fase que mais depende de usar a app
a sério primeiro — a ordem aqui dentro deve mudar conforme o que incomodar no primeiro torneio.

- [ ] Games por match (2-0, 2-1) — já no schema, falta na interface
- [ ] `wentFirst` por match e por game — quem jogou primeiro
- [ ] Editar um match já registado (hoje só se apaga e volta a registar)
- [ ] Set do evento a partir da Scryfall API, em vez de escrito à mão
- [ ] Écran de histórico de eventos com procura

## Fase 2 — Decks

Hoje um deck é só `deckName` e `deckColors` dentro do evento: texto livre, que não se reutiliza entre
torneios e sobre o qual não se consegue calcular nada. Esta fase transforma-o numa entidade própria,
pelo mesmo padrão dos adversários — um ficheiro e uma referência.

- [ ] `data/schema/deck.schema.json` **antes** do código (convenção do CLAUDE.md)
- [ ] `data/decks/<slug>.json` e Deck Manager
- [ ] `deckId` no evento, mantendo `deckName`/`deckColors` para os eventos antigos continuarem a ler
- [ ] Win rate por deck — a pergunta que justifica a fase toda
- [ ] Deck Analyser: curva de mana, distribuição de cores, contagem por tipo

## Fase 3 — Cartas e colecção

- [ ] Card Search sobre a Scryfall API, com cache local
- [ ] Thumbnail do deck a partir de uma carta escolhida (`deckThumbnailCardId`, já no schema)
- [ ] `data/collection/cards.json` — colecção pessoal com quantidade, condição e foil
- [ ] Estatísticas por adversário

## Fase 4 — Valor da colecção

- [ ] Preços por carta, actualizados por GitHub Actions e não no telemóvel
- [ ] Evolução do valor da colecção ao longo do tempo — que o Git dá quase de graça

**A fonte dos preços está por decidir (Q8).** A Cardmarket API obriga a uma app aprovada e a
assinatura OAuth, que é precisamente o tipo de dependência online que o ADR 0006 existe para evitar.
A Scryfall já devolve `prices.eur` em cada carta, sem conta e sem autenticação, e publica bulk data
diário — que encaixa num workflow agendado sem nada de novo.

---

## Fora do roadmap

Contas de utilizador, perfis, partilha, ligação entre jogadores e qualquer camada social. Ver ADR
0006. Se um dia houver vontade de mostrar as estatísticas a alguém, a resposta é uma página de
leitura em GitHub Pages, não contas.
