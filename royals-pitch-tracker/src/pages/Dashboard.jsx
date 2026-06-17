import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import GameCard from '../components/GameCard';
import Toast from '../components/Toast';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);

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
      .select(`
        *,
        pitches(count),
        rosters(count)
      `)
      .order('date', { ascending: false });

    if (error) {
      setToast(error.message);
      setLoading(false);
      return;
    }

    // Compute pitch counts and inning counts
    const enriched = await Promise.all(
      (data || []).map(async (g) => {
        const { count: pitchCount } = await supabase
          .from('pitches')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', g.id);

        const { data: innings } = await supabase
          .from('pitches')
          .select('inning')
          .eq('game_id', g.id)
          .order('inning', { ascending: false })
          .limit(1);

        return {
          ...g,
          pitch_count: pitchCount ?? 0,
          inning_count: innings?.[0]?.inning ?? '—',
        };
      })
    );

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

        {loading ? (
          <p className={styles.loading}>Loading...</p>
        ) : games.length === 0 ? (
          <p className={styles.empty}>No games yet. Create one above.</p>
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
                </tr>
              </thead>
              <tbody>
                {sortedGames.map((g) => (
                  <GameCard key={g.id} game={g} currentEmail={currentEmail} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
