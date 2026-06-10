import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { exportGameCsv } from '../lib/exportCsv';
import Toast from '../components/Toast';
import styles from './GameLog.module.css';

const PITCH_TYPE_COLORS = {
  FB: '#dc2626',
  OS: '#f59e0b',
  CB: '#2563eb',
  SL: '#ea580c',
  CH: '#9333ea',
  CT: '#ca8a04',
  SK: '#0891b2',
  OT: '#64748b',
  UN: '#94a3b8',
};

const PITCH_TYPE_LABELS = {
  FB: 'Fastball', OS: 'Offspeed', CB: 'Curveball', SL: 'Slider',
  CH: 'Changeup', CT: 'Cutter', SK: 'Sinker', OT: 'Other', UN: 'Unknown',
};

const BALL_OUTCOMES = new Set(['Ball', 'Walk', 'Hit By Pitch']);
const STRIKE_OUTCOMES = new Set(['Called Strike', 'Swinging Strike', 'Foul']);
const HIT_OUTCOMES = new Set(['Single', 'Double', 'Triple', 'Home Run']);

function getOutcomeColor(outcome) {
  if (BALL_OUTCOMES.has(outcome)) return '#2563eb';
  if (STRIKE_OUTCOMES.has(outcome)) return '#dc2626';
  if (HIT_OUTCOMES.has(outcome)) return '#16a34a';
  return '#475569';
}

function Badge({ label, color }) {
  if (!label) return <span className={styles.emptyCell}>—</span>;
  return (
    <span className={styles.badge} style={{ background: color, color: '#fff' }}>
      {label}
    </span>
  );
}

const PITCH_TYPE_OPTIONS = ['FB', 'OS', 'CB', 'SL', 'CH', 'CT', 'SK', 'OT', 'UN'];
const OUTCOME_OPTIONS = [
  'Ball', 'Walk', 'Hit By Pitch',
  'Called Strike', 'Swinging Strike', 'Foul',
  'Single', 'Double', 'Triple', 'Home Run',
  'Groundout', 'Flyout', 'Lineout',
  'Strikeout Swinging', 'Strikeout Looking',
  'Sacrifice Fly', 'Sacrifice Bunt',
  'Double Play', "Fielder's Choice", 'Error',
];
const QOC_OPTIONS = ['', 'GB', 'LD', 'FB', 'PU'];
const SPRAY_OPTIONS = ['', 'Pull', 'Straight', 'Oppo'];
const SIDE_OPTIONS = ['', 'L', 'R', 'S'];
const THROWS_OPTIONS = ['', 'L', 'R'];
const HALF_OPTIONS = ['TOP', 'BOTTOM'];

