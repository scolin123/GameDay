import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import styles from './NewGame.module.css';

const EMPTY_PLAYER = () => ({
  player_name: '',
  player_role: 'Batter',
  bats: '',
  throws: '',
  batting_order: '',
});

function RosterPanel({ team, label, players, onChange, onAdd, onRemove }) {
  return (
    <div className={styles.rosterPanel}>
      <h2 className={styles.teamHeading}>{label}</h2>
      <div className={styles.rosterTable}>
        <div className={styles.rosterHeader}>
          <span>Name</span>
          <span>Role</span>
          <span>Bats</span>
          <span>Throws</span>
          <span>Order</span>
          <span></span>
        </div>
        {players.map((p, i) => (
          <div key={i} className={styles.rosterRow}>
            <input
              className={styles.input}
              placeholder="Player name"
              value={p.player_name}
              onChange={(e) => onChange(team, i, 'player_name', e.target.value)}
            />
            <select
              className={styles.select}
              value={p.player_role}
              onChange={(e) => onChange(team, i, 'player_role', e.target.value)}
            >
              <option value="Batter">Batter</option>
              <option value="Pitcher">Pitcher</option>
              <option value="Both">Both</option>
            </select>
            <select
              className={styles.select}
              value={p.bats}
              onChange={(e) => onChange(team, i, 'bats', e.target.value)}
            >
              <option value="">—</option>
              <option value="L">L</option>
              <option value="R">R</option>
              <option value="S">S</option>
            </select>
            <select
              className={styles.select}
              value={p.throws}
              onChange={(e) => onChange(team, i, 'throws', e.target.value)}
            >
              <option value="">—</option>
              <option value="L">L</option>
              <option value="R">R</option>
            </select>
            <input
              className={styles.orderInput}
              type="number"
              min="1"
              max="9"
              placeholder="—"
              value={p.batting_order}
              onChange={(e) => onChange(team, i, 'batting_order', e.target.value)}
            />
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => onRemove(team, i)}
            >
              x
            </button>
          </div>
        ))}
      </div>
      <button type="button" className={styles.addPlayerBtn} onClick={() => onAdd(team)}>
        Add Player
      </button>
    </div>
  );
}

export default function NewGame() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [gameId, setGameId] = useState(null);
  const [gameInfo, setGameInfo] = useState({
    date: new Date().toISOString().split('T')[0],
    home_team: '',
    away_team: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [rosters, setRosters] = useState({
    home: [EMPTY_PLAYER()],
    away: [EMPTY_PLAYER()],
  });

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
    const { data, error: err } = await supabase
      .from('games')
      .insert({ ...gameInfo, user_id: user.id })
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

  function handleAddPlayer(team) {
    setRosters((r) => ({ ...r, [team]: [...r[team], EMPTY_PLAYER()] }));
  }

  function handleRemovePlayer(team, index) {
    setRosters((r) => {
      const updated = r[team].filter((_, i) => i !== index);
      return { ...r, [team]: updated };
    });
  }

  function validate() {
    const checkTeam = (team, label) => {
      const players = rosters[team];
      const hasBatter = players.some((p) =>
        (p.player_role === 'Batter' || p.player_role === 'Both') && p.player_name.trim()
      );
      const hasPitcher = players.some((p) =>
        (p.player_role === 'Pitcher' || p.player_role === 'Both') && p.player_name.trim()
      );
      if (!hasBatter) return `${label} needs at least one batter.`;
      if (!hasPitcher) return `${label} needs at least one pitcher.`;
      return null;
    };
    return (
      checkTeam('home', gameInfo.home_team || 'Home team') ||
      checkTeam('away', gameInfo.away_team || 'Away team')
    );
  }

  async function handleStartGame(e) {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
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

    const { error: err } = await supabase.from('rosters').insert(allPlayers);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    navigate(`/games/${gameId}/live`);
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.navBrand}>Guelph Royals Pitch Tracker</span>
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
            <h1>Build Roster</h1>
            <p className={styles.stepInfo}>{gameInfo.away_team} @ {gameInfo.home_team}</p>
            <form onSubmit={handleStartGame}>
              <div className={styles.rosterColumns}>
                <RosterPanel
                  team="home"
                  label={gameInfo.home_team}
                  players={rosters.home}
                  onChange={handlePlayerChange}
                  onAdd={handleAddPlayer}
                  onRemove={handleRemovePlayer}
                />
                <RosterPanel
                  team="away"
                  label={gameInfo.away_team}
                  players={rosters.away}
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
