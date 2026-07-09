-- Run this in the Supabase SQL editor (after the profiles + schedule SQL).
-- Adds teams you join by code, and turns the schedule into weekly drafts that
-- an admin publishes (published rows become visible to everyone).

-- ── Teams ──────────────────────────────────────────────────────────────────
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

-- Seed the Royals team (join code ROYALS2026)
insert into public.teams (name, join_code)
select 'Royals', 'ROYALS2026'
where not exists (select 1 from public.teams where name = 'Royals');

alter table public.teams enable row level security;

create policy "Authenticated users can read teams"
  on public.teams for select to authenticated using (true);

-- ── Team membership ────────────────────────────────────────────────────────
create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.team_members enable row level security;

create policy "Authenticated users can read team members"
  on public.team_members for select to authenticated using (true);

create policy "Users can join a team"
  on public.team_members for insert to authenticated with check (user_id = auth.uid());

create policy "Users can leave a team"
  on public.team_members for delete to authenticated using (user_id = auth.uid());

-- ── Seed: every existing user joins Royals ─────────────────────────────────
-- Make sure every auth user has a profile row first
insert into public.profiles (user_id, email)
select id, email from auth.users
on conflict (user_id) do nothing;

-- Then add everyone to the Royals team
insert into public.team_members (team_id, user_id)
select t.id, p.user_id
from public.teams t
cross join public.profiles p
where t.name = 'Royals'
on conflict do nothing;

-- ── Weekly draft/publish on the schedule ───────────────────────────────────
alter table public.scheduled_games
  add column if not exists team_id uuid references public.teams (id),
  add column if not exists published boolean not null default false,
  add column if not exists published_at timestamptz;

-- Replace the "everyone can read" policy: non-admins only see published rows
drop policy if exists "Authenticated users can read the schedule" on public.scheduled_games;

create policy "Read published schedule or admins read all"
  on public.scheduled_games for select to authenticated using (
    coalesce(published, false) = true
    or exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin)
    or (auth.jwt() ->> 'email') in ('colin@gordshier.com', 'colin@shier.ca', 'christiansturgeon06@gmail.com')
  );
