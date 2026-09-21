-- Schema for /meet/ (the group scheduler). Run once in the Supabase SQL editor.
--
-- Two tables: one row per event, one row per (event, person) answer. The page
-- talks to them through PostgREST with the anon key, so all access control is
-- these row-level-security policies: anyone can read, create events, and add
-- or change answers; nobody can delete or edit an event. A cleared answer is a
-- row with empty bits (the page hides those). There are no accounts — a name
-- is the identity, same as LettuceMeet.

create table public.meet_events (
  id          text primary key check (id ~ '^[A-Za-z0-9]{12}$'),
  title       text not null default '' check (char_length(title) <= 80),
  days        text[] not null check (array_length(days, 1) between 1 and 62),
  start_hour  int not null check (start_hour between 0 and 23),
  end_hour    int not null check (end_hour between 1 and 24 and end_hour > start_hour),
  tz          text not null default '' check (char_length(tz) <= 64),
  created_at  timestamptz not null default now()
);

create table public.meet_responses (
  event_id    text not null references public.meet_events (id) on delete cascade,
  name_key    text not null check (char_length(name_key) between 1 and 40),  -- trimmed, lower-cased
  name        text not null check (char_length(name) between 1 and 40),      -- as typed
  bits        text not null default '' check (char_length(bits) <= 600),     -- base64url bitmask, '' = cleared
  updated_at  timestamptz not null default now(),
  primary key (event_id, name_key)
);

-- Server-side timestamps: the page never sends updated_at.
create or replace function public.meet_touch() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger meet_responses_touch
  before insert or update on public.meet_responses
  for each row execute function public.meet_touch();

alter table public.meet_events    enable row level security;
alter table public.meet_responses enable row level security;

create policy "anyone can read events"      on public.meet_events    for select to anon using (true);
create policy "anyone can create events"    on public.meet_events    for insert to anon with check (true);
create policy "anyone can read responses"   on public.meet_responses for select to anon using (true);
create policy "anyone can add responses"    on public.meet_responses for insert to anon with check (true);
create policy "anyone can change responses" on public.meet_responses for update to anon using (true) with check (true);
-- Intentionally no delete policies and no update policy on meet_events.

-- Supabase grants anon everything on public tables by default; narrow it so a
-- policy mistake can't turn into a delete. (Upserts need plain update: the
-- generated ON CONFLICT ... DO UPDATE touches the key columns too.)
revoke all on public.meet_events, public.meet_responses from anon;
grant select, insert on public.meet_events to anon;
grant select, insert, update on public.meet_responses to anon;