function EditRow({ pitch, onSave, onCancel }) {
  const [form, setForm] = useState({ ...pitch });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('pitches')
      .update({
        half_inning: form.half_inning,
        inning: form.inning ? parseInt(form.inning) : null,
        outs: form.outs !== '' ? parseInt(form.outs) : null,
        balls: form.balls !== '' ? parseInt(form.balls) : null,
        strikes: form.strikes !== '' ? parseInt(form.strikes) : null,
        count: form.count,
        runners: form.runners,
        batter: form.batter,
        pitcher: form.pitcher,
        batter_team: form.batter_team,
        pitcher_team: form.pitcher_team,
        batter_side: form.batter_side || null,
        pitcher_side: form.pitcher_side || null,
        pitch_type: form.pitch_type || null,
        outcome: form.outcome,
        quality_of_contact: form.quality_of_contact || null,
        spray_chart: form.spray_chart || null,
        time_to_plate_man_on_first: form.time_to_plate_man_on_first !== '' ? parseFloat(form.time_to_plate_man_on_first) : null,
        pitch_location_x: form.pitch_location_x !== '' ? parseFloat(form.pitch_location_x) : null,
        pitch_location_y: form.pitch_location_y !== '' ? parseFloat(form.pitch_location_y) : null,
        notes: form.notes || null,
      })
      .eq('id', pitch.id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    onSave({ ...pitch, ...form });
  }

  const inp = (field, type = 'text', extra = {}) => (
    <input
      type={type}
      className={styles.editInput}
      value={form[field] ?? ''}
      onChange={(e) => set(field, e.target.value)}
      step={type === 'number' ? 'any' : undefined}
      {...extra}
    />
  );

  const sel = (field, options) => (
    <select
      className={styles.editSelect}
      value={form[field] ?? ''}
      onChange={(e) => set(field, e.target.value)}
    >
      {options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
    </select>
  );

  return (
    <>
      <tr className={styles.editRow}>
        <td className={styles.cell}>{pitch.pitch_number}</td>
        <td className={styles.cell}>{sel('half_inning', HALF_OPTIONS)}</td>
        <td className={styles.cell}>{inp('inning', 'number', { min: 1 })}</td>
        <td className={styles.cell}>{inp('outs', 'number', { min: 0, max: 2 })}</td>
        <td className={styles.cell}>{inp('balls', 'number', { min: 0, max: 3 })}</td>
        <td className={styles.cell}>{inp('strikes', 'number', { min: 0, max: 2 })}</td>
        <td className={styles.cell}>{inp('count')}</td>
        <td className={styles.cell}>{inp('batter_team')}</td>
        <td className={styles.cell}>{inp('pitcher_team')}</td>
        <td className={styles.cell}><span className={styles.staticCell}>{pitch.date || '—'}</span></td>
        <td className={styles.cell}><span className={styles.staticCell}>{pitch.home_team || '—'}</span></td>
        <td className={styles.cell}><span className={styles.staticCell}>{pitch.away_team || '—'}</span></td>
        <td className={styles.cell}>{inp('time_to_plate_man_on_first', 'number', { step: '0.1' })}</td>
        <td className={styles.cell}>{inp('batter')}</td>
        <td className={styles.cell}>{inp('pitcher')}</td>
        <td className={styles.cell}>{sel('batter_side', SIDE_OPTIONS)}</td>
        <td className={styles.cell}>{sel('pitcher_side', THROWS_OPTIONS)}</td>
        <td className={styles.cell}>{sel('pitch_type', ['', ...PITCH_TYPE_OPTIONS])}</td>
        <td className={styles.cell}>{sel('outcome', OUTCOME_OPTIONS)}</td>
        <td className={styles.cell}>{sel('quality_of_contact', QOC_OPTIONS)}</td>
        <td className={styles.cell}>{sel('spray_chart', SPRAY_OPTIONS)}</td>
        <td className={styles.cell}>{inp('runners')}</td>
        <td className={styles.cell}>{inp('pitch_location_x', 'number', { step: 'any' })}</td>
        <td className={styles.cell}>{inp('pitch_location_y', 'number', { step: 'any' })}</td>
        <td className={styles.cell}>{inp('notes')}</td>
        <td className={styles.cell}>
          <div className={styles.actionCell}>
            <button type="button" className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={26} className={styles.rowError}>{error}</td>
        </tr>
      )}
    </>
  );
}

function PitchRow({ pitch, gameDate, homeTeam, awayTeam, onEdit }) {
  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });
  }

  const ptColor = PITCH_TYPE_COLORS[pitch.pitch_type] || '#64748b';

  return (
    <tr className={styles.row}>
      <td className={styles.cell}>{pitch.pitch_number}</td>
      <td className={styles.cell}>{pitch.half_inning}</td>
      <td className={styles.cell}>{pitch.inning}</td>
      <td className={styles.cell}>{pitch.outs}</td>
      <td className={styles.cell}>{pitch.balls}</td>
      <td className={styles.cell}>{pitch.strikes}</td>
      <td className={styles.cell}>{pitch.count}</td>
      <td className={styles.cell}>{pitch.batter_team || '—'}</td>
      <td className={styles.cell}>{pitch.pitcher_team || '—'}</td>
      <td className={styles.cell}>{formatDate(gameDate)}</td>
      <td className={styles.cell}>{homeTeam || '—'}</td>
      <td className={styles.cell}>{awayTeam || '—'}</td>
      <td className={styles.cell}>{pitch.time_to_plate_man_on_first ?? '—'}</td>
      <td className={styles.cell}>{pitch.batter}</td>
      <td className={styles.cell}>{pitch.pitcher}</td>
      <td className={styles.cell}>{pitch.batter_side || '—'}</td>
      <td className={styles.cell}>{pitch.pitcher_side || '—'}</td>
      <td className={styles.cell}>
        {pitch.pitch_type
          ? <Badge label={pitch.pitch_type} color={ptColor} />
          : <span className={styles.emptyCell}>—</span>}
      </td>
      <td className={styles.cell}>
        <Badge label={pitch.outcome} color={getOutcomeColor(pitch.outcome)} />
      </td>
      <td className={styles.cell}>{pitch.quality_of_contact || '—'}</td>
      <td className={styles.cell}>{pitch.spray_chart || '—'}</td>
      <td className={styles.cell}>{pitch.runners}</td>
      <td className={styles.cell}>{pitch.pitch_location_x ?? '—'}</td>
      <td className={styles.cell}>{pitch.pitch_location_y ?? '—'}</td>
      <td className={styles.cell}>{pitch.notes || '—'}</td>
      <td className={styles.cell}>
        <button type="button" className={styles.editBtn} onClick={onEdit}>Edit</button>
      </td>
    </tr>
  );
}

