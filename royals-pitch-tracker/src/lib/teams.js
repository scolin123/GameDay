import { supabase } from './supabase';

// Teams the given user belongs to. Returns [] if the teams tables don't exist yet.
export async function fetchMyTeams(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('team_members')
    .select('team_id, teams ( id, name, join_code )')
    .eq('user_id', userId);
  if (error) return [];
  return (data || []).map((r) => r.teams).filter(Boolean);
}

// user_ids of everyone on a team
export async function fetchTeamMemberIds(teamId) {
  if (!teamId) return [];
  const { data, error } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId);
  if (error) return [];
  return (data || []).map((r) => r.user_id);
}

// Join a team by its code. Returns { team } on success or { error } with a message.
export async function joinTeamByCode(code, userId) {
  const { data: team, error } = await supabase
    .from('teams')
    .select('*')
    .eq('join_code', code)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!team) return { error: 'No team found for that code.' };

  const { error: insErr } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, user_id: userId });
  // Already a member is fine
  if (insErr && !/duplicate|unique/i.test(insErr.message)) return { error: insErr.message };
  return { team };
}
