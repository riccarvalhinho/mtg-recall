# MTG Recall — Roadmap

> O que vem a seguir e por que ordem. Actualizar quando uma fase fechar ou quando a ordem mudar.
> Última actualização: 2026-08-31

A app é de utilizador único (ADR 0006) e os dados são ficheiros no repositório (ADR 0002). Tudo o que
está aqui assume isso.

---

## Fase 0 — Repurpose (em curso)

Tirar o Supabase do caminho e pôr a app a escrever no repositório. Nenhuma funcionalidade nova; o
objectivo é ficar com uma app que se usa a sério num torneio, instalada no telemóvel.

- [x] Decisões registadas em `docs/adr/`
- [x] `data-model.md` reescrito para ficheiros
- [ ] Schemas em `data/schema/` e `npm run validate` a correr em CI
- [ ] `bundle.json` publicado em GitHub Pages
- [ ] Camada de dados: `services/github.ts`, `domain/outbox.ts`, `services/repoFiles.ts`, `services/localStore.ts`
- [ ] Store local-first; Supabase removido do código e das dependências
- [ ] Écran de Settings: token, estado da sincronização, sincronizar agora, puxar do GitHub
- [ ] APK no telemóvel por EAS Build, com EAS Update ligado

**Pronto quando:** um FNM inteiro se regista em modo de avião e, à saída da loja, aparece um commit
com o evento completo.

## Fase 1 — Fechar o registo de torneio

O que falta para o registo ser completo em vez de suficiente.

- [ ] Games por match (2-0, 2-1) — já no schema, falta na interface
- [ ] `wentFirst` por match e por game — quem jogou primeiro
- [ ] Editar um match já registado (hoje só se apaga)
- [ ] Set do evento a partir da Scryfall API, em vez de escrito à mão
- [ ] Écran de histórico de eventos com procura

## Fase 2 — Decks

- [ ] `data/decks/<slug>.json` e Deck Manager
- [ ] Ligar um deck a um evento (`deckId`), mantendo os campos actuais para eventos antigos
- [ ] Deck Analyser: curva de mana, distribuição de cores, contagem por tipo

## Fase 3 — Cartas e colecção

- [ ] Card Search sobre a Scryfall API, com cache local
- [ ] Thumbnail do deck a partir de uma carta escolhida
- [ ] `data/collection/cards.json` — colecção pessoal com quantidade, condição e foil
- [ ] Estatísticas por adversário

## Fase 4 — Valor da colecção

- [ ] Preços por carta (Cardmarket), actualizados em GitHub Actions e não no telemóvel
- [ ] Evolução do valor da colecção ao longo do tempo — que o Git dá quase de graça

## Fora do roadmap

Contas de utilizador, perfis, partilha, ligação entre jogadores e qualquer camada social. Ver ADR
0006. Se um dia houver vontade de mostrar as estatísticas a alguém, a resposta é uma página de
leitura em GitHub Pages, não contas.
