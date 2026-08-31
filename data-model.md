# MTG Recall — Modelo de Dados

> Os dados são ficheiros JSON no repositório. Ver `docs/adr/0002-dados-json-versionados.md`.
> O contrato executável são os schemas em `data/schema/`, validados em CI. Este ficheiro explica
> as decisões; o schema é que manda.
> Última actualização: 2026-08-31

---

## Decisões Chave

- **Um evento = um ficheiro.** `data/events/<AAAA-MM-DD-slug>.json`. O nome do ficheiro é igual ao `id`.
- **Os matches vivem dentro do evento.** Um match não existe fora do seu torneio, e o diff de uma
  noite de FNM deve ler-se de uma vez só.
- **A ronda identifica o match.** Não há UUIDs: dentro de um evento, `round` é único. Apagar um match
  renumera as rondas seguintes.
- **Os adversários são referências**, não texto livre — apontam para `data/taxonomies/opponents.json`.
  Sem isto, as estatísticas por adversário nunca agregam "João Ferreira" e "joão ferreira".
- **Um evento tem um deck.** Os campos do deck vivem no evento (foco Limited). Quando o Deck Manager
  chegar (Fase 2), o deck ganha ficheiro próprio e o evento passa a ter também um `deckId`.
- **Nada de campos calculados nos ficheiros.** Pontos, win rate e record calculam-se em runtime a
  partir dos matches. Guardá-los seria guardar duas verdades.
- **Nada de timestamps.** O Git já sabe quando cada ficheiro mudou; um `updatedAt` só acrescentava
  ruído a cada diff. A data que interessa — a do torneio — é um campo de produto (`date`), e pode ser
  retroactiva.

---

## Estrutura

```
data/
  schema/
    event.schema.json        contrato de um evento (e dos matches lá dentro)
    opponents.schema.json    contrato da taxonomia de adversários
  events/
    2026-04-12-fnm-sealed-aetherdrift.json
    2026-04-05-ptq-trial-draft.json
  taxonomies/
    opponents.json
```

A partir da Fase 2 juntam-se `data/decks/<slug>.json` e, na Fase 3, `data/collection/cards.json`.

---

## Evento

`data/events/2026-04-12-fnm-sealed-aetherdrift.json`

```json
{
  "id": "2026-04-12-fnm-sealed-aetherdrift",
  "name": "FNM Sealed — Aetherdrift",
  "type": "Sealed",
  "setCode": "dft",
  "date": "2026-04-12",
  "location": "Nave Espacial, Lisboa",
  "status": "completed",
  "rank": "3rd",
  "playersCount": 16,
  "deckName": "Selesnya Midrange",
  "deckColors": { "main": ["G", "W"], "splash": ["U"] },
  "matches": [
    {
      "round": 1,
      "opponentId": "joao-ferreira",
      "opponentColors": { "main": ["U", "B"], "splash": [] },
      "result": "W",
      "wentFirst": true,
      "games": [
        { "number": 1, "result": "W", "wentFirst": true },
        { "number": 2, "result": "L", "wentFirst": false },
        { "number": 3, "result": "W", "wentFirst": true }
      ],
      "notes": "Removal a mais do outro lado no game 2."
    }
  ]
}
```

| Campo | Obrigatório | Notas |
|---|---|---|
| `id` | sim | Slug igual ao nome do ficheiro. Prefixo de data para o `ls` sair por ordem cronológica |
| `name` | sim | Como aparece na app |
| `type` | sim | `Sealed`, `Draft`, `Standard`, `Modern`, `Pioneer`, `Legacy`, `Commander` |
| `setCode` | não | Código Scryfall do set (ex.: `dft`). Só faz sentido em Limited |
| `date` | sim | `AAAA-MM-DD`. Pode ser retroactiva |
| `location` | não | |
| `status` | sim | `active` ou `completed`. Só um evento deve estar `active` de cada vez |
| `rank` | não | Introduzido à mão no fim (`1st`, `Top 8`, …) |
| `playersCount` | não | |
| `deckName`, `deckColors`, `deckThumbnailCardId` | não | O deck jogado neste evento |
| `notes` | não | |
| `matches` | sim | Pode ser lista vazia — um evento acabado de criar ainda não tem rondas |

## Match

Dentro do array `matches` do evento.

| Campo | Obrigatório | Notas |
|---|---|---|
| `round` | sim | Inteiro ≥ 1, único dentro do evento, sem saltos |
| `opponentId` | sim | Referência a `data/taxonomies/opponents.json` |
| `opponentColors` | sim | `{ "main": [...], "splash": [...] }`, cores em `W U B R G` |
| `result` | sim | `W`, `L` ou `D` |
| `wentFirst` | não | `true` se fui eu a jogar primeiro na ronda |
| `games` | não | Registo game a game — permite saber que um 2-1 foi 2-1. Sem `D` num game |
| `notes` | não | |

Quando há `games`, o `result` do match tem de ser coerente com eles: dois `W` dão `W`, dois `L` dão
`L`, um a um com um game não jogado dá `D`. A validação verifica isso — um match a dizer `W` com dois
games perdidos é um erro de dedo, não uma opção.

## Adversários

`data/taxonomies/opponents.json`

```json
{
  "kind": "opponents",
  "items": [
    { "id": "joao-ferreira", "name": "João Ferreira" }
  ]
}
```

O `id` é o slug do nome. O `name` é o que aparece na app e é o único sítio onde ele existe — mudar
aqui muda em todos os eventos. O repositório é público (ADR 0005): se um nome não dever aparecer,
troca-se o `name` por uma alcunha e nenhum evento precisa de ser tocado.

---

## Campos calculados (nunca guardados)

| Campo | Cálculo | Usado em |
|---|---|---|
| `event.points` | `W*3 + D*1` | Event Detail, Stats |
| `event.winRate` | `W / (W+L+D) * 100` | Event Detail, Stats, Home |
| `event.record` | contagem W–L–D | Event Detail, Events List |
| `opponent.winRate` | vitórias contra ele / total | Stats (Fase 3) |

---

## Sets MTG

Não são dados nossos — vêm da Scryfall API (`GET https://api.scryfall.com/sets`), ordenados por
`released_at` descendente para o selector de "Add New Event", com cache local para não repetir o
pedido a cada abertura.

---

## Correspondência com SQL, se um dia for preciso

O ADR 0002 promete uma saída de emergência. É esta: `data/events/*.json` → tabela `events` mais
tabela `matches` com FK `event_id` e coluna `round`; `games` → tabela filha de `matches`;
`opponents.json` → tabela `opponents`. Não há nada no modelo que dependa de ser um ficheiro além da
comodidade do diff.
