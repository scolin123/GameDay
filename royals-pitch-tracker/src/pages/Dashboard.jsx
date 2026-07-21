import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { STATUS, STATUS_LABEL, STATUS_COLOR } from '../lib/gameStatus';
import { ensureProfile, fetchProfiles, isAdminUser, displayName } from '../lib/profile';
import { todayStr } from '../lib/week';
import GameCard from '../components/GameCard';
import Toast from '../components/Toast';
import styles from './Dashboard.module.css';
import gc from '../components/GameCard.module.css';
import deleteStyles from './DeleteConfirmModal.module.css';

const FILTER_STATUSES = [STATUS.IN_PROGRESS, STATUS.COMPLETED, STATUS.COMPLETED_UPLOADED];

function formatUpcomingDate(d) {
  if (!d) return '—';
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

// MM/DD/YYYY, matching how the started games render their date column
function formatCurrentDate(d) {
  if (!d) return '—';
  return new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  });
}

// Published schedule games still in the future. Read-only on purpose: a game
// can't be set up or scored until its date arrives, at which point it drops
// into the Current table below and picks up a Set Up & Score action there.
function UpcomingTable({ rows, profiles }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Matchup</th>
            <th>Assigned To</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={styles.upcomingRow}>
              <td className={styles.upcomingDate}>{formatUpcomingDate(r.game_date)}</td>
              <td className={styles.upcomingTime}>{r.game_time || '—'}</td>
              <td className={styles.matchup}>{r.away_team || '—'} @ {r.home_team || '—'}</td>
              <td className={styles.upcomingAssigned}>
                {r.assigned_to ? displayName(r.assigned_to, profiles) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A scheduled game whose date has arrived but that nobody has set up yet. Sits
// in the Current table alongside real games so it doesn't just disappear once
// it drops out of Upcoming.
function PendingGameRow({ row, isAdmin, currentEmail, profiles, onSetUp }) {
  const assignedToMe = row.assigned_to && row.assigned_to === currentEmail;
  return (
    <tr className={gc.row}>
      <td className={gc.date}>{formatCurrentDate(row.game_date)}</td>
      <td className={gc.matchup}>{row.away_team || '—'} @ {row.home_team || '—'}</td>
      <td className={gc.loggedBy}>
        {row.assigned_to ? (
          <span
            className={assignedToMe ? styles.assignedYou : undefined}
            title={row.assigned_to}
          >
            {displayName(row.assigned_to, profiles)}
          </span>
        ) : (
          <span className={gc.loggedByNone}>—</span>
        )}
      </td>
      <td className={gc.num}>—</td>
      <td className={gc.num}>—</td>
      <td className={gc.actions}>
        <button type="button" className={gc.actionBtn} onClick={() => onSetUp(row)}>
          Set Up &amp; Score
        </button>
      </td>
      {isAdmin && <td className={gc.statusCell} />}
    </tr>
  );
}

function GamesTable({ games, sortBy, sortAsc, onSort, isAdmin, currentEmail, profiles,
                      onStatusChange, onDateChange, onDeleteRequest, onError, onSetUp }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.sortableHeader} onClick={() => onSort('date')}>
              Date {sortBy === 'date' ? (sortAsc ? '↑' : '↓') : ''}
            </th>
            <th>Matchup</th>
            <th className={styles.sortableHeader} onClick={() => onSort('logged_by')}>
              Logged By {sortBy === 'logged_by' ? (sortAsc ? '↑' : '↓') : ''}
            </th>
            <th className={styles.numHeader}>Pitches</th>
            <th className={styles.numHeader}>Innings</th>
            <th className={styles.actionsHeader}>Actions</th>
            {isAdmin && <th className={styles.statusHeader}>Status</th>}
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (g.__pending ? (
            <PendingGameRow
              key={`p-${g.id}`}
              row={g}
              isAdmin={isAdmin}
              currentEmail={currentEmail}
              profiles={profiles}
              onSetUp={onSetUp}
            />
          ) : (
            <GameCard
              key={g.id}
              game={g}
              currentEmail={currentEmail}
              profiles={profiles}
              onStatusChange={onStatusChange}
              onDateChange={onDateChange}
              isAdmin={isAdmin}
              onDeleteRequest={onDeleteRequest}
              onError={onError}
            />
          )))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [myProfile, setMyProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [sortBy, setSortBy] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [scheduledRows, setScheduledRows] = useState([]);
  const [myScheduledCount, setMyScheduledCount] = useState(0);
  const [notifSeen, setNotifSeen] = useState(() =>
    parseInt(localStorage.getItem('rpt-notif-seen') || '0', 10));

  useEffect(() => {
    ensureProfile().then(({ user, profile }) => {
      setCurrentEmail(user?.email || '');
      setMyProfile(profile);
      const myEmail = (user?.email || '').toLowerCase();
      if (!myEmail) return;
      const today = todayStr();
      // Only published schedule rows are visible to non-admins and ping the assignee.
      // Past rows are needed too: once a game's date arrives it moves down into
      // the Current table, where it can finally be set up and scored.
      supabase.from('scheduled_games')
        .select('*')
        .eq('published', true)
        .order('game_date', { ascending: true })
        .then(({ data }) => {
          if (!data) return;
          setScheduledRows(data);
          setMyScheduledCount(data.filter((r) =>
            (r.assigned_to || '').toLowerCase() === myEmail && (r.game_date || '') >= today).length);
        });
    });
    fetchProfiles().then(setProfiles);
    loadGames();
  }, []);

  async function loadGames() {
    setLoading(true);
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      setToast(error.message);
      setLoading(false);
      return;
    }

    const gameIds = (data || []).map((g) => g.id);

    const pitchCountByGame = {};
    const maxInningByGame = {};

    // One aggregated row per game, computed in the database (never truncated)
    const { data: summaryRows, error: summaryErr } = await supabase
      .from('game_pitch_summary')
      .select('game_id, pitch_count, inning_count')
      .in('game_id', gameIds.length > 0 ? gameIds : ['00000000-0000-0000-0000-000000000000']);

    if (!summaryErr) {
      (summaryRows || []).forEach(({ game_id, pitch_count, inning_count }) => {
        pitchCountByGame[game_id] = pitch_count;
        maxInningByGame[game_id] = inning_count;
      });
    } else {
      // View not created yet (run supabase/2026-07-09_game_pitch_summary.sql).
      // Fall back to the old client-side count, which is wrong past the row cap.
      console.error('game_pitch_summary unavailable, falling back:', summaryErr.message);
      const { data: pitchRows, error: pitchErr } = await supabase
        .from('pitches')
        .select('game_id, inning')
        .in('game_id', gameIds.length > 0 ? gameIds : ['00000000-0000-0000-0000-000000000000'])
        .limit(10000);

      if (pitchErr) console.error('Pitch fetch error:', pitchErr.message);

      (pitchRows || []).forEach(({ game_id, inning }) => {
        pitchCountByGame[game_id] = (pitchCountByGame[game_id] || 0) + 1;
        if (maxInningByGame[game_id] === undefined || inning > maxInningByGame[game_id]) {
          maxInningByGame[game_id] = inning;
        }
      });
    }

    const enriched = (data || []).map((g) => ({
      ...g,
      pitch_count: pitchCountByGame[g.id] ?? 0,
      inning_count: maxInningByGame[g.id] ?? '—',
    }));

    setGames(enriched);
    setLoading(false);
  }

  // Hand the schedule row to the normal New Game flow prefilled, rather than
  // inserting a bare game row — scoring needs rosters set up first.
  function handleSetUpUpcoming(row) {
    navigate('/games/new', {
      state: {
        prefill: {
          date: (row.game_date || '').slice(0, 10),
          home_team: row.home_team || '',
          away_team: row.away_team || '',
          assigned_to: row.assigned_to || '',
        },
      },
    });
  }

  function handleSort(col) {
    if (sortBy === col) {
      setSortAsc((a) => !a);
    } else {
      setSortBy(col);
      setSortAsc(true);
    }
  }

  function handleStatusChange(id, newStatus) {
    setGames((prev) => prev.map((g) => g.id === id ? { ...g, status: newStatus } : g));
  }

  function handleDateChange(id, newDate) {
    setGames((prev) => prev.map((g) => g.id === id ? { ...g, date: newDate } : g));
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('pitches').delete().eq('game_id', deleteTarget.id);
    const { error } = await supabase.from('games').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      setToast(error.message);
      setDeleteTarget(null);
      return;
    }
    setGames((prev) => prev.filter((g) => g.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const sortedGames = [...games].sort((a, b) => {
    let av, bv;
    if (sortBy === 'logged_by') {
      av = (a.logged_by || '').toLowerCase();
      bv = (b.logged_by || '').toLowerCase();
    } else {
      av = a.date || '';
      bv = b.date || '';
    }
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });

  const visibleGames = statusFilter
    ? sortedGames.filter((g) => (g.status || STATUS.IN_PROGRESS) === statusFilter)
    : sortedGames;

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const isAdmin = isAdminUser(currentEmail, myProfile);

  // Notification badge: my unfinished games + upcoming games assigned to me
  const today = todayStr();
  const pendingCount = currentEmail
    ? games.filter((g) => g.logged_by === currentEmail
        && (g.status || STATUS.IN_PROGRESS) === STATUS.IN_PROGRESS).length
    : 0;
  const assignedUpcomingCount = currentEmail
    ? games.filter((g) => g.assigned_to === currentEmail && (g.date || '') >= today).length
    : 0;
  // A scheduled game drops out of the schedule lists once a real game row
  // exists for it, so it isn't offered for set-up twice.
  const gameKeys = new Set(
    games.map((g) => `${(g.date || '').slice(0, 10)}|${g.home_team}|${g.away_team}`)
  );
  const isSetUp = (r) => gameKeys.has(`${(r.game_date || '').slice(0, 10)}|${r.home_team}|${r.away_team}`);

  const upcomingRows = scheduledRows.filter((r) => (r.game_date || '') > today && !isSetUp(r));
  // Date has arrived but nobody has set the game up yet — these sit in Current
  const pendingRows = scheduledRows
    .filter((r) => (r.game_date || '') <= today && !isSetUp(r))
    .map((r) => ({ ...r, __pending: true, date: r.game_date }));

  // Pending rows have no status, so they drop out when a status filter is on.
  // They also have no "logged by", so they only interleave under a date sort.
  let currentItems;
  if (statusFilter) {
    currentItems = visibleGames;
  } else if (sortBy === 'date') {
    currentItems = [...visibleGames, ...pendingRows].sort((a, b) => {
      const av = a.date || '';
      const bv = b.date || '';
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  } else {
    currentItems = [...visibleGames, ...pendingRows];
  }

  const notifCount = pendingCount + assignedUpcomingCount + myScheduledCount;
  // Badge shows only when there's more than the user has already seen; clicking
  // Schedule marks the current count as seen so it clears until something new.
  const showNotif = notifCount > notifSeen;

  function dismissNotif() {
    localStorage.setItem('rpt-notif-seen', String(notifCount));
    setNotifSeen(notifCount);
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.navBrand}>Guelph Royals Pitch Tracker</span>
        <div className={styles.navRight}>
          <Link
            to="/schedule"
            className={styles.navLink}
            title={showNotif ? `${pendingCount} game${pendingCount === 1 ? '' : 's'} to finish, ${assignedUpcomingCount + myScheduledCount} upcoming assigned to you` : undefined}
            onClick={() => { if (notifCount > 0) dismissNotif(); }}
          >
            Schedule
            {showNotif && <span className={styles.notifBadge}>{notifCount}</span>}
          </Link>
          {currentEmail && (
            <Link to="/profile" className={styles.profileBtn}>
              {displayName(currentEmail, profiles) || currentEmail}
            </Link>
          )}
          <button type="button" onClick={handleSignOut} className={styles.signOut}>
            Sign Out
          </button>
        </div>
      </nav>

      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <h1>Games</h1>
          <Link to="/games/new" className={styles.newGameBtn}>New Game</Link>
        </div>

        {isAdmin && (
          <div className={styles.filterRow}>
            <button
              type="button"
              className={`${styles.filterBtn} ${statusFilter === null ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter(null)}
            >
              All
            </button>
            {FILTER_STATUSES.map((s) => {
              const isActive = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  className={`${styles.filterBtn} ${isActive ? styles.filterBtnActive : ''}`}
                  style={isActive ? { background: STATUS_COLOR[s], borderColor: STATUS_COLOR[s], color: '#fff' } : undefined}
                  onClick={() => setStatusFilter(isActive ? null : s)}
                >
                  {STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <p className={styles.loading}>Loading...</p>
        ) : (
          <>
            {upcomingRows.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  Upcoming <span className={styles.sectionCount}>{upcomingRows.length}</span>
                </h2>
                <UpcomingTable rows={upcomingRows} profiles={profiles} />
              </section>
            )}

            <section className={styles.section}>
              {upcomingRows.length > 0 && <h2 className={styles.sectionTitle}>Current</h2>}
              {currentItems.length === 0 ? (
                statusFilter ? (
                  <p className={styles.filterEmpty}>No {STATUS_LABEL[statusFilter].toLowerCase()} games.</p>
                ) : (
                  <p className={styles.empty}>No games yet. Create one above.</p>
                )
              ) : (
                <GamesTable
                  games={currentItems}
                  onSetUp={handleSetUpUpcoming}
                  sortBy={sortBy}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                  isAdmin={isAdmin}
                  currentEmail={currentEmail}
                  profiles={profiles}
                  onStatusChange={handleStatusChange}
                  onDateChange={handleDateChange}
                  onDeleteRequest={setDeleteTarget}
                  onError={setToast}
                />
              )}
            </section>
          </>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />

      {deleteTarget && (
        <div className={deleteStyles.overlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={deleteStyles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={deleteStyles.title}>Delete Game?</h2>
            <p className={deleteStyles.body}>
              Are you sure you want to delete{' '}
              <strong>{deleteTarget.away_team} @ {deleteTarget.home_team}</strong>?
              All pitches for this game will also be deleted. This cannot be undone.
            </p>
            <div className={deleteStyles.actions}>
              <button
                type="button"
                className={deleteStyles.cancelBtn}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={deleteStyles.confirmBtn}
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
