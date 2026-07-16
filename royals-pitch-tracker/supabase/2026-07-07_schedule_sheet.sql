-- Run this in the Supabase SQL editor (after the profiles SQL) to enable
-- the league schedule sheet on the profile Schedule tab.

create table if not exists public.scheduled_games (
  id uuid primary key default gen_random_uuid(),
  game_date date not null,
  game_time text,
  home_team text,
  away_team text,
  assigned_to text,
  created_at timestamptz not null default now()
);

alter table public.scheduled_games enable row level security;

create policy "Authenticated users can read the schedule"
  on public.scheduled_games for select to authenticated using (true);

-- Only admins (profile flag or the built-in admin emails) can edit the sheet
create policy "Admins can insert schedule rows"
  on public.scheduled_games for insert to authenticated
  with check (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin)
    or (auth.jwt() ->> 'email') in ('colin@gordshier.com', 'colin@shier.ca', 'christiansturgeon06@gmail.com')
  );

create policy "Admins can update schedule rows"
  on public.scheduled_games for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin)
    or (auth.jwt() ->> 'email') in ('colin@gordshier.com', 'colin@shier.ca', 'christiansturgeon06@gmail.com')
  )
  with check (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin)
    or (auth.jwt() ->> 'email') in ('colin@gordshier.com', 'colin@shier.ca', 'christiansturgeon06@gmail.com')
  );

create policy "Admins can delete schedule rows"
  on public.scheduled_games for delete to authenticated
  using (
    exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.is_admin)
    or (auth.jwt() ->> 'email') in ('colin@gordshier.com', 'colin@shier.ca', 'christiansturgeon06@gmail.com')
  );
