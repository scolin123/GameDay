import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { todayStr } from '../lib/week';
import styles from './NewGame.module.css';

const EMPTY_BATTER = () => ({ player_name: '', player_role: 'Batter', bats: '', throws: '', batting_order: '' });
const EMPTY_PITCHER = () => ({ player_name: '', player_role: 'Pitcher', bats: '', throws: '', batting_order: '' });

function RosterPanel({ team, label, players, tab, onChange, onAdd, onRemove }) {
  const batters = players.filter((p) => p.player_role === 'Batter');
  const pitchers = players.filter((p) => p.player_role === 'Pitcher');
  const shown = tab === 'batters' ? batters : pitchers;
  // Map shown index back to original players index
  const shownIndices = players.reduce((acc, p, i) => {
    const role = tab === 'batters' ? 'Batter' : 'Pitcher';
    if (p.player_role === role) acc.push(i);
    return acc;
  }, []);

  return (
    <div className={styles.rosterPanel}>
      <h2 className={styles.teamHeading}>{label}</h2>
      {shown.length > 0 && (
        <div className={styles.rosterTable}>
          <div className={tab === 'batters' ? styles.rosterHeaderBatters : styles.rosterHeaderPitchers}>
            <span>Name</span>
            {tab === 'batters' ? <><span>Bats</span><span>Order</span></> : <span>Throws</span>}
            <span></span>
          </div>
          {shown.map((p, si) => {
            const i = shownIndices[si];
            return (
              <div key={i} className={tab === 'batters' ? styles.rosterRowBatters : styles.rosterRowPitchers}>
                <input
                  className={styles.input}
                  placeholder="Player name"
                  value={p.player_name}
                  onChange={(e) => onChange(team, i, 'player_name', e.target.value)}
                />
                {tab === 'batters' ? (
                  <>
                    <select className={styles.select} value={p.bats}
                      onChange={(e) => onChange(team, i, 'bats', e.target.value)}>
                      <option value="">—</option>
                      <option value="L">L</option>
                      <option value="R">R</option>
                      <option value="S">S</option>
                    </select>
                    <input className={styles.orderInput} type="number" min="1" max="9"
                      placeholder="—" value={p.batting_order}
                      onChange={(e) => onChange(team, i, 'batting_order', e.target.value)} />
                  </>
                ) : (
                  <select className={styles.select} value={p.throws}
                    onChange={(e) => onChange(team, i, 'throws', e.target.value)}>
                    <option value="">—</option>
                    <option value="L">L</option>
                    <option value="R">R</option>
                  </select>
                )}
                <button type="button" className={styles.removeBtn} onClick={() => onRemove(team, i)}>x</button>
              </div>
            );
          })}
        </div>
      )}
      <button type="button" className={styles.addPlayerBtn}
        onClick={() => onAdd(team, tab === 'batters' ? 'Batter' : 'Pitcher')}>
        {tab === 'batters' ? 'Add Batter' : 'Add Pitcher'}
      </button>
    </div>
  );
}

