import styles from './PitchTypeButtons.module.css';

const PRIMARY = [
  { code: 'FB', label: 'Fastball', color: '#dc2626' },
  { code: 'OS', label: 'Offspeed', color: '#f59e0b' },
  { code: 'UN', label: 'Unknown',  color: '#94a3b8' },
];

const SECONDARY = [
  { code: 'SK', label: 'Sinker',    color: '#0891b2' },
  { code: 'CT', label: 'Cutter',    color: '#ca8a04' },
  { code: 'SL', label: 'Slider',    color: '#ea580c' },
  { code: 'CB', label: 'Curveball', color: '#2563eb' },
  { code: 'SV', label: 'Slurve',    color: '#7c3aed' },
  { code: 'SW', label: 'Sweeper',   color: '#db2777' },
  { code: 'CH', label: 'Changeup',  color: '#9333ea' },
  { code: 'SP', label: 'Splitter',  color: '#059669' },
  { code: 'OT', label: 'Other',     color: '#64748b' },
];

function PitchBtn({ pt, selected, onChange, roundTop, roundBottom }) {
  const isSelected = selected === pt.code;
  return (
    <button
      type="button"
      className={`${styles.btn} ${roundTop ? styles.roundTop : ''} ${roundBottom ? styles.roundBottom : ''}`}
      style={isSelected ? { background: pt.color, color: '#fff', borderColor: pt.color } : {}}
      onClick={() => onChange(pt.code)}
    >
      {pt.label}
    </button>
  );
}

export default function PitchTypeButtons({ selected, onChange }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        {PRIMARY.map((pt, i) => (
          <PitchBtn key={pt.code} pt={pt} selected={selected} onChange={onChange}
            roundTop={i === 0} roundBottom={i === PRIMARY.length - 1} />
        ))}
      </div>

      <div className={styles.subheading}>Specific Type</div>

      <div className={styles.group}>
        {SECONDARY.map((pt, i) => (
          <PitchBtn key={pt.code} pt={pt} selected={selected} onChange={onChange}
            roundTop={i === 0} roundBottom={i === SECONDARY.length - 1} />
        ))}
      </div>
    </div>
  );
}
