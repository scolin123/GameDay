import styles from './ChangePitcherModal.module.css';

export default function ChangePitcherModal({ pitchers, currentPitcher, onSelect, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Change Pitcher</h2>
          <button onClick={onClose} className={styles.closeBtn}>x</button>
        </div>
        <div className={styles.list}>
          {pitchers.length === 0 && (
            <p className={styles.empty}>No pitchers on roster.</p>
          )}
          {pitchers.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.pitcherBtn} ${p.player_name === currentPitcher ? styles.current : ''}`}
              onClick={() => onSelect(p)}
            >
              <span className={styles.name}>{p.player_name}</span>
              <span className={styles.throws}>{p.throws ? `Throws ${p.throws}` : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
