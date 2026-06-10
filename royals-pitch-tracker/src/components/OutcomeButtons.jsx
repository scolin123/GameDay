import styles from './OutcomeButtons.module.css';

const GROUPS = [
  {
    label: 'Ball',
    type: 'ball',
    outcomes: ['Ball', 'Walk', 'Hit By Pitch'],
  },
  {
    label: 'Strike',
    type: 'strike',
    outcomes: ['Called Strike', 'Swinging Strike', 'Foul'],
  },
  {
    label: 'Hit',
    type: 'hit',
    outcomes: ['Single', 'Double', 'Triple', 'Home Run'],
  },
  {
    label: 'Out',
    type: 'out',
    outcomes: [
      'Groundout', 'Flyout', 'Lineout',
      'Strikeout Swinging', 'Strikeout Looking',
      'Sacrifice Fly', 'Sacrifice Bunt',
      'Double Play', "Fielder's Choice", 'Error',
    ],
  },
];

export default function OutcomeButtons({ selected, onChange }) {
  return (
    <div className={styles.container}>
      {GROUPS.map((group) => (
        <div key={group.type} className={`${styles.group} ${styles[group.type]}`}>
          <div className={styles.groupLabel}>{group.label}</div>
          <div className={styles.buttons}>
            {group.outcomes.map((outcome) => (
              <button
                key={outcome}
                type="button"
                className={`${styles.btn} ${selected === outcome ? styles.selected : ''} ${styles[group.type + 'Btn']}`}
                onClick={() => onChange(outcome)}
              >
                {outcome}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
