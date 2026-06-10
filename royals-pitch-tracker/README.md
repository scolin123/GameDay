# Guelph Royals Pitch Tracker

A professional baseball pitch-tracking and game-scoring web app for the Guelph Royals (Canadian Baseball League). Used live during games by a single scorer/analyst to capture pitch-by-pitch data — pitch type, location, outcome, count, runners, and quality of contact — and export a CSV matching the Royals' existing Google Sheets schema.

## Setup

```bash
git clone <repo-url>
cd royals-pitch-tracker
npm install
cp .env.example .env
# Fill in your Supabase credentials in .env
npm run dev
```

## Supabase Setup

Run the following SQL in the Supabase SQL editor:

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  date date not null,
  home_team text not null,
  away_team text not null,
  user_id uuid references auth.users(id)
);
create table rosters (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  team text not null,
  player_name text not null,
  player_role text not null,
  bats text,
  throws text,
  batting_order int
);
create table pitches (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  created_at timestamptz default now(),
  pitch_number int not null,
  half_inning text not null,
  inning int not null,
  outs int not null,
  balls int not null,
  strikes int not null,
  count text not null,
  runners text not null default '000',
  batter text not null,
  pitcher text not null,
  batter_team text not null,
  pitcher_team text not null,
  batter_side text,
  pitcher_side text,
  pitch_type text,
  outcome text not null,
  quality_of_contact text,
  spray_chart text,
  time_to_plate_man_on_first numeric,
  notes text,
  pitch_location_x numeric,
  pitch_location_y numeric
);
alter table games enable row level security;
alter table rosters enable row level security;
alter table pitches enable row level security;
create policy "Users manage their games"
  on games for all using (auth.uid() = user_id);
create policy "Users manage their rosters"
  on rosters for all using (
    game_id in (select id from games where user_id = auth.uid())
  );
create policy "Users manage their pitches"
  on pitches for all using (
    game_id in (select id from games where user_id = auth.uid())
  );
```

## Running

```bash
npm run dev
```

## Deploy

1. Push to GitHub
2. Import repo in Vercel
3. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Deploy
