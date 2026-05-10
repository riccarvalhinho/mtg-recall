-- MTG Recall — Schema inicial MVP
-- Correr no Supabase Dashboard → SQL Editor
-- Tabelas: events, opponents, matches
-- Fase 2+: games, decks, deck_cards, portfolio_cards

-- ─── Apagar tabelas antigas (se existirem) ───────────────────────────────────
-- CASCADE garante que as FK dependentes também são removidas

drop table if exists public.matches   cascade;
drop table if exists public.opponents cascade;
drop table if exists public.events    cascade;

-- ─── Tabela: events ──────────────────────────────────────────────────────────

create table public.events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  type        text        not null check (type in (
                            'Sealed','Draft','Standard','Modern','Legacy','Pioneer','Commander'
                          )),
  date        date        not null default current_date,
  location    text,
  active      boolean     not null default true,
  deck_name   text,
  -- deck_colors: { "main": ["G","W"], "splash": ["U"] }
  deck_colors jsonb,
  created_at  timestamptz not null default now()
);

-- ─── Tabela: opponents ───────────────────────────────────────────────────────

create table public.opponents (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  created_at  timestamptz not null default now(),
  -- Mesmo utilizador não pode ter dois adversários com o mesmo nome
  unique (user_id, name)
);

-- ─── Tabela: matches ─────────────────────────────────────────────────────────

create table public.matches (
  id               uuid        primary key default gen_random_uuid(),
  event_id         uuid        not null references public.events(id) on delete cascade,
  opponent_id      uuid        references public.opponents(id),
  round            integer     not null,
  result           text        not null check (result in ('W','L','D')),
  -- opponent_colors: { "main": ["U","B"], "splash": ["G"] }
  opponent_colors  jsonb       not null default '{"main":[],"splash":[]}',
  notes            text,
  created_at       timestamptz not null default now()
);

-- ─── Índices ─────────────────────────────────────────────────────────────────

create index events_user_id_idx   on public.events(user_id);
create index matches_event_id_idx on public.matches(event_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.events    enable row level security;
alter table public.opponents enable row level security;
alter table public.matches   enable row level security;

-- Políticas events: utilizador só vê/gere os seus próprios eventos
create policy "events: select own"
  on public.events for select
  using (auth.uid() = user_id);

create policy "events: insert own"
  on public.events for insert
  with check (auth.uid() = user_id);

create policy "events: update own"
  on public.events for update
  using (auth.uid() = user_id);

create policy "events: delete own"
  on public.events for delete
  using (auth.uid() = user_id);

-- Políticas opponents
create policy "opponents: select own"
  on public.opponents for select
  using (auth.uid() = user_id);

create policy "opponents: insert own"
  on public.opponents for insert
  with check (auth.uid() = user_id);

-- Políticas matches: acesso via event (o match pertence ao utilizador dono do evento)
create policy "matches: select own"
  on public.matches for select
  using (
    exists (
      select 1 from public.events
      where id = matches.event_id
        and user_id = auth.uid()
    )
  );

create policy "matches: insert own"
  on public.matches for insert
  with check (
    exists (
      select 1 from public.events
      where id = matches.event_id
        and user_id = auth.uid()
    )
  );

create policy "matches: update own"
  on public.matches for update
  using (
    exists (
      select 1 from public.events
      where id = matches.event_id
        and user_id = auth.uid()
    )
  );
