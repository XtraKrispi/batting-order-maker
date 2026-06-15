-- Batting Order Maker schema
-- Run this in the Supabase SQL editor to set up your database.

create extension if not exists "uuid-ossp";

-- Players / roster
create table if not exists players (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  jersey_number integer,
  offense_rank  integer not null default 5
                  check (offense_rank between 1 and 10),
  defense_rank  integer not null default 5
                  check (defense_rank between 1 and 10),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Games
create table if not exists games (
  id         uuid primary key default uuid_generate_v4(),
  date       date not null,
  opponent   text,
  notes      text,
  created_at timestamptz not null default now()
);

-- Per-game attendance (null = unknown, true = yes, false = no)
create table if not exists game_attendance (
  game_id    uuid not null references games(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  attending  boolean,
  primary key (game_id, player_id)
);

-- Fielding assignments per inning (position is one of:
--   P C 1B 2B 3B SS LF LC RC RF BENCH)
create table if not exists game_inning_assignments (
  id        uuid primary key default uuid_generate_v4(),
  game_id   uuid not null references games(id) on delete cascade,
  inning    integer not null check (inning between 1 and 4),
  player_id uuid not null references players(id) on delete cascade,
  position  text not null,
  unique (game_id, inning, player_id)
);

-- Batting order per game
create table if not exists game_batting_order (
  game_id      uuid not null references games(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  batting_slot integer not null,
  primary key (game_id, player_id)
);

-- Optional: disable RLS for a private/internal app.
-- If you want row-level security, configure policies here.
alter table players               disable row level security;
alter table games                 disable row level security;
alter table game_attendance       disable row level security;
alter table game_inning_assignments disable row level security;
alter table game_batting_order    disable row level security;
