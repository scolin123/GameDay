import styles from './BaseDiamond.module.css';

// runners[0]=1B, runners[1]=2B, runners[2]=3B
export default function BaseDiamond({ runners, onToggle }) {
  const r1 = runners[0] === '1';
  const r2 = runners[1] === '1';
  const r3 = runners[2] === '1';

  const baseFill = (on) => on ? '#2563eb' : 'white';
  const baseEdge = (on) => on ? '#1d4ed8' : '#94a3b8';

  // Field coordinates
  // Home: (110, 197), 1B: (174, 132), 2B: (110, 67), 3B: (46, 132)
  // Field fan: M 110,197 L 4,83 Q 110,5 216,83 Z

  return (
    <svg viewBox="0 0 220 202" className={styles.svg}>
      <defs>
        {/* Diagonal checkerboard mowing pattern */}
        <pattern id="bd-mow" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="18" height="18" fill="#2d6a34"/>
          <rect width="9" height="9" fill="#347a3c"/>
          <rect x="9" y="9" width="9" height="9" fill="#347a3c"/>
        </pattern>
        <clipPath id="bd-clip">
          <path d="M 110,197 L 4,83 Q 110,5 216,83 Z"/>
        </clipPath>
        {/* Subtle infield grass stripe */}
        <pattern id="bd-if" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill="#3a8c48"/>
          <rect width="7" height="14" fill="#419950"/>
        </pattern>
      </defs>

      {/* === OUTFIELD === */}
      {/* Base dark green fill */}
      <path d="M 110,197 L 4,83 Q 110,5 216,83 Z"
        fill="#2d6a34" stroke="#1b4620" strokeWidth="2.5"/>
      {/* Mowing pattern overlay */}
      <path d="M 110,197 L 4,83 Q 110,5 216,83 Z"
        fill="url(#bd-mow)" clipPath="url(#bd-clip)"/>

      {/* === INFIELD DIRT === */}
      {/* Arc from 3B→1B (radius ~91 from home), closed at home */}
      <path d="M 110,197 L 46,132 A 91,91 0 0,1 174,132 Z"
        fill="#c4783e"/>

      {/* === INFIELD GRASS DIAMOND === */}
      <polygon points="110,67 174,132 110,197 46,132"
        fill="url(#bd-if)"/>

      {/* === LINES === */}
      {/* Foul lines */}
      <line x1="110" y1="197" x2="4" y2="83"
        stroke="white" strokeWidth="1.5" opacity="0.85"/>
      <line x1="110" y1="197" x2="216" y2="83"
        stroke="white" strokeWidth="1.5" opacity="0.85"/>
      {/* Base paths inside diamond */}
      <line x1="46" y1="132" x2="110" y2="67"
        stroke="white" strokeWidth="0.8" opacity="0.45"/>
      <line x1="110" y1="67" x2="174" y2="132"
        stroke="white" strokeWidth="0.8" opacity="0.45"/>

      {/* === PITCHER'S MOUND === */}
      <ellipse cx="110" cy="133" rx="12" ry="9"
        fill="#c4783e" stroke="#a0622e" strokeWidth="1"/>
      <circle cx="110" cy="133" r="3.5" fill="#a0622e"/>

      {/* === HOME PLATE === */}
      <polygon points="110,203 103,197 103,190 117,190 117,197"
        fill="white" stroke="#94a3b8" strokeWidth="0.8"/>

      {/* === BASES === */}
      {/* 1B — right (index 0) */}
      <g onClick={() => onToggle(0)} style={{ cursor: 'pointer' }}>
        <rect x="166" y="124" width="16" height="16"
          fill={baseFill(r1)} stroke={baseEdge(r1)} strokeWidth="1.5"
          transform="rotate(45 174 132)"/>
      </g>

      {/* 2B — top (index 1) */}
      <g onClick={() => onToggle(1)} style={{ cursor: 'pointer' }}>
        <rect x="102" y="59" width="16" height="16"
          fill={baseFill(r2)} stroke={baseEdge(r2)} strokeWidth="1.5"
          transform="rotate(45 110 67)"/>
      </g>

      {/* 3B — left (index 2) */}
      <g onClick={() => onToggle(2)} style={{ cursor: 'pointer' }}>
        <rect x="38" y="124" width="16" height="16"
          fill={baseFill(r3)} stroke={baseEdge(r3)} strokeWidth="1.5"
          transform="rotate(45 46 132)"/>
      </g>
    </svg>
  );
}
