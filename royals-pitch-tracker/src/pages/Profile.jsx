import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ADMIN_CODE, ensureProfile, fetchProfiles, isAdminUser, displayName } from '../lib/profile';
import { getTheme, setTheme } from '../lib/theme';
import { STATUS, STATUS_LABEL, STATUS_COLOR } from '../lib/gameStatus';
import Toast from '../components/Toast';
import styles from './Profile.module.css';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function GameRow({ game, profiles, showAssigned }) {
  const status = game.status || STATUS.IN_PROGRESS;
  return (
    <div className={styles.gameRow}>
      <span className={styles.gameDate}>{formatDate(game.date)}</span>
      <span className={styles.gameMatchup}>{game.away_team} @ {game.home_team}</span>
      {showAssigned && (
        <span className={styles.gameAssigned}>
          {game.assigned_to ? displayName(game.assigned_to, profiles) : '—'}
        </span>
      )}
      <span className={styles.statusChip} style={{ background: STATUS_COLOR[status] }}>
        {STATUS_LABEL[status]}
      </span>
      <span className={styles.gameActions}>
        <Link to={`/games/${game.id}/live`} className={styles.gameActionBtn}>Score</Link>
        <Link to={`/games/${game.id}/log`} className={styles.gameActionBtn}>Log</Link>
      </span>
    </div>
  );
}

export default function Profile() {
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [username, setUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [theme, setThemeState] = useState(getTheme());
  const [adminCode, setAdminCode] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [tab, setTab] = useState('games');
  const [myGames, setMyGames] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [toast, setToast] = useState('');

  async function load() {
    const { user, profile: prof } = await ensureProfile();
    if (!user) return;
    setEmail(user.email);
    setProfile(prof);
    setUsername(prof?.username || '');

    const today = new Date().toISOString().split('T')[0];
    const [{ data: mine }, { data: sched }, allProfiles] = await Promise.all([
      supabase.from('games').select('*').eq('logged_by', user.email).order('date', { ascending: false }),
      supabase.from('games').select('*').gte('date', today).order('date', { ascending: true }),
      fetchProfiles(),
    ]);
    setMyGames(mine || []);
    setUpcoming(sched || []);
    setProfiles(allProfiles);
    setLoadingGames(false);
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

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setToast('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      setToast(error.message);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setToast('Password updated');
  }

  const isAdmin = isAdminUser(email, profile);
  const inProgress = myGames.filter((g) => (g.status || STATUS.IN_PROGRESS) === STATUS.IN_PROGRESS);
  const finished = myGames.filter((g) => (g.status || STATUS.IN_PROGRESS) !== STATUS.IN_PROGRESS);
  const assignedToMe = upcoming.filter((g) => g.assigned_to === email);
  const otherUpcoming = upcoming.filter((g) => g.assigned_to !== email);

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.backLink}>← Dashboard</Link>
        <span className={styles.navTitle}>Profile</span>
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

          {/* Password */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Reset Password</h2>
            <form onSubmit={handleChangePassword} className={styles.stackForm}>
              <input
                type="password"
                className={styles.input}
                placeholder="New password"
                value={newPassword}
                minLength={6}
                required
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                type="password"
                className={styles.input}
                placeholder="Confirm new password"
                value={confirmPassword}
                minLength={6}
                required
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="submit" className={styles.primaryBtn} disabled={changingPassword}>
                {changingPassword ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </section>
        </div>

        {/* Tabs */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === 'games' ? styles.tabBtnActive : ''}`}
            onClick={() => setTab('games')}
          >
            My Games{inProgress.length > 0 ? ` (${inProgress.length} in progress)` : ''}
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === 'schedule' ? styles.tabBtnActive : ''}`}
            onClick={() => setTab('schedule')}
          >
            Schedule{assignedToMe.length > 0 ? ` (${assignedToMe.length} assigned)` : ''}
          </button>
        </div>

        {loadingGames ? (
          <p className={styles.loading}>Loading games…</p>
        ) : tab === 'games' ? (
          <div className={styles.tabContent}>
            <h3 className={styles.groupTitle}>In Progress — finish these</h3>
            {inProgress.length === 0 ? (
              <p className={styles.empty}>Nothing in progress. All caught up!</p>
            ) : (
              <div className={`${styles.gameList} ${styles.gameListHighlight}`}>
                {inProgress.map((g) => <GameRow key={g.id} game={g} profiles={profiles} />)}
              </div>
            )}
            <h3 className={styles.groupTitle}>Completed</h3>
            {finished.length === 0 ? (
              <p className={styles.empty}>No completed games yet.</p>
            ) : (
              <div className={styles.gameList}>
                {finished.map((g) => <GameRow key={g.id} game={g} profiles={profiles} />)}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.tabContent}>
            <h3 className={styles.groupTitle}>Assigned to you</h3>
            {assignedToMe.length === 0 ? (
              <p className={styles.empty}>No upcoming games assigned to you.</p>
            ) : (
              <div className={`${styles.gameList} ${styles.gameListHighlight}`}>
                {assignedToMe.map((g) => <GameRow key={g.id} game={g} profiles={profiles} showAssigned />)}
              </div>
            )}
            <h3 className={styles.groupTitle}>All upcoming games</h3>
            {otherUpcoming.length === 0 ? (
              <p className={styles.empty}>No other upcoming games.</p>
            ) : (
              <div className={styles.gameList}>
                {otherUpcoming.map((g) => <GameRow key={g.id} game={g} profiles={profiles} showAssigned />)}
              </div>
            )}
          </div>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
