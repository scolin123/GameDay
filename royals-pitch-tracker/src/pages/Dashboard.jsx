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

  useEffect(() => {
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

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.navBrand}>Guelph Royals Pitch Tracker</span>
        <div className={styles.navRight}>
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
                  <th>Date</th>
                  <th>Matchup</th>
                  <th className={styles.numHeader}>Pitches</th>
                  <th className={styles.numHeader}>Innings</th>
                  <th className={styles.actionsHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <GameCard key={g.id} game={g} />
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
