# MTG Recall — Modelo de Dados

> Estado: Definido — pronto para implementar no Supabase
> Última actualização: Planning session

---

## Decisões Chave

- Um evento tem exactamente um deck (foco Limited)
- Pontos calculados automaticamente (W=3, D=1, L=0) — rank introduzido manualmente
- Matches têm games individuais (para registar 2-1, 2-0, etc.)
- Jogador 1 (plays first) registado por match
- Adversários ligados entre eventos por nome — Fase 4+ liga ao perfil se tiverem a app
- Cores guardadas sempre com flag de splash `{ color, splash }`

---

## Tabelas

### users
```
id            uuid          PK, gerado pelo Supabase Auth
email         text          único
username      text          único, opcional no MVP (Anon Auth)
created_at    timestamp     auto
```
> No MVP o utilizador é anónimo (Supabase Anon Auth). Na Fase 2 migra para conta real.

---

### events
```
id            uuid          PK
user_id       uuid          FK → users.id
name          text          ex: "FNM Sealed — Aetherdrift"
type          text          enum: 'sealed' | 'draft' | 'constructed' | 'cube'
set_code      text          código do set Scryfall (ex: "dft") — null se cube/personal
format_note   text          null ou "Personal Collection" | "Cube" — alternativa ao set
date          date          data do evento (pode ser retroactiva)
location      text          opcional
status        text          enum: 'active' | 'completed'
rank          text          introduzido manualmente (ex: "1st", "5th") — opcional
created_at    timestamp     auto
```
> `points` não é guardado — calculado dinamicamente a partir dos matches (W*3 + D*1)
> `date` e `created_at` são campos separados para suportar registo retroactivo

---

### opponents
```
id            uuid          PK
user_id       uuid          FK → users.id (dono do registo)
name          text          nome do adversário
app_user_id   uuid          FK → users.id — null até Fase 4+ (ligação ao perfil)
created_at    timestamp     auto
```
> Adversários são entidades próprias para permitir stats cross-event
> Dois registos com o mesmo nome são considerados a mesma pessoa — deduplicação por nome

---

### matches
```
id              uuid        PK
event_id        uuid        FK → events.id
opponent_id     uuid        FK → opponents.id
round           integer     número da ronda (1, 2, 3...)
result          text        enum: 'W' | 'L' | 'D'
went_first      boolean     true = eu joguei primeiro, false = adversário jogou primeiro
opponent_colors jsonb       array: [{ color: 'U', splash: false }, { color: 'B', splash: true }]
notes           text        opcional
created_at      timestamp   auto
```

---

### games
```
id            uuid          PK
match_id      uuid          FK → matches.id
game_number   integer       1, 2 ou 3
result        text          enum: 'W' | 'L' — sem draw em games individuais
went_first    boolean       true = eu joguei primeiro neste game
created_at    timestamp     auto
```
> Um match tem 2 ou 3 games
> O resultado do match é calculado a partir dos games (ex: 2 wins = W, 2 losses = L)

---

### decks
```
id                  uuid    PK
event_id            uuid    FK → events.id — único (1 deck por evento)
user_id             uuid    FK → users.id
name                text    ex: "Selesnya Midrange"
colors              jsonb   array: [{ color: 'G', splash: false }, { color: 'W', splash: false }]
thumbnail_card_id   text    scryfall_id da carta thumbnail — null até ser definido
created_at          timestamp auto
```
> thumbnail_card_id default: primeira rare do deck (lógica na app)

---

### deck_cards
```
id                uuid      PK
deck_id           uuid      FK → decks.id
scryfall_card_id  text      ID da carta no Scryfall
quantity          integer   quantidade no deck
in_deck           boolean   true = no deck, false = no card pool (sideboard/restante)
created_at        timestamp auto
```
> Fase 2+ — tabela só relevante quando Deck Manager for implementado

---

### portfolio_cards
```
id                uuid      PK
user_id           uuid      FK → users.id
scryfall_card_id  text      ID da carta no Scryfall
quantity          integer
condition         text      enum: 'M' | 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'
foil              boolean
added_at          timestamp auto
```
> Fase 3+ — só relevante quando Portfolio for implementado

---

## Relações

```
users
  └── events (1:N)
        └── matches (1:N)
              └── games (1:N)
        └── decks (1:1)
              └── deck_cards (1:N)
  └── opponents (1:N)
  └── portfolio_cards (1:N)

matches
  └── opponents (N:1)
```

---

## Campos Calculados (não guardados na DB)

| Campo | Cálculo | Usado em |
|---|---|---|
| `event.points` | matches W*3 + D*1 | Event Detail, Stats |
| `event.win_rate` | W / (W+L+D) * 100 | Event Detail, Stats, Home |
| `event.record` | contagem W-L-D | Event Detail, Events List |
| `match.result` | maioria de games W/L | calculado se não introduzido |
| `opponent.win_rate` | W contra este oponente / total | Stats (Fase 3) |
| `user.elo` | algoritmo ELO por formato | Stats (Fase 3) |

---

## Sets MTG

> Não é uma tabela própria — dados vêm da Scryfall API
> Endpoint: `GET https://api.scryfall.com/sets`
> Ordenar por `released_at` descrescente para o selector de "Add New Event"
> Cache local para não fazer request em cada abertura do selector

---

## Notas de Implementação

1. Todas as tabelas têm Row Level Security (RLS) no Supabase — cada utilizador só vê os seus dados
2. `opponent_colors` e `deck.colors` usam sempre estrutura `{ color: string, splash: boolean }` — nunca array plano
3. No MVP, `username` pode ser null (utilizador anónimo)
4. `games` é opcional no registo rápido — pode ser adicionado depois do match
