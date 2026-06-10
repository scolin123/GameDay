import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { advanceCount, advanceRunnersForOutcome, PA_ENDING_OUTCOMES, IN_PLAY_OUTCOMES } from '../lib/autoAdvance';
import StrikeZone from '../components/StrikeZone';
import PitchTypeButtons from '../components/PitchTypeButtons';
import BaseDiamond from '../components/BaseDiamond';
import ChangePitcherModal from '../components/ChangePitcherModal';
import Toast from '../components/Toast';
import styles from './LiveScoring.module.css';

const QOC_OPTIONS = ['GB', 'LD', 'FB', 'PU'];
const SPRAY_OPTIONS = ['Pull', 'Straight', 'Oppo'];

const PITCH_TYPE_LABELS = {
  FB: 'Fastball', OS: 'Offspeed', CB: 'Curveball', SL: 'Slider',
  CH: 'Changeup', CT: 'Cutter', SK: 'Sinker', OT: 'Other', UN: 'Unknown',
};

const BALL_OUTCOMES = ['Ball', 'Hit By Pitch'];
const STRIKE_OUTCOMES = ['Called Strike', 'Swinging Strike', 'Foul'];
const HIT_OUTCOMES = ['Single', 'Double', 'Triple', 'Home Run'];
const OUT_OUTCOMES = ['Groundout', 'Flyout', 'Lineout', 'Sacrifice Fly', 'Sacrifice Bunt', 'Double Play', "Fielder's Choice", 'Error'];