export default function GameLog() {
  const { id: gameId } = useParams();
  const [game, setGame] = useState(null);
  const [pitches, setPitches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadData();
  }, [gameId]);

  async function loadData() {
    setLoading(true);
    const [{ data: gameData, error: gameErr }, { data: pitchData, error: pitchErr }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('pitches').select('*').eq('game_id', gameId).order('pitch_number', { ascending: true }),
    ]);
    if (gameErr || pitchErr) {
      setToast((gameErr || pitchErr).message);
    }
    setGame(gameData || null);
    setPitches(pitchData || []);
    setLoading(false);
  }

  function handleSave(updated) {
    setPitches((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setEditingId(null);
  }

  function formatTitle() {
    if (!game) return 'Pitch Log';
    const date = new Date(game.date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });
    return `${game.home_team} vs ${game.away_team} — ${date}`;
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.backLink}>← Dashboard</Link>
        <span className={styles.gameTitle}>{game ? formatTitle() : ''}</span>
        <button
          type="button"
          className={styles.exportBtn}
          onClick={() => exportGameCsv(gameId, supabase)}
          disabled={!game}
        >
          Export CSV
        </button>
      </nav>

      <div className={styles.content}>
        <h1>Pitch Log</h1>

        {loading ? (
          <p className={styles.loading}>Loading...</p>
        ) : pitches.length === 0 ? (
          <p className={styles.empty}>No pitches recorded for this game yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.headerRow}>
                  <th className={styles.th}>#</th>
                  <th className={styles.th}>Half</th>
                  <th className={styles.th}>Inn</th>
                  <th className={styles.th}>Outs</th>
                  <th className={styles.th}>Balls</th>
                  <th className={styles.th}>Strikes</th>
                  <th className={styles.th}>Count</th>
                  <th className={styles.th}>Batter Team</th>
                  <th className={styles.th}>Pitcher Team</th>
                  <th className={styles.th}>Date</th>
                  <th className={styles.th}>Home Team</th>
                  <th className={styles.th}>Away Team</th>
                  <th className={styles.th}>Time to Plate</th>
                  <th className={styles.th}>Batter</th>
                  <th className={styles.th}>Pitcher</th>
                  <th className={styles.th}>Batter Side</th>
                  <th className={styles.th}>Pitcher Side</th>
                  <th className={styles.th}>Pitch Type</th>
                  <th className={styles.th}>Outcome</th>
                  <th className={styles.th}>QOC</th>
                  <th className={styles.th}>Spray</th>
                  <th className={styles.th}>Runners</th>
                  <th className={styles.th}>Pitch X</th>
                  <th className={styles.th}>Pitch Y</th>
                  <th className={styles.th}>Notes</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pitches.map((p) =>
                  editingId === p.id ? (
                    <EditRow
                      key={p.id}
                      pitch={p}
                      onSave={handleSave}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <PitchRow
                      key={p.id}
                      pitch={p}
                      gameDate={game?.date}
                      homeTeam={game?.home_team}
                      awayTeam={game?.away_team}
                      onEdit={() => setEditingId(p.id)}
                    />
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
