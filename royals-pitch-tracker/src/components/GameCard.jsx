import { Link } from 'react-router-dom';
import { exportGameCsv } from '../lib/exportCsv';
import { supabase } from '../lib/supabase';
import styles from './GameCard.module.css';

export default function GameCard({ game, currentEmail }) {
  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  }

  return (
    <tr className={styles.row}>
      <td className={styles.date}>{formatDate(game.date)}</td>
      <td className={styles.matchup}>{game.away_team} @ {game.home_team}</td>
      <td className={styles.loggedBy}>
        {game.logged_by
          ? game.logged_by === currentEmail
            ? <span className={styles.loggedByYou}>You</span>
            : game.logged_by.split('@')[0]
          : <span className={styles.loggedByNone}>—</span>}
      </td>
      <td className={styles.num}>{game.pitch_count ?? '—'}</td>
      <td className={styles.num}>{game.inning_count ?? '—'}</td>
      <td className={styles.actions}>
        <Link to={`/games/${game.id}/live`} className={styles.actionBtn}>Score</Link>
        <Link to={`/games/${game.id}/log`} className={styles.actionBtn}>Log</Link>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => exportGameCsv(game.id, supabase)}
        >
          Export CSV
        </button>
      </td>
    </tr>
  );
}
