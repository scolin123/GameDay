import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { STATUS, STATUS_LABEL, STATUS_COLOR } from '../lib/gameStatus';
import GameCard from '../components/GameCard';
import Toast from '../components/Toast';
import styles from './Dashboard.module.css';
import deleteStyles from './DeleteConfirmModal.module.css';

const FILTER_STATUSES = [STATUS.IN_PROGRESS, STATUS.COMPLETED, STATUS.COMPLETED_UPLOADED];

const ADMIN_EMAILS = ['colin@gordshier.com', 'colin@shier.ca', 'christiansturgeon06@gmail.com'];

export default function Dashboard() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentEmail(user?.email || '');
    });
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

    const { data: pitchRows, error: pitchErr } = await supabase
      .from('pitches')
      .select('game_id, inning')
      .in('game_id', gameIds.length > 0 ? gameIds : ['00000000-0000-0000-0000-000000000000'])
      .limit(10000);

    if (pitchErr) console.error('Pitch fetch error:', pitchErr.message);

    const pitchCountByGame = {};
    const maxInningByGame = {};
    (pitchRows || []).forEach(({ game_id, inning }) => {
      pitchCountByGame[game_id] = (pitchCountByGame[game_id] || 0) + 1;
      if (maxInningByGame[game_id] === undefined || inning > maxInningByGame[game_id]) {
        maxInningByGame[game_id] = inning;
      }
    });

    const enriched = (data || []).map((g) => ({
      ...g,
      pitch_count: pitchCountByGame[g.id] ?? 0,
      inning_count: maxInningByGame[g.id] ?? '—',
    }));

    setGames(enriched);
    setLoading(false);
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

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.navBrand}>Guelph Royals Pitch Tracker</span>
        <div className={styles.navRight}>
          {currentEmail && <span className={styles.navEmail}>{currentEmail}</span>}
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

        {ADMIN_EMAILS.includes(currentEmail) && (
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
        ) : games.length === 0 ? (
          <p className={styles.empty}>No games yet. Create one above.</p>
        ) : statusFilter && visibleGames.length === 0 ? (
          <p className={styles.filterEmpty}>No {STATUS_LABEL[statusFilter].toLowerCase()} games.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.sortableHeader} onClick={() => handleSort('date')}>
                    Date {sortBy === 'date' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th>Matchup</th>
                  <th className={styles.sortableHeader} onClick={() => handleSort('logged_by')}>
                    Logged By {sortBy === 'logged_by' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th className={styles.numHeader}>Pitches</th>
                  <th className={styles.numHeader}>Innings</th>
                  <th className={styles.actionsHeader}>Actions</th>
                  {ADMIN_EMAILS.includes(currentEmail) && (
                    <th className={styles.statusHeader}>Status</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleGames.map((g) => (
                  <GameCard
                    key={g.id}
                    game={g}
                    currentEmail={currentEmail}
                    onStatusChange={handleStatusChange}
                    isAdmin={ADMIN_EMAILS.includes(currentEmail)}
                    onDeleteRequest={setDeleteTarget}
                    onError={setToast}
                  />
                ))}
              </tbody>
            </table>
          </div>
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