export default function LiveScoring() {
  const { id: gameId } = useParams();

  // Game meta
  const [game, setGame] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Game state
  const [halfInning, setHalfInning] = useState('TOP');
  const [inning, setInning] = useState(1);
  const [outs, setOuts] = useState(0);
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [runners, setRunners] = useState('000');
  const [pitchNumber, setPitchNumber] = useState(1);

  // Roster state
  const [homeBatters, setHomeBatters] = useState([]);
  const [awayBatters, setAwayBatters] = useState([]);
  const [homePitchers, setHomePitchers] = useState([]);
  const [awayPitchers, setAwayPitchers] = useState([]);

  // Current matchup
  const [homeBatterIdx, setHomeBatterIdx] = useState(0);
  const [awayBatterIdx, setAwayBatterIdx] = useState(0);
  const [currentPitcher, setCurrentPitcher] = useState(null); // { player_name, throws }
  const [currentPitcherSide, setCurrentPitcherSide] = useState('');

  // Pitch form
  const [pitchType, setPitchType] = useState('');
  const [outcome, setOutcome] = useState('');
  const [qoc, setQoc] = useState('');
  const [spray, setSpray] = useState('');
  const [timeToPlate, setTimeToPlate] = useState('');
  const [notes, setNotes] = useState('');
  const [locationX, setLocationX] = useState(null);
  const [locationY, setLocationY] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Recent pitches for sidebar
  const [recentPitches, setRecentPitches] = useState([]);

  // Current at-bat sequence
  const [atBatPitches, setAtBatPitches] = useState([]);

  // Editable batter / pitcher names (work with or without a roster)
  const [batterInput, setBatterInput] = useState('');
  const [pitcherInput, setPitcherInput] = useState('');

  // Outcome panel UI state
  const [showOutcomePanel, setShowOutcomePanel] = useState(false);
  const [inPlayView, setInPlayView] = useState(false);

  // Modals
  const [showChangePitcher, setShowChangePitcher] = useState(false);
  const [showInningFlip, setShowInningFlip] = useState(false);
  const [flipOrderStart, setFlipOrderStart] = useState(1);
  const [pendingFlip, setPendingFlip] = useState(null); // { nextHalf, nextInning, battingTeam }

  useEffect(() => {
    loadGameData();
  }, [gameId]);

  async function loadGameData() {
    setLoading(true);
    const [{ data: gameData }, { data: rosterData }, { data: pitchData }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('rosters').select('*').eq('game_id', gameId).order('batting_order'),
      supabase.from('pitches').select('*').eq('game_id', gameId).order('pitch_number', { ascending: false }).limit(20),
    ]);

    if (!gameData) { setLoading(false); return; }
    setGame(gameData);

    // Partition roster
    const battersHome = (rosterData || []).filter(
      (p) => p.team === gameData.home_team && (p.player_role === 'batter' || p.player_role === 'both')
    );
    const battersAway = (rosterData || []).filter(
      (p) => p.team === gameData.away_team && (p.player_role === 'batter' || p.player_role === 'both')
    );
    const pitchersHome = (rosterData || []).filter(
      (p) => p.team === gameData.home_team && (p.player_role === 'pitcher' || p.player_role === 'both')
    );
    const pitchersAway = (rosterData || []).filter(
      (p) => p.team === gameData.away_team && (p.player_role === 'pitcher' || p.player_role === 'both')
    );

    setHomeBatters(battersHome);
    setAwayBatters(battersAway);
    setHomePitchers(pitchersHome);
    setAwayPitchers(pitchersAway);
    setRoster(rosterData || []);

    // TOP of 1st: away bats, home pitches
    if (pitchersHome.length > 0) {
      setCurrentPitcher(pitchersHome[0]);
      setCurrentPitcherSide(pitchersHome[0].throws || '');
      setPitcherInput(pitchersHome[0].player_name);
    }
    if (battersAway.length > 0) {
      setBatterInput(battersAway[0].player_name);
    }

    // Restore state from last pitch if any exist
    const pitches = pitchData || [];
    setRecentPitches(pitches.slice(0, 5));
    if (pitches.length > 0) {
      const last = pitches[0];
      setHalfInning(last.half_inning);
      setInning(last.inning);
      setOuts(last.outs);
      setRunners(last.runners);
      setPitchNumber(last.pitch_number + 1);
      // Restore batter index
      const battingTeamBatters = last.half_inning === 'TOP' ? battersAway : battersHome;
      const batterIdx = battingTeamBatters.findIndex((b) => b.player_name === last.batter);
      if (last.half_inning === 'TOP') {
        setAwayBatterIdx(batterIdx >= 0 ? batterIdx : 0);
      } else {
        setHomeBatterIdx(batterIdx >= 0 ? batterIdx : 0);
      }
      // Restore pitcher
      const pitchingTeamPitchers = last.half_inning === 'TOP' ? pitchersHome : pitchersAway;
      const pitcherEntry = pitchingTeamPitchers.find((p) => p.player_name === last.pitcher);
      if (pitcherEntry) {
        setCurrentPitcher(pitcherEntry);
        setCurrentPitcherSide(pitcherEntry.throws || '');
      }
      // Restore count (from last pitch state = before this pitch)
      const { balls: newBalls, strikes: newStrikes, paEnded } = advanceCount(
        last.balls, last.strikes, last.outcome
      );
      if (!paEnded) {
        setBalls(newBalls);
        setStrikes(newStrikes);
      } else {
        setBalls(0);
        setStrikes(0);
      }
    }

    // Load current at-bat pitches
    if (pitches.length > 0) {
      const last = pitches[0];
      const { data: atBatData } = await supabase
        .from('pitches')
        .select('*')
        .eq('game_id', gameId)
        .eq('batter', last.batter)
        .order('pitch_number', { ascending: true });
      // Only pitches in the current at-bat (after last PA-ending pitch)
      setAtBatPitches(getCurrentAtBat(atBatData || []));
    }

    setLoading(false);
  }

  function getCurrentAtBat(pitches) {
    // Walk back from the end to find the start of the current at-bat
    const reversed = [...pitches].reverse();
    const cutoff = reversed.findIndex((p) => PA_ENDING_OUTCOMES.has(p.outcome));
    if (cutoff === -1) return pitches;
    return reversed.slice(0, cutoff).reverse();
  }

  // Derived
  const battingTeam = halfInning === 'TOP' ? game?.away_team : game?.home_team;
  const pitchingTeam = halfInning === 'TOP' ? game?.home_team : game?.away_team;
  const currentBatters = halfInning === 'TOP' ? awayBatters : homeBatters;
  const currentBatterIdx = halfInning === 'TOP' ? awayBatterIdx : homeBatterIdx;
  const currentBatter = currentBatters[currentBatterIdx] || null;
  const pitchingTeamPitchers = halfInning === 'TOP' ? homePitchers : awayPitchers;

  const showInPlay = outcome && IN_PLAY_OUTCOMES.has(outcome);
  const showTimeToPlate = runners[0] === '1';

  // Pitcher game stats derived from recent pitches
  const pitcherStats = recentPitches.length > 0
    ? (() => {
        // We'd need all pitches for accurate stats — simplify to "from loaded data"
        const all = recentPitches;
        const forPitcher = all.filter((p) => p.pitcher === currentPitcher?.player_name);
        return {
          pitches: forPitcher.length,
          strikes: forPitcher.filter((p) =>
            ['Called Strike', 'Swinging Strike', 'Foul', 'Strikeout Swinging', 'Strikeout Looking'].includes(p.outcome)
          ).length,
          bb: forPitcher.filter((p) => p.outcome === 'Walk').length,
          k: forPitcher.filter((p) =>
            p.outcome === 'Strikeout Swinging' || p.outcome === 'Strikeout Looking'
          ).length,
        };
      })()
    : { pitches: 0, strikes: 0, bb: 0, k: 0 };

  function resetForm() {
    setPitchType('');
    setOutcome('');
    setQoc('');
    setSpray('');
    setTimeToPlate('');
    setNotes('');
    setLocationX(null);
    setLocationY(null);
    setShowOutcomePanel(false);
    setInPlayView(false);
  }

  async function handleSubmitPitch() {
    if (!outcome) return;
    setSubmitting(true);

    const count = `${balls}-${strikes}`;
    const batter = batterInput.trim() || 'Unknown';
    const batter_side = currentBatter?.bats || null;

    const pitchData = {
      game_id: gameId,
      pitch_number: pitchNumber,
      half_inning: halfInning,
      inning,
      outs,
      balls,
      strikes,
      count,
      runners,
      batter,
      pitcher: pitcherInput.trim() || 'Unknown',
      batter_team: battingTeam,
      pitcher_team: pitchingTeam,
      batter_side,
      pitcher_side: currentPitcherSide || null,
      pitch_type: pitchType || null,
      outcome,
      quality_of_contact: qoc || null,
      spray_chart: spray || null,
      time_to_plate_man_on_first: timeToPlate ? parseFloat(timeToPlate) : null,
      notes: notes || null,
      pitch_location_x: locationX,
      pitch_location_y: locationY,
    };

    const { data: inserted, error } = await supabase.from('pitches').insert(pitchData).select().single();
    if (error) {
      setToast(error.message);
      setSubmitting(false);
      return;
    }

    // Compute new state
    const { balls: newBalls, strikes: newStrikes, paEnded, outsAdded } = advanceCount(balls, strikes, outcome);
    const newOuts = Math.min(outs + outsAdded, 3);
    const newRunners = paEnded ? advanceRunnersForOutcome(runners, outcome) : runners;
    const newPitchNumber = pitchNumber + 1;

    // Update recent pitches
    const newPitch = { ...pitchData, id: inserted.id };
    const newRecent = [newPitch, ...recentPitches].slice(0, 5);
    setRecentPitches(newRecent);

    // Update at-bat pitches
    const newAtBat = paEnded ? [] : [...atBatPitches, newPitch];
    setAtBatPitches(newAtBat);

    setPitchNumber(newPitchNumber);

    if (newOuts >= 3) {
      // Half-inning flip
      const nextHalf = halfInning === 'TOP' ? 'BOTTOM' : 'TOP';
      const nextInning = halfInning === 'BOTTOM' ? inning + 1 : inning;
      const nextBattingTeam = nextHalf === 'TOP' ? game?.away_team : game?.home_team;
      setPendingFlip({ nextHalf, nextInning, battingTeam: nextBattingTeam });
      setShowInningFlip(true);
      // Don't advance yet — wait for modal
    } else if (paEnded) {
      // Advance batter
      const nextIdx = (currentBatters.length > 0)
        ? (currentBatterIdx + 1) % currentBatters.length
        : 0;
      if (halfInning === 'TOP') setAwayBatterIdx(nextIdx);
      else setHomeBatterIdx(nextIdx);
      if (currentBatters.length > 0) {
        setBatterInput(currentBatters[nextIdx]?.player_name || '');
      } else {
        setBatterInput('');
      }
      setBalls(0);
      setStrikes(0);
      setRunners(newRunners);
      setOuts(newOuts);
    } else {
      setBalls(newBalls);
      setStrikes(newStrikes);
    }

    resetForm();
    setSubmitting(false);
  }

  async function handleUndo() {
    if (recentPitches.length === 0) return;
    const last = recentPitches[0];
    const { error } = await supabase.from('pitches').delete().eq('id', last.id);
    if (error) { setToast(error.message); return; }

    // Restore state to what it was before the last pitch
    setBalls(last.balls);
    setStrikes(last.strikes);
    setOuts(last.outs);
    setRunners(last.runners);
    setHalfInning(last.half_inning);
    setInning(last.inning);
    setPitchNumber(last.pitch_number);

    // Restore batter
    const battingBatters = last.half_inning === 'TOP' ? awayBatters : homeBatters;
    const idx = battingBatters.findIndex((b) => b.player_name === last.batter);
    if (last.half_inning === 'TOP') setAwayBatterIdx(idx >= 0 ? idx : 0);
    else setHomeBatterIdx(idx >= 0 ? idx : 0);
    setBatterInput(last.batter || '');
    setPitcherInput(last.pitcher || '');

    const newRecent = recentPitches.slice(1);
    setRecentPitches(newRecent);
    setAtBatPitches((prev) => prev.filter((p) => p.id !== last.id));
  }

  function handleToggleRunner(baseIndex) {
    setRunners((r) => {
      const arr = r.split('');
      arr[baseIndex] = arr[baseIndex] === '1' ? '0' : '1';
      return arr.join('');
    });
  }

  function handleConfirmFlip() {
    if (!pendingFlip) return;
    const { nextHalf, nextInning, battingTeam: nextBattingTeam } = pendingFlip;

    setHalfInning(nextHalf);
    setInning(nextInning);
    setOuts(0);
    setBalls(0);
    setStrikes(0);
    setRunners('000');
    setAtBatPitches([]);

    // Set batter to selected order position (flipOrderStart is 1-indexed)
    const newBatters = nextHalf === 'TOP' ? awayBatters : homeBatters;
    const newIdx = Math.max(0, Math.min(flipOrderStart - 1, newBatters.length - 1));
    if (nextHalf === 'TOP') setAwayBatterIdx(newIdx);
    else setHomeBatterIdx(newIdx);
    setBatterInput(newBatters[newIdx]?.player_name || '');

    // Swap pitcher to the other team's pitchers
    const newPitchers = nextHalf === 'TOP' ? homePitchers : awayPitchers;
    if (newPitchers.length > 0) {
      setCurrentPitcher(newPitchers[0]);
      setCurrentPitcherSide(newPitchers[0].throws || '');
      setPitcherInput(newPitchers[0].player_name);
    } else {
      setPitcherInput('');
    }

    setShowInningFlip(false);
    setPendingFlip(null);
    setFlipOrderStart(1);
  }

  function handleSelectPitcher(pitcher) {
    setCurrentPitcher(pitcher);
    setCurrentPitcherSide(pitcher.throws || '');
    setPitcherInput(pitcher.player_name);
    setShowChangePitcher(false);
  }

  if (loading) return (
    <div className={styles.page}>
      <p className={styles.loading}>Loading...</p>
    </div>
  );

  if (!game) return (
    <div className={styles.page}>
      <p className={styles.loading}>Game not found.</p>
    </div>
  );

  const halfLabel = halfInning === 'TOP' ? 'TOP' : 'BOT';

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.navBrand}>Guelph Royals Pitch Tracker</span>
        <span className={styles.navGame}>{game.away_team} @ {game.home_team}</span>
        <button type="button" onClick={() => supabase.auth.signOut()} className={styles.signOut}>
          Sign Out
        </button>
      </nav>

      <div className={styles.columns}>
        {/* LEFT COLUMN */}
        <div className={styles.leftCol}>
          {/* Scoreboard */}
          <section className={styles.section}>
            <div className={styles.halfInningDisplay}>
              <span className={styles.halfLabel}>{halfLabel}</span>
              <span className={styles.inningNum}>{inning}</span>
            </div>
            <div className={styles.outsRow}>
              <span className={styles.statLabel}>Outs</span>
              <div className={styles.outsDots}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`${styles.outDot} ${i < outs ? styles.outDotFilled : ''}`} />
                ))}
              </div>
            </div>
            <div className={styles.countDisplay}>
              <span className={styles.countNum}>{balls}-{strikes}</span>
              <span className={styles.countLabel}>Count</span>
            </div>
          </section>

          {/* Base Diamond */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Runners</div>
            <div className={styles.diamondWrap}>
              <BaseDiamond runners={runners} onToggle={handleToggleRunner} />
            </div>
          </section>

          {/* Current Matchup */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>At Bat</div>
            <div className={styles.matchupRow}>
              <span className={styles.matchupRole}>Batter</span>
              <input
                className={styles.matchupInput}
                value={batterInput}
                onChange={(e) => setBatterInput(e.target.value)}
                placeholder="Enter batter name"
              />
            </div>
            <div className={styles.matchupRow}>
              <span className={styles.matchupRole}>Pitcher</span>
              <input
                className={styles.matchupInput}
                value={pitcherInput}
                onChange={(e) => setPitcherInput(e.target.value)}
                placeholder="Enter pitcher name"
              />
            </div>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setShowChangePitcher(true)}
            >
              Change Pitcher
            </button>
          </section>

          {/* Recent Pitches */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Recent Pitches</div>
            {recentPitches.length === 0 && (
              <p className={styles.emptyText}>No pitches yet.</p>
            )}
            {recentPitches.map((p, i) => (
              <div key={p.id || i} className={styles.recentPitch}>
                <span className={styles.pitchNum}>#{p.pitch_number}</span>
                <span className={styles.pitchType}>{p.pitch_type || '—'}</span>
                <span className={styles.pitchOutcome}>{p.outcome}</span>
                <span className={styles.pitchCount}>{p.balls}-{p.strikes}</span>
              </div>
            ))}
            <button
              type="button"
              className={styles.undoBtn}
              onClick={handleUndo}
              disabled={recentPitches.length === 0}
            >
              Undo Last Pitch
            </button>
          </section>
        </div>

        {/* CENTER COLUMN */}
        <div className={styles.centerCol}>
          {/* Strike Zone */}
          <div className={`${styles.fieldGroup} ${styles.zoneField}`}>
            <div className={styles.fieldLabel}>Pitch Location — place dot, then click it</div>
            <StrikeZone
              onLocationSet={(x, y) => { setLocationX(x); setLocationY(y); }}
              onDotClick={() => setShowOutcomePanel(true)}
              pitchType={pitchType}
              locationX={locationX}
              locationY={locationY}
            />
          </div>

          {/* Notes — always visible */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="notes">Notes</label>
            <textarea id="notes" className={styles.textarea} rows={2}
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes" />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.rightCol}>
          {/* At-bat sequence */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Current At-Bat</div>
            {atBatPitches.length === 0 && (
              <p className={styles.emptyText}>No pitches this at-bat.</p>
            )}
            {atBatPitches.map((p, i) => (
              <div key={p.id || i} className={styles.atBatPitch}>
                <span className={styles.pitchNum}>{i + 1}</span>
                <span className={styles.pitchType}>{p.pitch_type || '—'}</span>
                <span className={styles.pitchOutcome}>{p.outcome}</span>
              </div>
            ))}
          </section>

          {/* Batting lineup */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Batting — {battingTeam}</div>
            {currentBatters.length === 0 && (
              <p className={styles.emptyText}>No batters on roster.</p>
            )}
            {currentBatters.map((b, i) => (
              <div
                key={b.id}
                className={`${styles.lineupRow} ${i === currentBatterIdx ? styles.lineupRowActive : ''}`}
              >
                <span className={styles.lineupOrder}>{b.batting_order || i + 1}</span>
                <span className={styles.lineupName}>{b.player_name}</span>
                {b.bats && <span className={styles.lineupSide}>{b.bats}</span>}
              </div>
            ))}
          </section>

          {/* Pitcher stats */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Pitcher — {currentPitcher?.player_name || '—'}</div>
            <div className={styles.pitcherStats}>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{pitcherStats.pitches}</span>
                <span className={styles.statName}>P</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{pitcherStats.strikes}</span>
                <span className={styles.statName}>K%</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{pitcherStats.bb}</span>
                <span className={styles.statName}>BB</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statValue}>{pitcherStats.k}</span>
                <span className={styles.statName}>K</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Change Pitcher Modal */}
      {showChangePitcher && (
        <ChangePitcherModal
          pitchers={pitchingTeamPitchers}
          currentPitcher={currentPitcher?.player_name}
          onSelect={handleSelectPitcher}
          onClose={() => setShowChangePitcher(false)}
        />
      )}

      {/* Half-Inning Flip Modal */}
      {showInningFlip && pendingFlip && (
        <div className={styles.overlay}>
          <div className={styles.flipModal}>
            <h2>End of Half-Inning</h2>
            <p className={styles.flipText}>
              {pendingFlip.battingTeam} now batting. Where in the order do they start?
            </p>
            <div className={styles.flipField}>
              <label className={styles.fieldLabel} htmlFor="flipOrder">Batting Order Position</label>
              <select
                id="flipOrder"
                className={styles.select}
                value={flipOrderStart}
                onChange={(e) => setFlipOrderStart(parseInt(e.target.value))}
              >
                {[1,2,3,4,5,6,7,8,9].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className={styles.flipActions}>
              <button type="button" className={styles.primaryBtn} onClick={handleConfirmFlip}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outcome Modal Overlay */}
      {showOutcomePanel && (
        <div className={styles.overlay} onClick={() => { setShowOutcomePanel(false); setInPlayView(false); setOutcome(''); setPitchType(''); }}>
          <div className={styles.outcomeModal} onClick={(e) => e.stopPropagation()}>

            {!pitchType ? (
              /* ── View 1: Pitch Type ── */
              <>
                <div className={styles.outcomeModalTitle}>Pitch Type</div>
                <PitchTypeButtons selected={pitchType} onChange={setPitchType} />
                <div className={styles.overlayActions}>
                  <button type="button" className={styles.undoModalBtn}
                    onClick={() => { handleUndo(); setShowOutcomePanel(false); setPitchType(''); }}
                    disabled={recentPitches.length === 0}>
                    Undo Last
                  </button>
                  <button type="button" className={styles.cancelBtn}
                    onClick={() => { setShowOutcomePanel(false); setPitchType(''); }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : !inPlayView ? (
              /* ── View 2: Outcome ── */
              <>
                <div className={styles.outcomeModalHeader}>
                  <button type="button" className={styles.backBtn}
                    onClick={() => { setPitchType(''); setOutcome(''); setInPlayView(false); }}>
                    &larr; {PITCH_TYPE_LABELS[pitchType] || pitchType}
                  </button>
                </div>
                <div className={styles.outcomeModalTitle}>Select Outcome</div>

                <div className={styles.outcomeSection}>
                  <div className={`${styles.outcomeSectionLabel} ${styles.ballLabel}`}>Ball</div>
                  {BALL_OUTCOMES.map((o) => (
                    <button key={o} type="button"
                      className={`${styles.outcomeRowBtn} ${outcome === o ? styles.ballBtnSelected : ''}`}
                      onClick={() => setOutcome(o)}>{o}</button>
                  ))}
                  {balls === 3 && (
                    <button type="button"
                      className={`${styles.outcomeRowBtn} ${outcome === 'Walk' ? styles.ballBtnSelected : ''}`}
                      onClick={() => setOutcome('Walk')}>Walk</button>
                  )}
                </div>

                <div className={styles.outcomeSection}>
                  <div className={`${styles.outcomeSectionLabel} ${styles.strikeLabel}`}>Strike</div>
                  {STRIKE_OUTCOMES.map((o) => (
                    <button key={o} type="button"
                      className={`${styles.outcomeRowBtn} ${outcome === o ? styles.strikeBtnSelected : ''}`}
                      onClick={() => setOutcome(o)}>{o}</button>
                  ))}
                  {strikes === 2 && (
                    <>
                      <button type="button"
                        className={`${styles.outcomeRowBtn} ${outcome === 'Strikeout Swinging' ? styles.strikeBtnSelected : ''}`}
                        onClick={() => setOutcome('Strikeout Swinging')}>Strikeout Swinging</button>
                      <button type="button"
                        className={`${styles.outcomeRowBtn} ${outcome === 'Strikeout Looking' ? styles.strikeBtnSelected : ''}`}
                        onClick={() => setOutcome('Strikeout Looking')}>Strikeout Looking</button>
                    </>
                  )}
                </div>

                <div className={styles.outcomeSection} style={{ borderBottom: 'none' }}>
                  <button type="button" className={styles.ballInPlayBtn}
                    onClick={() => setInPlayView(true)}>
                    Ball in Play &rarr;
                  </button>
                </div>

                <div className={styles.overlayActions}>
                  <button type="button" className={styles.undoModalBtn}
                    onClick={() => { handleUndo(); setShowOutcomePanel(false); setOutcome(''); setPitchType(''); }}
                    disabled={recentPitches.length === 0}>
                    Undo Last
                  </button>
                  <button type="button" className={styles.cancelBtn}
                    onClick={() => { setShowOutcomePanel(false); setOutcome(''); setPitchType(''); }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              /* ── View 3: Ball in Play ── */
              <>
                <div className={styles.outcomeModalHeader}>
                  <button type="button" className={styles.backBtn}
                    onClick={() => { setInPlayView(false); setOutcome(''); }}>
                    &larr; Back
                  </button>
                  <div className={styles.outcomeModalTitle}>Ball in Play</div>
                </div>

                <div className={styles.outcomeSection}>
                  <div className={`${styles.outcomeSectionLabel} ${styles.hitLabel}`}>Hit</div>
                  {HIT_OUTCOMES.map((o) => (
                    <button key={o} type="button"
                      className={`${styles.outcomeRowBtn} ${styles.hitRowBtn} ${outcome === o ? styles.hitBtnSelected : ''}`}
                      onClick={() => setOutcome(o)}>{o}</button>
                  ))}
                </div>

                <div className={styles.outcomeSection}>
                  <div className={`${styles.outcomeSectionLabel} ${styles.outLabelStyle}`}>Out</div>
                  {OUT_OUTCOMES.map((o) => (
                    <button key={o} type="button"
                      className={`${styles.outcomeRowBtn} ${styles.outRowBtn} ${outcome === o ? styles.outBtnSelected : ''}`}
                      onClick={() => setOutcome(o)}>{o}</button>
                  ))}
                </div>

                {showInPlay && (
                  <>
                    <div className={styles.outcomeSectionLabel}>Quality of Contact</div>
                    <div className={styles.buttonGroup} style={{ marginBottom: 8 }}>
                      {QOC_OPTIONS.map((q) => (
                        <button key={q} type="button"
                          className={`${styles.segBtn} ${qoc === q ? styles.segBtnActive : ''}`}
                          onClick={() => setQoc(qoc === q ? '' : q)}>{q}</button>
                      ))}
                    </div>
                    <div className={styles.outcomeSectionLabel}>Spray Direction</div>
                    <div className={styles.buttonGroup} style={{ marginBottom: 8 }}>
                      {SPRAY_OPTIONS.map((s) => (
                        <button key={s} type="button"
                          className={`${styles.segBtn} ${spray === s ? styles.segBtnActive : ''}`}
                          onClick={() => setSpray(spray === s ? '' : s)}>{s}</button>
                      ))}
                    </div>
                  </>
                )}

                {showTimeToPlate && (
                  <div style={{ marginBottom: 8 }}>
                    <div className={styles.outcomeSectionLabel}>Time to Plate (s)</div>
                    <input type="number" step="0.1" min="0"
                      className={styles.numberInput}
                      value={timeToPlate}
                      onChange={(e) => setTimeToPlate(e.target.value)}
                      placeholder="e.g. 1.3" />
                  </div>
                )}

                <div className={styles.overlayActions}>
                  <button type="button" className={styles.submitBtn}
                    onClick={handleSubmitPitch} disabled={!outcome || submitting}>
                    {submitting ? 'Saving...' : 'Submit Pitch'}
                  </button>
                  <button type="button" className={styles.undoModalBtn}
                    onClick={() => { handleUndo(); setShowOutcomePanel(false); setInPlayView(false); setOutcome(''); setPitchType(''); }}
                    disabled={recentPitches.length === 0}>
                    Undo Last
                  </button>
                  <button type="button" className={styles.cancelBtn}
                    onClick={() => { setShowOutcomePanel(false); setInPlayView(false); setOutcome(''); setPitchType(''); }}>
                    Cancel
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
