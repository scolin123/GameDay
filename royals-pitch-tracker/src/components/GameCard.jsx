import { Link } from 'react-router-dom';
import { exportGameCsv } from '../lib/exportCsv';
import { supabase } from '../lib/supabase';
import { STATUS, STATUS_LABEL, STATUS_COLOR } from '../lib/gameStatus';
import styles from './GameCard.module.css';

const STATUS_ORDER = [STATUS.IN_PROGRESS, STATUS.COMPLETED, STATUS.COMPLETED_UPLOADED];

export default function GameCard({ game, currentEmail, onStatusChange, isAdmin }) {
  const status = game.status || STATUS.IN_PROGRESS;

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-CA', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  }

  async function handleStatusChange(next) {
    await supabase.from('games').update({ status: next }).eq('id', game.id);
    onStatusChange(game.id, next);
  }

  return (
    <tr className={styles.row}>
      <td className={styles.date}>{formatDate(game.date)}</td>
      <td className={styles.matchup}>{game.away_team} @ {game.home_team}</td>
      <td className={styles.loggedBy}>
        {game.logged_by
          ? game.logged_by === currentEmail
            ? <span className={styles.loggedByYou}>{currentEmail}</span>
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
      {isAdmin && (
        <td className={styles.statusCell}>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.statusBtn} ${status === s ? styles.statusBtnActive : ''}`}
              style={status === s ? { background: STATUS_COLOR[s], borderColor: STATUS_COLOR[s] } : undefined}
              onClick={() => handleStatusChange(s)}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </td>
      )}
    </tr>
  );
}
