import { useState } from 'react';
import styles from './ChangePitcherModal.module.css';

export default function ChangeBatterModal({ batters, currentBatter, onSelect, onClose }) {
  const [newName, setNewName] = useState('');
  const [isPH, setIsPH] = useState(false);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    onSelect({ player_name: name, bats: '', throws: '', id: null, isPinchHitter: isPH });
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Change Batter</h2>
          <button onClick={onClose} className={styles.closeBtn}>x</button>
        </div>
        <div className={styles.list}>
          {batters.length === 0 && (
            <p className={styles.empty}>No batters on roster.</p>
          )}
          {batters.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`${styles.pitcherBtn} ${b.player_name === currentBatter ? styles.current : ''}`}
              onClick={() => onSelect(b)}
            >
              <span className={styles.name}>{b.player_name}</span>
              <span className={styles.throws}>{b.bats ? `Bats ${b.bats}` : ''}</span>
            </button>
          ))}
          <div className={styles.phToggle}>
            <label className={styles.phLabel}>
              <input
                type="checkbox"
                checked={isPH}
                onChange={(e) => setIsPH(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Add as Pinch Hitter (replaces current slot)
            </label>
          </div>
          <div className={styles.addRow}>
            <input
              className={styles.addInput}
              placeholder={isPH ? 'Pinch hitter name...' : 'Add batter name...'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button type="button" className={styles.addBtn} onClick={handleAdd} disabled={!newName.trim()}>
              {isPH ? 'PH' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
