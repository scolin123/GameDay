import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ADMIN_CODE, ensureProfile, fetchProfiles, isAdminUser, displayName } from '../lib/profile';
import { fetchMyTeams, fetchTeamMemberIds, joinTeamByCode } from '../lib/teams';
import { weekStart, addDays, formatWeekLabel, inWeek, todayStr } from '../lib/week';
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

function ScheduleSummaryRow({ row, profiles }) {
  return (
    <div className={styles.gameRow}>
      <span className={styles.gameDate}>
        {formatSheetDate(row.game_date)}{row.game_time ? ` · ${row.game_time}` : ''}
      </span>
      <span className={styles.gameMatchup}>{row.away_team || '—'} @ {row.home_team || '—'}</span>
      <span className={styles.gameAssigned}>
        {row.assigned_to ? displayName(row.assigned_to, profiles) : '—'}
      </span>
      {!row.published && (
        <span className={`${styles.stateChip} ${styles.stateChipDraft}`}>Draft</span>
      )}
    </div>
  );
}

function SheetRow({ row, isAdmin, members, profiles, onChange, onDelete }) {
  const [time, setTime] = useState(row.game_time || '');

  if (!isAdmin) {
    return (
      <tr className={styles.sheetRow}>
        <td className={styles.sheetCell}>{formatSheetDate(row.game_date)}</td>
        <td className={styles.sheetCell}>{row.game_time || '—'}</td>
        <td className={styles.sheetCell}>{row.home_team || '—'}</td>
        <td className={styles.sheetCell}>{row.away_team || '—'}</td>
        <td className={styles.sheetCell}>{row.assigned_to ? displayName(row.assigned_to, profiles) : '—'}</td>
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
        <select
          className={`${styles.sheetSelect} ${styles.sheetInputPlain}`}
          value={row.assigned_to || ''}
          onChange={(e) => onChange(row.id, 'assigned_to', e.target.value)}
        >
          <option value="">—</option>
          {(members || []).map((m) => (
            <option key={m.user_id} value={m.email}>{m.username || m.email}</option>
          ))}
        </select>
      </td>
      <td className={`${styles.sheetCell} ${styles.sheetDeleteCell}`}>
        <span className={`${styles.stateChip} ${row.published ? styles.stateChipPublished : styles.stateChipDraft}`}>
          {row.published ? 'Published' : 'Draft'}
        </span>
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
  const [schedule, setSchedule] = useState([]);
  const [scheduleMissing, setScheduleMissing] = useState(false);
  const [loadingGames, setLoadingGames] = useState(true);
  const [toast, setToast] = useState('');
  const [myTeams, setMyTeams] = useState([]);
  const [teamMemberIds, setTeamMemberIds] = useState([]);
  const [teamCode, setTeamCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(weekStart(todayStr()));
  const [publishing, setPublishing] = useState(false);

  async function load() {
    const { user, profile: prof } = await ensureProfile();
    if (!user) return;
    setEmail(user.email);
    setProfile(prof);
    setUsername(prof?.username || '');

    const [{ data: mine }, allProfiles, { data: sheet, error: sheetErr }, teams] = await Promise.all([
      supabase.from('games').select('*').eq('logged_by', user.email).order('date', { ascending: false }),
      fetchProfiles(),
      supabase.from('scheduled_games').select('*')
        .order('game_date', { ascending: true })
        .order('game_time', { ascending: true }),
      fetchMyTeams(user.id),
    ]);
    setMyGames(mine || []);
    setProfiles(allProfiles);
    setSchedule(sheet || []);
    setScheduleMissing(!!sheetErr);
    setMyTeams(teams);
    if (teams[0]) setTeamMemberIds(await fetchTeamMemberIds(teams[0].id));
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

  async function handleAddScheduleRow() {
    // Default to today when building the current week, otherwise the week's Monday
    const defaultDate = inWeek(todayStr(), selectedWeek) ? todayStr() : selectedWeek;
    const insert = { game_date: defaultDate };
    if (myTeams[0]) insert.team_id = myTeams[0].id;
    const { data, error } = await supabase
      .from('scheduled_games')
      .insert(insert)
      .select()
      .single();
    if (error) {
      setToast(`${error.message} — make sure the schedule SQL has been run in Supabase.`);
      return;
    }
    setSchedule((prev) => [...prev, data]);
  }

  async function handlePublishWeek() {
    const draftIds = schedule
      .filter((r) => inWeek(r.game_date, selectedWeek) && !r.published)
      .map((r) => r.id);
    if (draftIds.length === 0) {
      setToast('Nothing new to publish this week.');
      return;
    }
    setPublishing(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('scheduled_games')
      .update({ published: true, published_at: now })
      .in('id', draftIds);
    setPublishing(false);
    if (error) {
      setToast(error.message);
      return;
    }
    const notified = new Set(
      schedule
        .filter((r) => draftIds.includes(r.id) && r.assigned_to)
        .map((r) => r.assigned_to)
    ).size;
    setSchedule((prev) => prev.map((r) =>
      draftIds.includes(r.id) ? { ...r, published: true, published_at: now } : r
    ));
    setToast(`Published ${draftIds.length} game${draftIds.length === 1 ? '' : 's'} — ${notified} ${notified === 1 ? 'person' : 'people'} notified`);
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

  const teamMembers = profiles.filter((p) => teamMemberIds.includes(p.user_id));
  const weekRows = schedule
    .filter((r) => inWeek(r.game_date, selectedWeek))
    .sort((a, b) =>
      (a.game_date || '').localeCompare(b.game_date || '')
      || (a.game_time || '').localeCompare(b.game_time || ''));
  const weekDraftCount = weekRows.filter((r) => !r.published).length;
  const weekHasPublished = weekRows.some((r) => r.published);
  const myWeekRows = weekRows.filter((r) => r.assigned_to === email && r.published);
  const myScheduledUpcoming = schedule.filter((r) =>
    r.assigned_to === email && r.published && (r.game_date || '') >= todayStr()).length;

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
            Schedule{myScheduledUpcoming > 0 ? ` (${myScheduledUpcoming} assigned)` : ''}
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
            <div className={styles.weekNav}>
              <button
                type="button"
                className={styles.weekNavBtn}
                onClick={() => setSelectedWeek((w) => addDays(w, -7))}
                title="Previous week"
              >
                ‹
              </button>
              <div className={styles.weekLabel}>
                <span className={styles.weekLabelTitle}>Week of {formatWeekLabel(selectedWeek)}</span>
                {isAdmin && (
                  <span className={styles.weekLabelSub}>
                    {weekDraftCount > 0
                      ? `${weekDraftCount} draft${weekDraftCount === 1 ? '' : 's'} not yet published`
                      : weekHasPublished ? 'All published ✓' : 'No games yet'}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={styles.weekNavBtn}
                onClick={() => setSelectedWeek((w) => addDays(w, 7))}
                title="Next week"
              >
                ›
              </button>
              <button
                type="button"
                className={styles.thisWeekBtn}
                onClick={() => setSelectedWeek(weekStart(todayStr()))}
              >
                This week
              </button>
            </div>

            {scheduleMissing ? (
              <p className={styles.empty}>
                Schedule sheet unavailable — run the schedule + teams SQL in Supabase to enable it.
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
                      {weekRows.length === 0 ? (
                        <tr>
                          <td className={styles.sheetCell} colSpan={isAdmin ? 6 : 5}>
                            <span className={styles.empty}>
                              {isAdmin ? 'No games this week yet — add some below.' : 'No games published for this week.'}
                            </span>
                          </td>
                        </tr>
                      ) : (
                        weekRows.map((row) => (
                          <SheetRow
                            key={row.id}
                            row={row}
                            isAdmin={isAdmin}
                            members={teamMembers}
                            profiles={profiles}
                            onChange={handleScheduleChange}
                            onDelete={handleScheduleDelete}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {isAdmin && (
                  <div className={styles.sheetActions}>
                    <button type="button" className={styles.addRowBtn} onClick={handleAddScheduleRow}>
                      + Add Game
                    </button>
                    <button
                      type="button"
                      className={styles.publishBtn}
                      onClick={handlePublishWeek}
                      disabled={publishing || weekDraftCount === 0}
                    >
                      {publishing
                        ? 'Publishing…'
                        : weekDraftCount > 0 ? `Publish Week (${weekDraftCount})` : 'Published ✓'}
                    </button>
                  </div>
                )}
              </>
            )}
            <h3 className={styles.groupTitle}>Assigned to you this week</h3>
            {myWeekRows.length === 0 ? (
              <p className={styles.empty}>No games assigned to you this week.</p>
            ) : (
              <div className={`${styles.gameList} ${styles.gameListHighlight}`}>
                {myWeekRows.map((r) => <ScheduleSummaryRow key={r.id} row={r} profiles={profiles} />)}
              </div>
            )}
          </div>
        )}
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
