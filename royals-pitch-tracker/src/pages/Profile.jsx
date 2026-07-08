import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ADMIN_CODE, ensureProfile, fetchProfiles, isAdminUser, displayName } from '../lib/profile';
import { getTheme, setTheme } from '../lib/theme';
import { STATUS, STATUS_LABEL, STATUS_COLOR } from '../lib/gameStatus';
import Toast from '../components/Toast';
import styles from './Profile.module.css';

const CBL_TEAMS = [
  'Barrie Baycats',
  'Brantford Red Sox',
  'Chatham-Kent Barnstormers',
  'Guelph Royals',
  'Hamilton Cardinals',
  'Kitchener Panthers',
  'London Majors',
  'Toronto Maple Leafs',
  'Welland Jackfish',
];

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

function formatSheetDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function SheetRow({ row, isAdmin, onChange, onDelete }) {
  const [time, setTime] = useState(row.game_time || '');
  const [assigned, setAssigned] = useState(row.assigned_to || '');

  if (!isAdmin) {
    return (
      <tr className={styles.sheetRow}>
        <td className={styles.sheetCell}>{formatSheetDate(row.game_date)}</td>
        <td className={styles.sheetCell}>{row.game_time || '—'}</td>
        <td className={styles.sheetCell}>{row.home_team || '—'}</td>
        <td className={styles.sheetCell}>{row.away_team || '—'}</td>
        <td className={styles.sheetCell}>{row.assigned_to || '—'}</td>
      </tr>
    );
  }

  const teamSelect = (field) => (
    <select
      className={styles.sheetSelect}
      value={row[field] || ''}
      onChange={(e) => onChange(row.id, field, e.target.value)}
    >
      <option value="">—</option>
      {CBL_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );

  return (
    <tr className={styles.sheetRow}>
      <td className={styles.sheetCell}>
        <input
          type="date"
          className={styles.sheetInput}
          value={(row.game_date || '').slice(0, 10)}
          onChange={(e) => e.target.value && onChange(row.id, 'game_date', e.target.value)}
        />
      </td>
      <td className={styles.sheetCell}>
        <input
          type="text"
          className={`${styles.sheetInput} ${styles.sheetTimeInput}`}
          placeholder="7:05"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => { if (time !== (row.game_time || '')) onChange(row.id, 'game_time', time.trim()); }}
        />
      </td>
      <td className={styles.sheetCell}>{teamSelect('home_team')}</td>
      <td className={styles.sheetCell}>{teamSelect('away_team')}</td>
      <td className={styles.sheetCell}>
        <input
          type="text"
          className={`${styles.sheetInput} ${styles.sheetInputPlain}`}
          placeholder="Name"
          value={assigned}
          onChange={(e) => setAssigned(e.target.value)}
          onBlur={() => { if (assigned !== (row.assigned_to || '')) onChange(row.id, 'assigned_to', assigned.trim()); }}
        />
      </td>
      <td className={`${styles.sheetCell} ${styles.sheetDeleteCell}`}>
        <button type="button" className={styles.sheetDeleteBtn} title="Remove row" onClick={() => onDelete(row.id)}>
          ✕
        </button>
      </td>
    </tr>
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
  const [schedule, setSchedule] = useState([]);
  const [scheduleMissing, setScheduleMissing] = useState(false);
  const [loadingGames, setLoadingGames] = useState(true);
  const [toast, setToast] = useState('');

  async function load() {
    const { user, profile: prof } = await ensureProfile();
    if (!user) return;
    setEmail(user.email);
    setProfile(prof);
    setUsername(prof?.username || '');

    const today = new Date().toISOString().split('T')[0];
    const [{ data: mine }, { data: sched }, allProfiles, { data: sheet, error: sheetErr }] = await Promise.all([
      supabase.from('games').select('*').eq('logged_by', user.email).order('date', { ascending: false }),
      supabase.from('games').select('*').gte('date', today).order('date', { ascending: true }),
      fetchProfiles(),
      supabase.from('scheduled_games').select('*')
        .order('game_date', { ascending: true })
        .order('game_time', { ascending: true }),
    ]);
    setMyGames(mine || []);
    setUpcoming(sched || []);
    setProfiles(allProfiles);
    setSchedule(sheet || []);
    setScheduleMissing(!!sheetErr);
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

  async function handleAddScheduleRow() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('scheduled_games')
      .insert({ game_date: today })
      .select()
      .single();
    if (error) {
      setToast(`${error.message} — make sure the schedule SQL has been run in Supabase.`);
      return;
    }
    setSchedule((prev) => [...prev, data]);
  }

  async function handleScheduleChange(id, field, value) {
    const { error } = await supabase
      .from('scheduled_games')
      .update({ [field]: value || null })
      .eq('id', id);
    if (error) {
      setToast(error.message);
      return;
    }
    setSchedule((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value || null } : r));
  }

  async function handleScheduleDelete(id) {
    const { error } = await supabase.from('scheduled_games').delete().eq('id', id);
    if (error) {
      setToast(error.message);
      return;
    }
    setSchedule((prev) => prev.filter((r) => r.id !== id));
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
            <h3 className={styles.groupTitle}>League Schedule</h3>
            {scheduleMissing ? (
              <p className={styles.empty}>
                Schedule sheet unavailable — run supabase/2026-07-07_schedule_sheet.sql in Supabase to enable it.
              </p>
            ) : (
              <>
                <div className={styles.sheetWrap}>
                  <table className={styles.sheet}>
                    <thead>
                      <tr>
                        <th className={styles.sheetTh}>Date</th>
                        <th className={styles.sheetTh}>Time:</th>
                        <th className={styles.sheetTh}>Home</th>
                        <th className={styles.sheetTh}>Away</th>
                        <th className={styles.sheetTh}>Assigned?</th>
                        {isAdmin && <th className={styles.sheetTh}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.length === 0 ? (
                        <tr>
                          <td className={styles.sheetCell} colSpan={isAdmin ? 6 : 5}>
                            <span className={styles.empty}>No games scheduled yet.</span>
                          </td>
                        </tr>
                      ) : (
                        schedule.map((row) => (
                          <SheetRow
                            key={row.id}
                            row={row}
                            isAdmin={isAdmin}
                            onChange={handleScheduleChange}
                            onDelete={handleScheduleDelete}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {isAdmin && (
                  <button type="button" className={styles.addRowBtn} onClick={handleAddScheduleRow}>
                    + Add Game
                  </button>
                )}
              </>
            )}
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
