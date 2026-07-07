import { supabase } from './supabase';

// Entering this code on the Profile page grants admin access
export const ADMIN_CODE = 'ROYALS2026';

// These emails are always admins, even without a profile flag
export const ADMIN_EMAILS = ['colin@gordshier.com', 'colin@shier.ca', 'christiansturgeon06@gmail.com'];

export function isAdminUser(email, profile) {
  return ADMIN_EMAILS.includes(email) || !!profile?.is_admin;
}

// Fetches the signed-in user and their profile row, creating the row if missing.
// Returns { user, profile }; profile is null if the profiles table doesn't exist yet.
export async function ensureProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: existing, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { user, profile: null };
  if (existing) return { user, profile: existing };

  const { data: created } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, email: user.email })
    .select()
    .single();
  return { user, profile: created || null };
}

export async function fetchProfiles() {
  const { data } = await supabase.from('profiles').select('*').order('email');
  return data || [];
}

export function displayName(email, profiles) {
  if (!email) return '';
  const p = (profiles || []).find((x) => x.email === email);
  return p?.username || email;
}
