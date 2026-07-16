import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ensureProfile, fetchProfiles, isAdminUser, displayName } from '../lib/profile';
import { fetchMyTeams, fetchTeamMemberIds } from '../lib/teams';
import { weekStart, addDays, formatWeekLabel, inWeek, todayStr } from '../lib/week';
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

function formatSheetDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function GameRow({ game, profiles, showAssigned, isAdmin }) {
  const rawStatus = game.status || STATUS.IN_PROGRESS;
  // Non-admins see uploaded games simply as "Completed" (green)
  const status = (!isAdmin && rawStatus === STATUS.COMPLETED_UPLOADED) ? STATUS.COMPLETED : rawStatus;
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

export default function Schedule() {
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [tab, setTab] = useState('games');
  const [gamesTab, setGamesTab] = useState('assigned');
  const [myGames, setMyGames] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [scheduleMissing, setScheduleMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [myTeams, setMyTeams] = useState([]);
  const [teamMemberIds, setTeamMemberIds] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(weekStart(todayStr()));
  const [publishing, setPublishing] = useState(false);

  async function load() {
    const { user, profile: prof } = await ensureProfile();
    if (!user) return;
    setEmail(user.email);
    setProfile(prof);

    const [{ data: mine }, allProfiles, { data: sheet, error: sheetErr }, teams] = await Promise.all([
      // Games I logged OR am assigned to
      supabase.from('games').select('*')
        .or(`logged_by.eq.${user.email},assigned_to.eq.${user.email}`)
        .order('date', { ascending: false }),
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
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch, setState only after awaits
    load();
  }, []);

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
  // My Games → Assigned tab: published schedule games assigned to me, chronological
  const myAssigned = schedule
    .filter((r) => r.assigned_to === email && r.published)
    .sort((a, b) =>
      (a.game_date || '').localeCompare(b.game_date || '')
      || (a.game_time || '').localeCompare(b.game_time || ''));

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.backLink}>← Dashboard</Link>
        <span className={styles.navTitle}>My Games &amp; Schedule</span>
        <Link to="/profile" className={styles.backLink}>Profile</Link>
        <button type="button" onClick={() => supabase.auth.signOut()} className={styles.signOut}>
          Sign Out
        </button>
      </nav>

      <div className={styles.contentWide}>
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

        {loading ? (
          <p className={styles.loading}>Loading…</p>
        ) : tab === 'games' ? (
          <div className={styles.tabContent}>
            <div className={styles.subTabBar}>
              <button
                type="button"
                className={`${styles.subTabBtn} ${gamesTab === 'assigned' ? styles.subTabBtnActive : ''}`}
                onClick={() => setGamesTab('assigned')}
              >
                Assigned{myAssigned.length > 0 ? ` (${myAssigned.length})` : ''}
              </button>
              <button
                type="button"
                className={`${styles.subTabBtn} ${gamesTab === 'inProgress' ? styles.subTabBtnActive : ''}`}
                onClick={() => setGamesTab('inProgress')}
              >
                In Progress{inProgress.length > 0 ? ` (${inProgress.length})` : ''}
              </button>
              <button
                type="button"
                className={`${styles.subTabBtn} ${gamesTab === 'completed' ? styles.subTabBtnActive : ''}`}
                onClick={() => setGamesTab('completed')}
              >
                Completed{finished.length > 0 ? ` (${finished.length})` : ''}
              </button>
            </div>

            {gamesTab === 'assigned' ? (
              myAssigned.length === 0 ? (
                <p className={styles.empty}>No games assigned to you.</p>
              ) : (
                <div className={styles.gameList}>
                  {myAssigned.map((r) => <ScheduleSummaryRow key={r.id} row={r} profiles={profiles} />)}
                </div>
              )
            ) : gamesTab === 'inProgress' ? (
              inProgress.length === 0 ? (
                <p className={styles.empty}>Nothing in progress. All caught up!</p>
              ) : (
                <div className={`${styles.gameList} ${styles.gameListHighlight}`}>
                  {inProgress.map((g) => <GameRow key={g.id} game={g} profiles={profiles} isAdmin={isAdmin} />)}
                </div>
              )
            ) : (
              finished.length === 0 ? (
                <p className={styles.empty}>No completed games yet.</p>
              ) : (
                <div className={styles.gameList}>
                  {finished.map((g) => <GameRow key={g.id} game={g} profiles={profiles} isAdmin={isAdmin} />)}
                </div>
              )
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

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
