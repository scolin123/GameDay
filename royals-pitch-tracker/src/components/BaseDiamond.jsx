import styles from './BaseDiamond.module.css';

// runners: '000' = empty, '1' = runner on base
// index 0=1B, 1=2B, 2=3B
export default function BaseDiamond({ runners, onToggle }) {
  const r1 = runners[0] === '1';
  const r2 = runners[1] === '1';
  const r3 = runners[2] === '1';

  const baseFill = (occupied) => occupied ? '#2563eb' : '#ffffff';
  const baseStroke = '#cbd5e1';

  // Diamond layout: 2B top, 3B left, 1B right, home bottom
  return (
    <svg viewBox="0 0 160 160" width="160" height="160" className={styles.svg}>
      {/* Home plate (not clickable) */}
      <polygon
        points="80,140 70,130 80,120 90,130"
        fill="#e2e8f0"
        stroke={baseStroke}
        strokeWidth="1.5"
      />

      {/* 1B — right */}
      <rect
        x="105" y="70" width="20" height="20"
        fill={baseFill(r1)}
        stroke={r1 ? '#2563eb' : baseStroke}
        strokeWidth="1.5"
        style={{ cursor: 'pointer' }}
        onClick={() => onToggle(0)}
        transform="rotate(45 115 80)"
      />

      {/* 2B — top */}
      <rect
        x="70" y="25" width="20" height="20"
        fill={baseFill(r2)}
        stroke={r2 ? '#2563eb' : baseStroke}
        strokeWidth="1.5"
        style={{ cursor: 'pointer' }}
        onClick={() => onToggle(1)}
        transform="rotate(45 80 35)"
      />

      {/* 3B — left */}
      <rect
        x="35" y="70" width="20" height="20"
        fill={baseFill(r3)}
        stroke={r3 ? '#2563eb' : baseStroke}
        strokeWidth="1.5"
        style={{ cursor: 'pointer' }}
        onClick={() => onToggle(2)}
        transform="rotate(45 45 80)"
      />

      {/* Base path lines */}
      <polyline
        points="80,130 115,80 80,35 45,80 80,130"
        fill="none"
        stroke="#e2e8f0"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
    </svg>
  );
}
