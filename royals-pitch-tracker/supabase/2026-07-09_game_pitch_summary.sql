-- Run this in the Supabase SQL editor.
-- Per-game pitch totals for the Dashboard, aggregated in the database so the
-- counts stay correct no matter how many pitches the season accumulates.
-- (Previously the app downloaded every pitch row and counted client-side,
-- which silently truncated once the league-wide total passed the row cap.)

create or replace view public.game_pitch_summary
with (security_invoker = true) as
select
  game_id,
  count(*)::int as pitch_count,
  max(inning)   as inning_count
from public.pitches
group by game_id;

grant select on public.game_pitch_summary to authenticated;
