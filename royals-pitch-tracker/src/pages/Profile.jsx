import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ADMIN_CODE, ensureProfile, fetchProfiles, isAdminUser } from '../lib/profile';
import { fetchMyTeams, fetchTeamMemberIds, joinTeamByCode } from '../lib/teams';
import { getTheme, setTheme } from '../lib/theme';
import Toast from '../components/Toast';
import styles from './Profile.module.css';

export default function Profile() {
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [username, setUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [theme, setThemeState] = useState(getTheme());
  const [adminCode, setAdminCode] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [toast, setToast] = useState('');
  const [myTeams, setMyTeams] = useState([]);
  const [teamMemberIds, setTeamMemberIds] = useState([]);
  const [teamCode, setTeamCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);

  async function load() {
    const { user, profile: prof } = await ensureProfile();
    if (!user) return;
    setEmail(user.email);
    setProfile(prof);
    setUsername(prof?.username || '');

    const [allProfiles, teams] = await Promise.all([
      fetchProfiles(),
      fetchMyTeams(user.id),
    ]);
    setProfiles(allProfiles);
    setMyTeams(teams);
    if (teams[0]) setTeamMemberIds(await fetchTeamMemberIds(teams[0].id));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch, setState only after awaits
    load();
  }, []);

  async function saveOwnProfile(fields) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, email: user.email, ...fields })
      .select()
      .single();
    if (error) {
      setToast(`${error.message} — make sure the profiles SQL has been run in Supabase.`);
      return null;
    }
    setProfile(data);
    return data;
  }

  async function handleSaveUsername(e) {
    e.preventDefault();
    setSavingUsername(true);
    const saved = await saveOwnProfile({ username: username.trim() || null });
    setSavingUsername(false);
    if (saved) setToast('Username saved');
  }

  function handleTheme(mode) {
    setTheme(mode);
    setThemeState(mode);
  }

  async function handleUnlockAdmin(e) {
    e.preventDefault();
    if (adminCode.trim() !== ADMIN_CODE) {
      setToast('Incorrect admin code');
      return;
    }
    setUnlocking(true);
    const saved = await saveOwnProfile({ is_admin: true });
    setUnlocking(false);
    if (saved) {
      setAdminCode('');
      setToast('Admin access unlocked');
    }
  }

  async function handleJoinTeam(e) {
    e.preventDefault();
    if (!teamCode.trim()) return;
    setJoining(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { team, error } = await joinTeamByCode(teamCode.trim(), user.id);
    setJoining(false);
    if (error) {
      setToast(error);
      return;
    }
    setTeamCode('');
    setShowTeamModal(false);
    const teams = await fetchMyTeams(user.id);
    setMyTeams(teams);
    if (teams[0]) setTeamMemberIds(await fetchTeamMemberIds(teams[0].id));
    setToast(`Joined ${team.name}`);
  }

  const isAdmin = isAdminUser(email, profile);
  const teamMembers = profiles.filter((p) => teamMemberIds.includes(p.user_id));

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.backLink}>← Dashboard</Link>
        <span className={styles.navTitle}>Profile</span>
        <Link to="/schedule" className={styles.backLink}>Schedule</Link>
        <button type="button" onClick={() => supabase.auth.signOut()} className={styles.signOut}>
          Sign Out
        </button>
      </nav>

      <div className={styles.content}>
        <div className={styles.cardGrid}>
          {/* Account */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Account</h2>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Signed in as</span>
              <span className={styles.fieldValue}>{email || '…'}</span>
            </div>
            <form onSubmit={handleSaveUsername} className={styles.inlineForm}>
              <label className={styles.fieldLabel} htmlFor="username">Username</label>
              <div className={styles.inlineInputs}>
                <input
                  id="username"
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Colin"
                  value={username}
                  maxLength={30}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <button type="submit" className={styles.primaryBtn} disabled={savingUsername}>
                  {savingUsername ? 'Saving…' : 'Save'}
                </button>
              </div>
              <p className={styles.hint}>Shown instead of your email across the app.</p>
            </form>
          </section>

          {/* Appearance */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Appearance</h2>
            <div className={styles.themeToggle}>
              <button
                type="button"
                className={`${styles.themeBtn} ${theme === 'light' ? styles.themeBtnActive : ''}`}
                onClick={() => handleTheme('light')}
              >
                ☀ Light
              </button>
              <button
                type="button"
                className={`${styles.themeBtn} ${theme === 'dark' ? styles.themeBtnActive : ''}`}
                onClick={() => handleTheme('dark')}
              >
                ● Dark
              </button>
            </div>
          </section>

          {/* Admin */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Admin</h2>
            {isAdmin ? (
              <p className={styles.adminActive}>✓ Admin access enabled</p>
            ) : (
              <form onSubmit={handleUnlockAdmin}>
                <div className={styles.inlineInputs}>
                  <input
                    type="password"
                    className={styles.input}
                    placeholder="Admin code"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                  />
                  <button type="submit" className={styles.primaryBtn} disabled={unlocking || !adminCode}>
                    {unlocking ? 'Unlocking…' : 'Unlock'}
                  </button>
                </div>
                <p className={styles.hint}>Enter the admin code to see game statuses and assign games.</p>
              </form>
            )}
          </section>

          {/* Team */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Team</h2>
            {myTeams.length > 0 ? (
              <>
                <div className={styles.teamChips}>
                  {myTeams.map((t) => (
                    <span key={t.id} className={styles.teamChip}>{t.name}</span>
                  ))}
                </div>
                {teamMembers.length > 0 && (
                  <div className={styles.memberBlock}>
                    <span className={styles.fieldLabel}>Members ({teamMembers.length})</span>
                    <div className={styles.memberChips}>
                      {teamMembers.map((m) => (
                        <span key={m.user_id} className={styles.memberChip} title={m.email}>
                          {m.username || m.email}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => { setTeamCode(''); setShowTeamModal(true); }}
                >
                  Change team
                </button>
              </>
            ) : (
              <>
                <p className={styles.hint}>You're not on a team yet.</p>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => { setTeamCode(''); setShowTeamModal(true); }}
                >
                  Join a team
                </button>
              </>
            )}
          </section>

          {/* Password reset hidden for now */}
        </div>
      </div>

      {showTeamModal && (
        <div className={styles.modalOverlay} onClick={() => !joining && setShowTeamModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{myTeams.length > 0 ? 'Change team' : 'Join a team'}</h2>
            <p className={styles.modalBody}>Enter a team code to join. You'll appear in that team's assignment list.</p>
            <form onSubmit={handleJoinTeam}>
              <input
                type="text"
                className={styles.input}
                placeholder="Team code"
                value={teamCode}
                autoFocus
                onChange={(e) => setTeamCode(e.target.value)}
              />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={() => setShowTeamModal(false)}
                  disabled={joining}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={joining || !teamCode.trim()}>
                  {joining ? 'Joining…' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
