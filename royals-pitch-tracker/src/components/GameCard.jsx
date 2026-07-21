import { Link } from 'react-router-dom';
import { exportGameCsv } from '../lib/exportCsv';
import { supabase } from '../lib/supabase';
import { STATUS, STATUS_LABEL, STATUS_COLOR } from '../lib/gameStatus';
import { displayName } from '../lib/profile';
import styles from './GameCard.module.css';

const STATUS_ORDER = [STATUS.IN_PROGRESS, STATUS.COMPLETED, STATUS.COMPLETED_UPLOADED];

export default function GameCard({ game, currentEmail, profiles, onStatusChange, onDateChange, isAdmin, onDeleteRequest, onError }) {
  const status = game.status || STATUS.IN_PROGRESS;

  async function handleDateChange(newDate) {
    if (!newDate || newDate === game.date) return;
    const { error } = await supabase.from('games').update({ date: newDate }).eq('id', game.id);
    if (error) {
      onError?.(error.message);
      return;
    }
    onDateChange(game.id, newDate);
  }

  async function handleStatusChange(next) {
    const { error } = await supabase.from('games').update({ status: next }).eq('id', game.id);
    if (error) {
      onError?.(error.message);
      return;
    }
    onStatusChange(game.id, next);
  }

  return (
    <tr className={styles.row}>
      <td className={styles.date}>
        <input
          type="date"
          className={styles.dateInput}
          value={(game.date || '').slice(0, 10)}
          onChange={(e) => handleDateChange(e.target.value)}
        />
      </td>
      <td className={styles.matchup}>{game.away_team} @ {game.home_team}</td>
      <td className={styles.loggedBy}>
        {game.logged_by
          ? game.logged_by === currentEmail
            ? <span className={styles.loggedByYou} title={currentEmail}>{displayName(currentEmail, profiles)}</span>
            : <span title={game.logged_by}>{displayName(game.logged_by, profiles).split('@')[0]}</span>
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
        {isAdmin && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.deleteBtnInline}`}
            onClick={() => onDeleteRequest(game)}
          >
            Delete
          </button>
        )}
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
