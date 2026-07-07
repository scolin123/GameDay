-- Run this in the Supabase SQL editor before using the Profile feature.

-- One row per user: chosen username + admin flag (set by entering the admin code)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  username text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone signed in can read profiles (needed to show usernames and assign games)
create policy "Authenticated users can read profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Game assignment (email of the user expected to score the game), shown on the Schedule tab
alter table public.games add column if not exists assigned_to text;