export default function NewGame() {
  const navigate = useNavigate();
  // Set here when arriving from an Upcoming row on the dashboard
  const prefill = useLocation().state?.prefill;
  const [step, setStep] = useState(1);
  const [gameId, setGameId] = useState(null);
  const [gameInfo, setGameInfo] = useState({
    date: prefill?.date || todayStr(),
    home_team: prefill?.home_team || '',
    away_team: prefill?.away_team || '',
  });
  // Assignment is set by an admin on the schedule, not here — this only carries
  // through the assignee of the scheduled game this was set up from.
  const assignedTo = prefill?.assigned_to || '';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [rosters, setRosters] = useState({
    home: [EMPTY_BATTER()],
    away: [EMPTY_BATTER()],
  });

  const [newGameTab, setNewGameTab] = useState('batters');

  function handleGameInfoChange(field, value) {
    setGameInfo((g) => ({ ...g, [field]: value }));
  }

  async function handleStep1Submit(e) {
    e.preventDefault();
    setError('');
    if (!gameInfo.home_team.trim() || !gameInfo.away_team.trim()) {
      setError('Both team names are required.');
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...gameInfo, user_id: user.id, logged_by: user.email };
    if (assignedTo) payload.assigned_to = assignedTo;
    const { data, error: err } = await supabase
      .from('games')
      .insert(payload)
      .select()
      .single();
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setGameId(data.id);
    setStep(2);
    setLoading(false);
  }

  function handlePlayerChange(team, index, field, value) {
    setRosters((r) => {
      const updated = [...r[team]];
      updated[index] = { ...updated[index], [field]: value };
      return { ...r, [team]: updated };
    });
  }

  function handleAddPlayer(team, role) {
    const empty = role === 'Pitcher' ? EMPTY_PITCHER() : EMPTY_BATTER();
    setRosters((r) => ({ ...r, [team]: [...r[team], empty] }));
  }

  function handleRemovePlayer(team, index) {
    setRosters((r) => {
      const updated = r[team].filter((_, i) => i !== index);
      return { ...r, [team]: updated };
    });
  }

  async function handleStartGame(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const allPlayers = [
      ...rosters.home
        .filter((p) => p.player_name.trim())
        .map((p) => ({
          game_id: gameId,
          team: gameInfo.home_team,
          player_name: p.player_name.trim(),
          player_role: p.player_role.toLowerCase(),
          bats: p.bats || null,
          throws: p.throws || null,
          batting_order: p.batting_order ? parseInt(p.batting_order) : null,
        })),
      ...rosters.away
        .filter((p) => p.player_name.trim())
        .map((p) => ({
          game_id: gameId,
          team: gameInfo.away_team,
          player_name: p.player_name.trim(),
          player_role: p.player_role.toLowerCase(),
          bats: p.bats || null,
          throws: p.throws || null,
          batting_order: p.batting_order ? parseInt(p.batting_order) : null,
        })),
    ];

    if (allPlayers.length > 0) {
      const { error: err } = await supabase.from('rosters').insert(allPlayers);
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
    }
    navigate(`/games/${gameId}/live`);
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <Link to="/" className={styles.backLink}>← Games</Link>
          <span className={styles.navBrand}>Guelph Royals Pitch Tracker</span>
        </div>
        <button type="button" onClick={() => supabase.auth.signOut()} className={styles.signOut}>
          Sign Out
        </button>
      </nav>

      <div className={styles.content}>
        {step === 1 && (
          <>
            <h1>New Game</h1>
            <form onSubmit={handleStep1Submit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="date">Date</label>
                <input
                  id="date"
                  type="date"
                  className={styles.input}
                  value={gameInfo.date}
                  onChange={(e) => handleGameInfoChange('date', e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="home_team">Home Team</label>
                <input
                  id="home_team"
                  type="text"
                  className={styles.input}
                  value={gameInfo.home_team}
                  onChange={(e) => handleGameInfoChange('home_team', e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="away_team">Away Team</label>
                <input
                  id="away_team"
                  type="text"
                  className={styles.input}
                  value={gameInfo.away_team}
                  onChange={(e) => handleGameInfoChange('away_team', e.target.value)}
                  required
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={loading}>
                  {loading ? 'Saving...' : 'Continue'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1>Build Roster <span className={styles.optional}>(optional)</span></h1>
            <p className={styles.stepInfo}>{gameInfo.away_team} @ {gameInfo.home_team} — you can add players during the game too</p>
            <div className={styles.rosterTabBar}>
              <button type="button"
                className={`${styles.tabBtn} ${newGameTab === 'batters' ? styles.tabBtnActive : ''}`}
                onClick={() => setNewGameTab('batters')}>Batters</button>
              <button type="button"
                className={`${styles.tabBtn} ${newGameTab === 'pitchers' ? styles.tabBtnActive : ''}`}
                onClick={() => setNewGameTab('pitchers')}>Pitchers</button>
            </div>
            <form onSubmit={handleStartGame}>
              <div className={styles.rosterColumns}>
                <RosterPanel
                  team="home"
                  label={gameInfo.home_team}
                  players={rosters.home}
                  tab={newGameTab}
                  onChange={handlePlayerChange}
                  onAdd={handleAddPlayer}
                  onRemove={handleRemovePlayer}
                />
                <RosterPanel
                  team="away"
                  label={gameInfo.away_team}
                  players={rosters.away}
                  tab={newGameTab}
                  onChange={handlePlayerChange}
                  onAdd={handleAddPlayer}
                  onRemove={handleRemovePlayer}
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={loading}>
                  {loading ? 'Saving...' : 'Start Game'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
