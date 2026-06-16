import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { advanceCount, advanceRunnersForOutcome, PA_ENDING_OUTCOMES, IN_PLAY_OUTCOMES } from '../lib/autoAdvance';
import StrikeZone from '../components/StrikeZone';
import PitchTypeButtons from '../components/PitchTypeButtons';
import BaseDiamond from '../components/BaseDiamond';
import ChangePitcherModal from '../components/ChangePitcherModal';
import ChangeBatterModal from '../components/ChangeBatterModal';
import Toast from '../components/Toast';
import styles from './LiveScoring.module.css';

const normalizeRunners = (r) => (r || '000').toString().padStart(3, '0');

const QOC_OPTIONS = ['GB', 'LD', 'FB', 'PU'];
const SPRAY_OPTIONS = ['Pull', 'Straight', 'Oppo'];

const OUTCOME_ABBREV = {
  'Single': '1B', 'Double': '2B', 'Triple': '3B', 'Home Run': 'HR',
  'Strikeout Swinging': 'K', 'Strikeout Looking': 'Kl',
  'Dropped Third Strike Swinging': 'K+', 'Dropped Third Strike Looking': 'Kl+',
  'Walk': 'BB', 'Intentional Walk': 'IBB', 'Hit By Pitch': 'HBP',
  'Groundout': 'GO', 'Flyout': 'FO', 'Lineout': 'LO', 'Popout': 'PO',
  'Sacrifice Fly': 'SF', 'Sacrifice Bunt': 'SH',
  'Double Play': 'DP', 'Triple Play': 'TP',
  "Fielder's Choice Out": 'FCO', "Fielder's Choice Safe": 'FCS', 'Error': 'E',
  'Catcher Interference': 'CI', 'Batter Interference': 'BI',
};

const NOT_AB_OUTCOMES = new Set([
  'Walk', 'Intentional Walk', 'Hit By Pitch',
  'Sacrifice Fly', 'Sacrifice Bunt', 'Catcher Interference',
]);

const PITCH_TYPE_LABELS = {
  FB: 'Fastball', OS: 'Offspeed', CB: 'Curveball', SL: 'Slider',
  CH: 'Changeup', CT: 'Cutter', SK: 'Sinker', SV: 'Slurve',
  SW: 'Sweeper', SP: 'Splitter', OT: 'Other', UN: 'Unknown',
};

const QOC_EXPORT = { GB: 'Ground Ball', LD: 'Line Drive', FB: 'Fly Ball', PU: 'Pop Up' };
const SPRAY_EXPORT = { Pull: 'Pull', Straight: 'Straightaway', Oppo: 'Opposite Field' };

const BALL_OUTCOMES = ['Ball', 'Hit By Pitch', 'Catcher Interference'];
const STRIKE_OUTCOMES = ['Called Strike', 'Swinging Strike', 'Foul'];
const HIT_OUTCOMES = ['Single', 'Double', 'Triple', 'Home Run'];
const OUT_OUTCOMES = [
  'Groundout', 'Flyout', 'Lineout', 'Popout',
  'Double Play', 'Triple Play',
  'Sacrifice Fly', 'Sacrifice Bunt',
  "Fielder's Choice Out", 'Error',
  'Batter Interference',
];

const FC_SAFE_OUTCOMES = ["Fielder's Choice Safe"];

const FIELD_EVENTS = ['Pickoff', 'Caught Stealing', 'Truncated Out', 'Additional Out'];

export default function LiveScoring() {
  const { id: gameId } = useParams();
  const navigate = useNavigate();

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
  const [batterSide, setBatterSide] = useState('');

  // Outcome panel UI state
  const [showOutcomePanel, setShowOutcomePanel] = useState(false);
  const [inPlayView, setInPlayView] = useState(false);
  const [qocView, setQocView] = useState(false);

  // Modals
  const [showChangePitcher, setShowChangePitcher] = useState(false);
  const [showChangeBatter, setShowChangeBatter] = useState(false);
  const [showInningFlip, setShowInningFlip] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [gameOverAuto, setGameOverAuto] = useState(false);
  const [showGameLog, setShowGameLog] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [flipNewBatterName, setFlipNewBatterName] = useState('');
  const [rosterDragSrc, setRosterDragSrc] = useState(null); // { team, fromIdx }
  const [rosterDragOver, setRosterDragOver] = useState(null); // idx
  const [rosterAddInputs, setRosterAddInputs] = useState({});
  const [gamePitches, setGamePitches] = useState([]);
  const [pendingFlip, setPendingFlip] = useState(null); // { nextHalf, nextInning, battingTeam, nextBatterIdx }

  // Pitcher memory: persists per team across inning flips
  const [pitcherByTeam, setPitcherByTeam] = useState({});

  // Roster modal tabs per team: 'batters' | 'pitchers'
  const [rosterTabByTeam, setRosterTabByTeam] = useState({});
  const [rosterAddPitcherInputs, setRosterAddPitcherInputs] = useState({});

  // Pinch hitter map: { [teamName]: { [batting_order]: phEntry } }
  const [phMap, setPhMap] = useState({});
  // Roster modal PH add mode per team
  const [rosterPHMode, setRosterPHMode] = useState({});
  const [rosterPHFor, setRosterPHFor] = useState({});       // { [team]: batting_order string }
  const [rosterPHInputs, setRosterPHInputs] = useState({});  // { [team]: name string }

  // Truncated out: same batter leads off the next time that team bats
  const [truncatedBatterForNext, setTruncatedBatterForNext] = useState(null);

  // Timer for time to plate (shown only with runner on 1st only)
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState(null);
  const [timerDisplay, setTimerDisplay] = useState(0);

  // Bench PH flow (right column)
  const [benchPHTarget, setBenchPHTarget] = useState(null);
  const [benchPHForSlot, setBenchPHForSlot] = useState('');

  // Track first pitch_number of the current half inning (for half-inning pitch count)
  const [halfInningStartPitch, setHalfInningStartPitch] = useState(1);

  useEffect(() => {
    loadGameData();
  }, [gameId]);

  useEffect(() => {
    if (!timerRunning || timerStart === null) return;
    const interval = setInterval(() => {
      setTimerDisplay((Date.now() - timerStart) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [timerRunning, timerStart]);

  useEffect(() => {
    if (runners !== '100' && timerRunning) {
      setTimerRunning(false);
    }
  }, [runners]);

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

    // Build pinch-hitter map from roster
    const initPhMap = {};
    (rosterData || []).filter((p) => p.player_role === 'pinch_hitter').forEach((p) => {
      if (!initPhMap[p.team]) initPhMap[p.team] = {};
      initPhMap[p.team][p.batting_order] = p;
    });
    setPhMap(initPhMap);

    // TOP of 1st: away bats, home pitches
    if (pitchersHome.length > 0) {
      setCurrentPitcher(pitchersHome[0]);
      setCurrentPitcherSide(pitchersHome[0].throws || '');
      setPitcherInput(pitchersHome[0].player_name);
    }
    if (battersAway.length > 0) {
      setBatterInput(battersAway[0].player_name);
      setBatterSide(battersAway[0].bats || '');
    }

    // Seed pitcher memory from first roster entries
    const initPitcherByTeam = {};
    if (pitchersHome.length > 0) {
      initPitcherByTeam[gameData.home_team] = { player_name: pitchersHome[0].player_name, throws: pitchersHome[0].throws || '' };
    }
    if (pitchersAway.length > 0) {
      initPitcherByTeam[gameData.away_team] = { player_name: pitchersAway[0].player_name, throws: pitchersAway[0].throws || '' };
    }
    setPitcherByTeam(initPitcherByTeam);

    // Restore state from last pitch if any exist
    const pitches = pitchData || [];
    setRecentPitches(pitches.slice(0, 5));
    if (pitches.length > 0) {
      const last = pitches[0];
      setHalfInning(last.half_inning);
      setInning(last.inning);
      setOuts(last.outs);
      setRunners(normalizeRunners(last.runners));
      setPitchNumber(last.pitch_number + 1);
      // Restore batter index
      const battingTeamBatters = last.half_inning === 'TOP' ? battersAway : battersHome;
      const batterIdx = battingTeamBatters.findIndex((b) => b.player_name === last.batter);
      if (last.half_inning === 'TOP') {
        setAwayBatterIdx(batterIdx >= 0 ? batterIdx : 0);
      } else {
        setHomeBatterIdx(batterIdx >= 0 ? batterIdx : 0);
      }
      // Restore pitcher and seed pitcher memory from pitch history
      setBatterInput(last.batter || '');
      setBatterSide(last.batter_side || '');
      setPitcherInput(last.pitcher || '');
      const pitcherMemory = {};
      pitches.forEach((p) => {
        const pitchingTeamForP = p.half_inning === 'TOP' ? gameData.home_team : gameData.away_team;
        if (!pitcherMemory[pitchingTeamForP]) {
          pitcherMemory[pitchingTeamForP] = { player_name: p.pitcher, throws: p.pitcher_side || '' };
        }
      });
      setPitcherByTeam(pitcherMemory);
      const pitchingTeamNow = last.half_inning === 'TOP' ? gameData.home_team : gameData.away_team;
      if (pitcherMemory[pitchingTeamNow]) {
        const pm = pitcherMemory[pitchingTeamNow];
        setCurrentPitcher({ player_name: pm.player_name, throws: pm.throws });
        setCurrentPitcherSide(pm.throws);
      }
      // Set half-inning start pitch
      const currentHalfPitches = pitches.filter(
        (p) => p.half_inning === last.half_inning && p.inning === last.inning
      );
      setHalfInningStartPitch(Math.min(...currentHalfPitches.map((p) => p.pitch_number)));
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
  const showTimeToPlate = runners === '100';

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
    setQocView(false);
    setTimerRunning(false);
    setTimerStart(null);
    setTimerDisplay(0);
  }

  async function handleSubmitPitch() {
    if (!outcome) return;
    setSubmitting(true);

    const count = `${balls}-${strikes}`;
    const batter = batterInput.trim() || 'Unknown';
    const batter_side = batterSide || null;

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

    // Keep pitcher memory current with whatever name is in the input
    setPitcherByTeam((prev) => ({
      ...prev,
      [pitchingTeam]: { player_name: pitcherInput.trim() || 'Unknown', throws: currentPitcherSide || '' },
    }));

    // Auto-register batter to roster after each pitch
    if (batter !== 'Unknown') {
      const existing = currentBatters.find((b) => b.player_name === batter);
      if (!existing) {
        const newOrder = currentBatters.length + 1;
        supabase.from('rosters').insert({
          game_id: gameId, player_name: batter, team: battingTeam,
          player_role: 'batter', batting_order: newOrder, bats: batterSide || null,
        }).select().single().then(({ data: saved }) => {
          const entry = saved || { player_name: batter, bats: batterSide || null, id: Date.now(), batting_order: newOrder, team: battingTeam, player_role: 'batter' };
          if (halfInning === 'TOP') setAwayBatters((prev) => [...prev, entry]);
          else setHomeBatters((prev) => [...prev, entry]);
          setRoster((prev) => [...prev, entry]);
        });
      } else if (batterSide && existing.bats !== batterSide && existing.id) {
        supabase.from('rosters').update({ bats: batterSide }).eq('id', existing.id).then(() => {
          const upd = (prev) => prev.map((b) => b.id === existing.id ? { ...b, bats: batterSide } : b);
          if (halfInning === 'TOP') setAwayBatters(upd);
          else setHomeBatters(upd);
          setRoster(upd);
        });
      }
    }

    // Auto-register pitcher to roster after each pitch
    const pitcherNameForReg = pitcherInput.trim() || 'Unknown';
    if (pitcherNameForReg !== 'Unknown') {
      const existingPitcher = pitchingTeamPitchers.find((p) => p.player_name === pitcherNameForReg);
      if (!existingPitcher) {
        supabase.from('rosters').insert({
          game_id: gameId, player_name: pitcherNameForReg, team: pitchingTeam,
          player_role: 'pitcher', throws: currentPitcherSide || null,
        }).select().single().then(({ data: saved }) => {
          const entry = saved || { player_name: pitcherNameForReg, throws: currentPitcherSide || null, id: Date.now(), team: pitchingTeam, player_role: 'pitcher' };
          if (halfInning === 'TOP') setHomePitchers((prev) => [...prev, entry]);
          else setAwayPitchers((prev) => [...prev, entry]);
          setRoster((prev) => [...prev, entry]);
        });
      }
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
      const nextBatterBatters = nextHalf === 'TOP' ? awayBatters : homeBatters;
      const lastIdx = nextHalf === 'TOP' ? awayBatterIdx : homeBatterIdx;
      let nextBatterIdx;
      if (truncatedBatterForNext?.half === nextHalf) {
        nextBatterIdx = truncatedBatterForNext.idx;
        setTruncatedBatterForNext(null);
      } else {
        nextBatterIdx = nextBatterBatters.length >= 9 && lastIdx >= nextBatterBatters.length - 1 ? 0 : lastIdx + 1;
      }
      setPendingFlip({ nextHalf, nextInning, battingTeam: nextBattingTeam, nextBatterIdx });
      if (inning >= 9) {
        setGameOverAuto(true);
        setShowGameOverModal(true);
      } else {
        setShowInningFlip(true);
      }
    } else if (paEnded) {
      // Advance batter; wrap only when lineup is 9+
      const nextIdx = currentBatters.length >= 9 && currentBatterIdx >= currentBatters.length - 1
        ? 0
        : currentBatterIdx + 1;
      if (halfInning === 'TOP') setAwayBatterIdx(nextIdx);
      else setHomeBatterIdx(nextIdx);
      const nextInLineup = currentBatters[nextIdx];
      const nextOrder = nextInLineup?.batting_order || (nextIdx + 1);
      const phForNext = nextInLineup ? phMap[battingTeam]?.[nextOrder] : null;
      setBatterInput(phForNext?.player_name || nextInLineup?.player_name || '');
      setBatterSide(phForNext?.bats || nextInLineup?.bats || '');
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
    setRunners(normalizeRunners(last.runners));
    setHalfInning(last.half_inning);
    setInning(last.inning);
    setPitchNumber(last.pitch_number);

    // Restore batter
    const battingBatters = last.half_inning === 'TOP' ? awayBatters : homeBatters;
    const idx = battingBatters.findIndex((b) => b.player_name === last.batter);
    if (last.half_inning === 'TOP') setAwayBatterIdx(idx >= 0 ? idx : 0);
    else setHomeBatterIdx(idx >= 0 ? idx : 0);
    setBatterInput(last.batter || '');
    setBatterSide(last.batter_side || '');
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

  function handleConfirmFlip(overrideIdx, batterOverride) {
    if (!pendingFlip) return;
    const { nextHalf, nextInning, battingTeam: nextBattingTeam, nextBatterIdx } = pendingFlip;

    setHalfInning(nextHalf);
    setInning(nextInning);
    setOuts(0);
    setBalls(0);
    setStrikes(0);
    setRunners('000');
    setAtBatPitches([]);
    setHalfInningStartPitch(pitchNumber);

    // Use auto-computed nextBatterIdx, override index, or newly-added batter entry
    const newBatters = nextHalf === 'TOP' ? awayBatters : homeBatters;
    let newIdx, useName, useSide;
    if (batterOverride) {
      // Newly added batter not yet in state — use the entry directly
      newIdx = newBatters.length; // will be appended at this index
      useName = batterOverride.player_name;
      useSide = batterOverride.bats || '';
    } else {
      newIdx = overrideIdx != null
        ? Math.max(0, Math.min(overrideIdx, newBatters.length - 1))
        : Math.max(0, Math.min(nextBatterIdx ?? 0, newBatters.length - 1));
      useName = newBatters[newIdx]?.player_name || '';
      useSide = newBatters[newIdx]?.bats || '';
    }
    if (nextHalf === 'TOP') setAwayBatterIdx(newIdx);
    else setHomeBatterIdx(newIdx);
    // Use PH if one exists for this lineup slot
    const nextBatterEntry = newBatters[newIdx];
    const nextOrder = nextBatterEntry?.batting_order || (newIdx + 1);
    const phTeam = nextHalf === 'TOP' ? game?.away_team : game?.home_team;
    const phForNext = nextBatterEntry && !batterOverride ? phMap[phTeam]?.[nextOrder] : null;
    setBatterInput(phForNext?.player_name || useName);
    setBatterSide(phForNext?.bats || useSide);

    // Restore pitcher from memory (persists until Change Pitcher is pressed)
    const newPitchingTeam = nextHalf === 'TOP' ? game?.home_team : game?.away_team;
    const remembered = pitcherByTeam[newPitchingTeam];
    if (remembered) {
      setCurrentPitcher({ player_name: remembered.player_name, throws: remembered.throws });
      setCurrentPitcherSide(remembered.throws);
      setPitcherInput(remembered.player_name);
    } else {
      const newPitchers = nextHalf === 'TOP' ? homePitchers : awayPitchers;
      if (newPitchers.length > 0) {
        setCurrentPitcher(newPitchers[0]);
        setCurrentPitcherSide(newPitchers[0].throws || '');
        setPitcherInput(newPitchers[0].player_name);
      } else {
        setPitcherInput('');
      }
    }

    setShowInningFlip(false);
    setPendingFlip(null);
    setFlipNewBatterName('');
  }

  async function handleFlipAddBatter() {
    const name = flipNewBatterName.trim();
    if (!name || !pendingFlip) return;
    const { nextHalf } = pendingFlip;
    const nextBattingTeam = nextHalf === 'TOP' ? game?.away_team : game?.home_team;
    const nextBatters = nextHalf === 'TOP' ? awayBatters : homeBatters;
    const newOrder = nextBatters.length + 1;
    const { data: saved } = await supabase.from('rosters').insert({
      game_id: gameId, player_name: name, team: nextBattingTeam,
      player_role: 'batter', batting_order: newOrder, bats: null,
    }).select().single();
    const entry = saved || { player_name: name, bats: null, id: Date.now(), batting_order: newOrder, team: nextBattingTeam, player_role: 'batter' };
    if (nextHalf === 'TOP') setAwayBatters((prev) => [...prev, entry]);
    else setHomeBatters((prev) => [...prev, entry]);
    setRoster((prev) => [...prev, entry]);
    handleConfirmFlip(null, entry);
  }

  async function handleRosterReorder(team, batters, fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const reordered = [...batters];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updated = reordered.map((p, i) => ({ ...p, batting_order: i + 1 }));
    await Promise.all(updated.map((p) =>
      supabase.from('rosters').update({ batting_order: p.batting_order }).eq('id', p.id)
    ));
    const replaceInRoster = (prev) => [
      ...prev.filter((p) => !(p.team === team && (p.player_role === 'batter' || p.player_role === 'both'))),
      ...updated,
    ];
    setRoster(replaceInRoster);
    if (team === game.away_team) setAwayBatters(updated);
    else setHomeBatters(updated);
    setRosterDragSrc(null);
    setRosterDragOver(null);
  }

  async function handleRosterRemove(player) {
    if (player.id && typeof player.id !== 'number') {
      await supabase.from('rosters').delete().eq('id', player.id);
    }
    setRoster((prev) => prev.filter((p) => p.id !== player.id));
    const rm = (prev) => prev.filter((p) => p.id !== player.id);
    if (player.player_role === 'pinch_hitter') {
      setPhMap((prev) => {
        const updated = { ...prev, [player.team]: { ...(prev[player.team] || {}) } };
        delete updated[player.team][player.batting_order];
        return updated;
      });
    } else if (player.team === game?.away_team) {
      if (player.player_role === 'pitcher') setAwayPitchers(rm);
      else setAwayBatters(rm);
    } else {
      if (player.player_role === 'pitcher') setHomePitchers(rm);
      else setHomeBatters(rm);
    }
  }

  async function handleRosterAddPH(team, replacedOrder, phName) {
    const name = phName.trim();
    if (!name || !replacedOrder) return;
    const order = parseInt(replacedOrder);
    const { data: saved } = await supabase.from('rosters').insert({
      game_id: gameId, player_name: name, team,
      player_role: 'pinch_hitter', batting_order: order, bats: null,
    }).select().single();
    const entry = saved || { player_name: name, team, player_role: 'pinch_hitter', batting_order: order, id: Date.now() };
    setRoster((prev) => [...prev, entry]);
    setPhMap((prev) => ({
      ...prev,
      [team]: { ...(prev[team] || {}), [order]: entry },
    }));
    setRosterPHInputs((prev) => ({ ...prev, [team]: '' }));
    setRosterPHFor((prev) => ({ ...prev, [team]: '' }));
    setRosterPHMode((prev) => ({ ...prev, [team]: false }));
  }

  async function handleRosterAddPitcher(team) {
    const name = (rosterAddPitcherInputs[team] || '').trim();
    if (!name) return;
    const { data: saved } = await supabase.from('rosters').insert({
      game_id: gameId, player_name: name, team, player_role: 'pitcher', throws: null,
    }).select().single();
    const entry = saved || { player_name: name, team, player_role: 'pitcher', id: Date.now() };
    setRoster((prev) => [...prev, entry]);
    if (team === game.away_team) setAwayPitchers((prev) => [...prev, entry]);
    else setHomePitchers((prev) => [...prev, entry]);
    setRosterAddPitcherInputs((prev) => ({ ...prev, [team]: '' }));
  }

  async function handleRosterAddBatter(team) {
    const name = (rosterAddInputs[team] || '').trim();
    if (!name) return;
    const teamBatters = roster.filter((p) => p.team === team && (p.player_role === 'batter' || p.player_role === 'both'));
    const newOrder = teamBatters.length + 1;
    const { data: saved } = await supabase.from('rosters').insert({
      game_id: gameId, player_name: name, team, player_role: 'batter',
      batting_order: newOrder, bats: null,
    }).select().single();
    const entry = saved || { player_name: name, team, player_role: 'batter', batting_order: newOrder, id: Date.now() };
    setRoster((prev) => [...prev, entry]);
    if (team === game.away_team) setAwayBatters((prev) => [...prev, entry]);
    else setHomeBatters((prev) => [...prev, entry]);
    setRosterAddInputs((prev) => ({ ...prev, [team]: '' }));
  }

  async function handleBenchPH(benchPlayer, slotOrder) {
    const order = parseInt(slotOrder);
    if (!order || !benchPlayer) return;
    await handleRosterAddPH(battingTeam, order, benchPlayer.player_name);
    setBenchPHTarget(null);
    setBenchPHForSlot('');
  }

  async function handleSelectBatter(batter) {
    if (batter.isPinchHitter && !batter.id) {
      // Pinch hitter: replace the current batter's lineup slot
      const currentOrder = currentBatters[currentBatterIdx]?.batting_order || currentBatterIdx + 1;
      const { data: saved } = await supabase.from('rosters').insert({
        game_id: gameId, player_name: batter.player_name, team: battingTeam,
        player_role: 'batter', batting_order: currentOrder, bats: batter.bats || null,
      }).select().single();
      const newEntry = saved || { ...batter, id: Date.now(), batting_order: currentOrder, team: battingTeam, player_role: 'batter' };
      const updater = (prev) => prev.map((b, i) => i === currentBatterIdx ? newEntry : b);
      if (halfInning === 'TOP') { setAwayBatters(updater); setAwayBatterIdx(currentBatterIdx); }
      else { setHomeBatters(updater); setHomeBatterIdx(currentBatterIdx); }
      setBatterInput(newEntry.player_name);
      setBatterSide(newEntry.bats || '');
    } else if (!batter.id) {
      // New player — append to end of lineup
      const { data: saved } = await supabase.from('rosters').insert({
        game_id: gameId, player_name: batter.player_name, team: battingTeam,
        player_role: 'batter', batting_order: currentBatters.length + 1, bats: batter.bats || null,
      }).select().single();
      const newEntry = saved || { ...batter, id: Date.now(), batting_order: currentBatters.length + 1 };
      if (halfInning === 'TOP') { setAwayBatters((prev) => [...prev, newEntry]); setAwayBatterIdx(currentBatters.length); }
      else { setHomeBatters((prev) => [...prev, newEntry]); setHomeBatterIdx(currentBatters.length); }
      setBatterInput(newEntry.player_name);
      setBatterSide(newEntry.bats || '');
    } else {
      const idx = currentBatters.findIndex((b) => b.id === batter.id);
      if (halfInning === 'TOP') setAwayBatterIdx(idx >= 0 ? idx : awayBatterIdx);
      else setHomeBatterIdx(idx >= 0 ? idx : homeBatterIdx);
      setBatterInput(batter.player_name);
      setBatterSide(batter.bats || '');
    }
    setShowChangeBatter(false);
  }

  function handleSelectPitcher(pitcher) {
    setCurrentPitcher(pitcher);
    setCurrentPitcherSide(pitcher.throws || '');
    setPitcherInput(pitcher.player_name);
    setPitcherByTeam((prev) => ({
      ...prev,
      [pitchingTeam]: { player_name: pitcher.player_name, throws: pitcher.throws || '' },
    }));
    setShowChangePitcher(false);
  }

  async function handleFieldEvent(eventOutcome) {
    setSubmitting(true);
    const pitchData = {
      game_id: gameId,
      pitch_number: pitchNumber,
      half_inning: halfInning,
      inning,
      outs,
      balls,
      strikes,
      count: `${balls}-${strikes}`,
      runners,
      batter: batterInput.trim() || 'Unknown',
      pitcher: pitcherInput.trim() || 'Unknown',
      batter_team: battingTeam,
      pitcher_team: pitchingTeam,
      batter_side: batterSide || null,
      pitcher_side: currentPitcherSide || null,
      pitch_type: null,
      outcome: eventOutcome,
      quality_of_contact: null,
      spray_chart: null,
      time_to_plate_man_on_first: null,
      notes: null,
      pitch_location_x: null,
      pitch_location_y: null,
    };

    const { data: inserted, error } = await supabase.from('pitches').insert(pitchData).select().single();
    if (error) { setToast(error.message); setSubmitting(false); return; }

    const { outsAdded } = advanceCount(balls, strikes, eventOutcome);
    const newOuts = Math.min(outs + outsAdded, 3);
    const newPitch = { ...pitchData, id: inserted.id };
    setRecentPitches((prev) => [newPitch, ...prev].slice(0, 5));
    setAtBatPitches((prev) => [...prev, newPitch]);
    setPitchNumber((n) => n + 1);

    if (newOuts >= 3) {
      const nextHalf = halfInning === 'TOP' ? 'BOTTOM' : 'TOP';
      const nextInning = halfInning === 'BOTTOM' ? inning + 1 : inning;
      const nextBattingTeam = nextHalf === 'TOP' ? game?.away_team : game?.home_team;
      const nextBatterBatters = nextHalf === 'TOP' ? awayBatters : homeBatters;
      const lastIdx = nextHalf === 'TOP' ? awayBatterIdx : homeBatterIdx;
      let nextBatterIdx;
      if (truncatedBatterForNext?.half === nextHalf) {
        nextBatterIdx = truncatedBatterForNext.idx;
        setTruncatedBatterForNext(null);
      } else {
        nextBatterIdx = nextBatterBatters.length >= 9 && lastIdx >= nextBatterBatters.length - 1 ? 0 : lastIdx + 1;
      }
      // Truncated Out: same batter leads off next time this team bats
      if (eventOutcome === 'Truncated Out') {
        setTruncatedBatterForNext({ half: halfInning, idx: currentBatterIdx });
      }
      setPendingFlip({ nextHalf, nextInning, battingTeam: nextBattingTeam, nextBatterIdx });
      if (inning >= 9) { setGameOverAuto(true); setShowGameOverModal(true); }
      else { setShowInningFlip(true); }
    } else {
      setOuts(newOuts);
    }
    setSubmitting(false);
  }

  function handleEndGame() {
    navigate(`/games/${gameId}`);
  }

  function handleContinueGame() {
    setShowGameOverModal(false);
    setGameOverAuto(false);
    setShowInningFlip(true);
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
        <button type="button" className={styles.viewLogBtn}
          onClick={async () => {
            const { data } = await supabase.from('pitches').select('*').eq('game_id', gameId).order('pitch_number');
            setGamePitches(data || []);
            setShowGameLog(true);
          }}>
          View Log
        </button>
        <button type="button" className={styles.viewLogBtn} onClick={() => setShowRosterModal(true)}>
          Roster
        </button>
        <button type="button" className={styles.endGameNavBtn}
          onClick={() => { setGameOverAuto(false); setShowGameOverModal(true); }}>
          End Game
        </button>
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

          {/* Field Events */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Field Events</div>
            <div className={styles.fieldEventBtns}>
              {FIELD_EVENTS.map((ev) => (
                <button key={ev} type="button"
                  className={styles.fieldEventBtn}
                  onClick={() => handleFieldEvent(ev)}
                  disabled={submitting}>
                  {ev}
                </button>
              ))}
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
                list="batters-datalist"
                onChange={(e) => {
                  setBatterInput(e.target.value);
                  const match = currentBatters.find((b) => b.player_name === e.target.value);
                  if (match) setBatterSide(match.bats || '');
                }}
                placeholder="Enter batter name"
              />
              <datalist id="batters-datalist">
                {currentBatters.map((b) => <option key={b.id} value={b.player_name} />)}
              </datalist>
              <div className={styles.handednessGroup}>
                {['L', 'R', 'S'].map((side) => (
                  <button key={side} type="button"
                    className={`${styles.handBtn} ${batterSide === side ? styles.handBtnActive : ''}`}
                    onClick={() => setBatterSide(batterSide === side ? '' : side)}>
                    {side}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.matchupRow}>
              <span className={styles.matchupRole}>Pitcher</span>
              <input
                className={styles.matchupInput}
                value={pitcherInput}
                onChange={(e) => setPitcherInput(e.target.value)}
                placeholder="Enter pitcher name"
              />
              <div className={styles.handednessGroup}>
                {['L', 'R'].map((side) => (
                  <button key={side} type="button"
                    className={`${styles.handBtn} ${currentPitcherSide === side ? styles.handBtnActive : ''}`}
                    onClick={() => setCurrentPitcherSide(currentPitcherSide === side ? '' : side)}>
                    {side}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ marginTop: 0 }}
                onClick={() => setShowChangeBatter(true)}
              >
                Change Batter
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ marginTop: 0 }}
                onClick={() => setShowChangePitcher(true)}
              >
                Change Pitcher
              </button>
            </div>
          </section>

          {/* Recent Pitches */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Recent Pitches</div>
            {recentPitches.length === 0 && (
              <p className={styles.emptyText}>No pitches yet.</p>
            )}
            {recentPitches.map((p, i) => {
              const sameHalf = p.half_inning === halfInning && p.inning === inning;
              const halfNum = sameHalf ? p.pitch_number - halfInningStartPitch + 1 : null;
              return (
                <div key={p.id || i} className={`${styles.recentPitch} ${!sameHalf ? styles.recentPitchPrev : ''}`}>
                  <span className={styles.pitchNum}>{halfNum != null ? `#${halfNum}` : '·'}</span>
                  <span className={styles.pitchType}>{p.pitch_type || '—'}</span>
                  <span className={styles.pitchOutcome}>{p.outcome}</span>
                  <span className={styles.pitchCount}>{p.balls}-{p.strikes}</span>
                </div>
              );
            })}
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
              batterSide={batterSide}
            />
          </div>

          {/* Unknown pitch — log without location or type */}
          <button
            type="button"
            className={styles.unknownPitchBtn}
            onClick={() => {
              setLocationX(null);
              setLocationY(null);
              setPitchType('UN');
              setShowOutcomePanel(true);
            }}
          >
            Log Pitch Without Info
          </button>

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

          {/* Batting lineup — slots 1-9 only */}
          <section className={styles.section}>
            <div className={styles.sectionLabel}>Batting — {battingTeam}</div>
            {currentBatters.length === 0 && (
              <p className={styles.emptyText}>No batters on roster.</p>
            )}
            {currentBatters.map((b, i) => {
              const order = b.batting_order || (i + 1);
              if (order > 9) return null;
              const ph = phMap[battingTeam]?.[order];
              const isActive = i === currentBatterIdx;
              return (
                <div key={b.id}>
                  <div
                    className={`${styles.lineupRow} ${isActive && !ph ? styles.lineupRowActive : ''} ${ph ? styles.lineupRowReplaced : ''}`}
                    onClick={() => {
                      if (halfInning === 'TOP') setAwayBatterIdx(i);
                      else setHomeBatterIdx(i);
                      setBatterInput(ph?.player_name || b.player_name);
                      setBatterSide(ph?.bats || b.bats || '');
                    }}
                  >
                    <span className={styles.lineupOrder}>{order}</span>
                    <span className={`${styles.lineupName} ${ph ? styles.lineupNameReplaced : ''}`}>{b.player_name}</span>
                    {b.bats && !ph && <span className={styles.lineupSide}>{b.bats}</span>}
                  </div>
                  {ph && (
                    <div
                      className={`${styles.lineupRowPH} ${isActive ? styles.lineupRowActive : ''}`}
                      onClick={() => {
                        if (halfInning === 'TOP') setAwayBatterIdx(i);
                        else setHomeBatterIdx(i);
                        setBatterInput(ph.player_name);
                        setBatterSide(ph.bats || '');
                      }}
                    >
                      <span className={styles.phConnector}>└</span>
                      <span className={styles.lineupName}>{ph.player_name}</span>
                      <span className={styles.phBadge}>PH</span>
                    </div>
                  )}
                </div>
              );
            })}
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

          {/* Time to Plate timer — only shown with runner on 1st only */}
          {showTimeToPlate && (
            <section className={styles.section}>
              <div className={styles.sectionLabel}>Time to Plate</div>
              <div className={styles.timerRow}>
                <span className={styles.timerValue}>
                  {timerRunning
                    ? timerDisplay.toFixed(3)
                    : timeToPlate || '0.000'}s
                </span>
                <button
                  type="button"
                  className={timerRunning ? styles.timerStopBtn : styles.timerStartBtn}
                  onClick={() => {
                    if (!timerRunning) {
                      setTimerStart(Date.now());
                      setTimerRunning(true);
                      setTimerDisplay(0);
                    } else {
                      const elapsed = ((Date.now() - timerStart) / 1000).toFixed(3);
                      setTimeToPlate(elapsed);
                      setTimerRunning(false);
                    }
                  }}
                >
                  {timerRunning ? '■ Stop' : '▶ Start'}
                </button>
              </div>
              {timeToPlate && !timerRunning && (
                <div className={styles.timerRecorded}>{timeToPlate}s — saves with next pitch</div>
              )}
            </section>
          )}

          {/* Bench — batters beyond slot 9 */}
          {(() => {
            const benchBatters = currentBatters.filter((b, i) => {
              const order = b.batting_order || (i + 1);
              const isAlreadyPH = Object.values(phMap[battingTeam] || {}).some(
                (ph) => ph.player_name === b.player_name
              );
              return order > 9 && !isAlreadyPH;
            });
            if (benchBatters.length === 0) return null;
            const lineupForPH = currentBatters.filter((b, i) => (b.batting_order || (i + 1)) <= 9);
            return (
              <section className={styles.section}>
                <div className={styles.sectionLabel}>Bench — {battingTeam}</div>
                {benchBatters.map((b) => (
                  <div key={b.id}>
                    <div className={styles.benchRow}>
                      <span className={styles.lineupName}>{b.player_name}</span>
                      {b.bats && <span className={styles.lineupSide}>{b.bats}</span>}
                      <button
                        type="button"
                        className={styles.benchPHBtn}
                        onClick={() => {
                          setBenchPHTarget(benchPHTarget?.id === b.id ? null : b);
                          setBenchPHForSlot('');
                        }}
                      >
                        PH
                      </button>
                    </div>
                    {benchPHTarget?.id === b.id && (
                      <div className={styles.benchPHPanel}>
                        <select
                          className={styles.select}
                          value={benchPHForSlot}
                          onChange={(e) => setBenchPHForSlot(e.target.value)}
                        >
                          <option value="">PHing for...</option>
                          {lineupForPH.map((lb, li) => (
                            <option key={lb.id} value={lb.batting_order || (li + 1)}>
                              #{lb.batting_order || (li + 1)} {lb.player_name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={styles.rosterAddBtn}
                          disabled={!benchPHForSlot}
                          onClick={() => handleBenchPH(b, benchPHForSlot)}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={() => { setBenchPHTarget(null); setBenchPHForSlot(''); }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            );
          })()}
        </div>
      </div>

      {/* Change Batter Modal */}
      {showChangeBatter && (
        <ChangeBatterModal
          batters={currentBatters}
          currentBatter={batterInput}
          onSelect={handleSelectBatter}
          onClose={() => setShowChangeBatter(false)}
        />
      )}

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
      {showInningFlip && pendingFlip && (() => {
        const flipBatters = pendingFlip.nextHalf === 'TOP' ? awayBatters : homeBatters;
        const autoIdx = pendingFlip.nextBatterIdx ?? 0;
        const autoBatter = flipBatters[autoIdx];
        return (
          <div className={styles.overlay}>
            <div className={styles.flipModal}>
              <h2>End of Half-Inning</h2>
              <p className={styles.flipText}>
                {pendingFlip.battingTeam} now batting.
              </p>
              {autoBatter ? (
                <p className={styles.flipConfirmText}>
                  Is <strong>{autoBatter.player_name}</strong> (#{autoIdx + 1}) up first?
                </p>
              ) : (
                <p className={styles.flipConfirmText} style={{ color: 'var(--text-muted)', background: 'none' }}>
                  Batter #{autoIdx + 1} hasn't been added yet — use the field below.
                </p>
              )}
              <div className={styles.flipActions}>
                <button type="button" className={styles.primaryBtn} onClick={() => handleConfirmFlip()}>
                  Yes, Confirm
                </button>
                {flipBatters.length > 1 && (
                  <select
                    className={styles.select}
                    defaultValue={autoIdx}
                    onChange={(e) => handleConfirmFlip(parseInt(e.target.value))}
                  >
                    {flipBatters.map((b, i) => (
                      <option key={b.id} value={i}>#{i + 1} {b.player_name}</option>
                    ))}
                  </select>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    style={{ flex: 1, border: '1px solid var(--border-strong)', borderRadius: 4, padding: '5px 8px', fontSize: 13, background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'IBM Plex Sans, sans-serif', minWidth: 0 }}
                    placeholder="Add next batter..."
                    value={flipNewBatterName}
                    onChange={(e) => setFlipNewBatterName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFlipAddBatter()}
                  />
                  <button type="button" className={styles.primaryBtn}
                    onClick={handleFlipAddBatter}
                    disabled={!flipNewBatterName.trim()}
                    style={{ whiteSpace: 'nowrap' }}>
                    Add &amp; Set
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Outcome Modal Overlay */}
      {showOutcomePanel && (
        <div className={styles.overlay} onClick={() => { setShowOutcomePanel(false); setInPlayView(false); setQocView(false); setOutcome(''); setPitchType(''); }}>
          <div className={styles.outcomeModal} onClick={(e) => e.stopPropagation()}>

            {!pitchType ? (
              /* ── View 1: Pitch Type ── */
              <>
                <div className={styles.outcomeModalTitle}>Pitch Type</div>
                <PitchTypeButtons selected={pitchType} onChange={setPitchType} />
                <div className={styles.overlayActions}>
                  <button type="button" className={styles.undoModalBtn}
                    onClick={() => { handleUndo(); setShowOutcomePanel(false); setQocView(false); setPitchType(''); }}
                    disabled={recentPitches.length === 0}>
                    Undo Last
                  </button>
                  <button type="button" className={styles.cancelBtn}
                    onClick={() => { setShowOutcomePanel(false); setQocView(false); setPitchType(''); }}>
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
                    <>
                      <button type="button"
                        className={`${styles.outcomeRowBtn} ${outcome === 'Walk' ? styles.ballBtnSelected : ''}`}
                        onClick={() => setOutcome('Walk')}>Walk</button>
                      <button type="button"
                        className={`${styles.outcomeRowBtn} ${outcome === 'Intentional Walk' ? styles.ballBtnSelected : ''}`}
                        onClick={() => setOutcome('Intentional Walk')}>Intentional Walk</button>
                    </>
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
                      <button type="button"
                        className={`${styles.outcomeRowBtn} ${outcome === 'Dropped Third Strike Swinging' ? styles.strikeBtnSelected : ''}`}
                        onClick={() => setOutcome('Dropped Third Strike Swinging')}>Dropped Third Strike Swinging</button>
                      <button type="button"
                        className={`${styles.outcomeRowBtn} ${outcome === 'Dropped Third Strike Looking' ? styles.strikeBtnSelected : ''}`}
                        onClick={() => setOutcome('Dropped Third Strike Looking')}>Dropped Third Strike Looking</button>
                    </>
                  )}
                </div>

                <div className={styles.outcomeSection} style={{ borderBottom: 'none' }}>
                  <button type="button" className={styles.ballInPlayBtn}
                    onClick={() => setInPlayView(true)}>
                    Ball in Play &rarr;
                  </button>
                </div>

                {showTimeToPlate && (
                  <div className={styles.outcomeSection} style={{ borderBottom: 'none', background: 'var(--accent-subtle)', borderRadius: 4, padding: '8px 12px' }}>
                    <div className={styles.outcomeSectionLabel} style={{ color: 'var(--accent)' }}>⏱ Time to Plate (runner on 1st)</div>
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
                    onClick={() => { handleUndo(); setShowOutcomePanel(false); setQocView(false); setOutcome(''); setPitchType(''); }}
                    disabled={recentPitches.length === 0}>
                    Undo Last
                  </button>
                  <button type="button" className={styles.cancelBtn}
                    onClick={() => { setShowOutcomePanel(false); setQocView(false); setOutcome(''); setPitchType(''); }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : !qocView ? (
              /* ── View 3: Ball in Play — hit/out selection ── */
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
                      className={`${styles.outcomeRowBtn} ${styles.hitRowBtn}`}
                      onClick={() => { setOutcome(o); setQocView(true); }}>{o}</button>
                  ))}
                </div>

                <div className={styles.outcomeSection}>
                  <div className={`${styles.outcomeSectionLabel} ${styles.outLabelStyle}`}>Out</div>
                  {OUT_OUTCOMES.map((o) => (
                    <button key={o} type="button"
                      className={`${styles.outcomeRowBtn} ${styles.outRowBtn}`}
                      onClick={() => { setOutcome(o); setQocView(true); }}>{o}</button>
                  ))}
                </div>

                <div className={styles.outcomeSection} style={{ borderBottom: 'none' }}>
                  <div className={`${styles.outcomeSectionLabel} ${styles.fcSafeLabel}`}>Fielder's Choice</div>
                  {FC_SAFE_OUTCOMES.map((o) => (
                    <button key={o} type="button"
                      className={`${styles.outcomeRowBtn} ${styles.fcSafeBtn}`}
                      onClick={() => { setOutcome(o); setQocView(true); }}>{o}</button>
                  ))}
                </div>

                <div className={styles.overlayActions}>
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
            ) : (
              /* ── View 4: Quality of Contact & Spray ── */
              <>
                <div className={styles.outcomeModalHeader}>
                  <button type="button" className={styles.backBtn}
                    onClick={() => { setQocView(false); setQoc(''); setSpray(''); setTimeToPlate(''); setOutcome(''); }}>
                    &larr; {outcome}
                  </button>
                </div>
                <div className={styles.outcomeModalTitle}>Quality of Contact</div>

                <div className={styles.outcomeSection}>
                  <div className={styles.outcomeSectionLabel}>Contact Type</div>
                  <div className={styles.buttonGroup}>
                    {QOC_OPTIONS.map((q) => (
                      <button key={q} type="button"
                        className={`${styles.segBtn} ${qoc === q ? styles.segBtnActive : ''}`}
                        onClick={() => setQoc(qoc === q ? '' : q)}>{q}</button>
                    ))}
                  </div>
                </div>

                <div className={styles.outcomeSection}>
                  <div className={styles.outcomeSectionLabel}>Spray Direction</div>
                  <div className={styles.buttonGroup}>
                    {SPRAY_OPTIONS.map((s) => (
                      <button key={s} type="button"
                        className={`${styles.segBtn} ${spray === s ? styles.segBtnActive : ''}`}
                        onClick={() => setSpray(spray === s ? '' : s)}>{s}</button>
                    ))}
                  </div>
                </div>

                {showTimeToPlate && (
                  <div className={styles.outcomeSection} style={{ borderBottom: 'none' }}>
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
                    onClick={handleSubmitPitch} disabled={submitting}>
                    {submitting ? 'Saving...' : 'Submit Pitch'}
                  </button>
                  <button type="button" className={styles.undoModalBtn}
                    onClick={() => { handleUndo(); setShowOutcomePanel(false); setInPlayView(false); setQocView(false); setOutcome(''); setPitchType(''); }}
                    disabled={recentPitches.length === 0}>
                    Undo Last
                  </button>
                  <button type="button" className={styles.cancelBtn}
                    onClick={() => { setShowOutcomePanel(false); setInPlayView(false); setQocView(false); setOutcome(''); setPitchType(''); }}>
                    Cancel
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {showGameOverModal && (
        <div className={styles.overlay}>
          <div className={styles.flipModal}>
            {gameOverAuto ? (
              <>
                <h2>End of {halfInning === 'TOP' ? 'Top' : 'Bottom'} {inning}</h2>
                <p className={styles.flipText}>
                  {halfInning === 'TOP'
                    ? `If ${game.home_team} is winning, the game is over — they don't need to bat.`
                    : `If ${game.away_team} is still leading, the game is over.`}
                </p>
                <div className={styles.flipActions}>
                  <button type="button" className={styles.dangerBtn} onClick={handleEndGame}>
                    End Game
                  </button>
                  <button type="button" className={styles.secondaryBtn}
                    style={{ marginTop: 0 }}
                    onClick={handleContinueGame}>
                    {halfInning === 'TOP'
                      ? `Continue to Bottom ${inning}`
                      : `Continue to Extra Innings`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>End Game</h2>
                <p className={styles.flipText}>Are you sure you want to end the game?</p>
                <div className={styles.flipActions}>
                  <button type="button" className={styles.dangerBtn} onClick={handleEndGame}>
                    End Game
                  </button>
                  <button type="button" className={styles.secondaryBtn}
                    style={{ marginTop: 0 }}
                    onClick={() => setShowGameOverModal(false)}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast('')} />

      {/* Roster Modal */}
      {showRosterModal && (
        <div className={styles.overlay} onClick={() => setShowRosterModal(false)}>
          <div className={styles.gameLogModal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className={styles.gameLogHeader}>
              <h2>Roster — {game.away_team} @ {game.home_team}</h2>
              <button type="button" className={styles.closeLogBtn} onClick={() => setShowRosterModal(false)}>×</button>
            </div>
            <div className={styles.gameLogTable}>
              {[game.away_team, game.home_team].map((team) => {
                const activeTab = rosterTabByTeam[team] || 'batters';
                const batters = roster
                  .filter((p) => p.team === team && (p.player_role === 'batter' || p.player_role === 'both'))
                  .sort((a, b) => (a.batting_order || 99) - (b.batting_order || 99));
                const pitchers = roster
                  .filter((p) => p.team === team && (p.player_role === 'pitcher' || p.player_role === 'both'))
                  .sort((a, b) => (a.player_name || '').localeCompare(b.player_name || ''));
                const isDragging = rosterDragSrc?.team === team;
                return (
                  <div key={team}>
                    <div className={styles.rosterTeamHead}>{team}</div>
                    <div className={styles.rosterTabs}>
                      <button
                        type="button"
                        className={`${styles.rosterTab} ${activeTab === 'batters' ? styles.rosterTabActive : ''}`}
                        onClick={() => setRosterTabByTeam((prev) => ({ ...prev, [team]: 'batters' }))}
                      >Batters</button>
                      <button
                        type="button"
                        className={`${styles.rosterTab} ${activeTab === 'pitchers' ? styles.rosterTabActive : ''}`}
                        onClick={() => setRosterTabByTeam((prev) => ({ ...prev, [team]: 'pitchers' }))}
                      >Pitchers</button>
                    </div>

                    {activeTab === 'batters' ? (
                      <>
                        {/* Lineup slots 1-9 */}
                        {batters.filter((p, i) => (p.batting_order || (i + 1)) <= 9).length === 0 && (
                          <div className={styles.rosterEmpty}>No batters added yet.</div>
                        )}
                        {batters.map((p, i) => {
                          const order = p.batting_order || (i + 1);
                          if (order > 9) return null;
                          const ph = phMap[team]?.[order];
                          return (
                            <div key={p.id}>
                              <div
                                className={`${styles.rosterRow} ${ph ? styles.rosterRowReplaced : ''} ${isDragging && rosterDragOver === i ? styles.rosterRowOver : ''} ${isDragging && rosterDragSrc?.fromIdx === i ? styles.rosterRowDragging : ''}`}
                                draggable
                                onDragStart={() => setRosterDragSrc({ team, fromIdx: i })}
                                onDragOver={(e) => { e.preventDefault(); setRosterDragOver(i); }}
                                onDrop={() => handleRosterReorder(team, batters, rosterDragSrc?.fromIdx ?? i, i)}
                                onDragEnd={() => { setRosterDragSrc(null); setRosterDragOver(null); }}
                              >
                                <span className={styles.rosterDragHandle} title="Drag to reorder">⠿</span>
                                <span className={styles.rosterOrder}>{order}</span>
                                <span className={`${styles.rosterName} ${ph ? styles.rosterNameReplaced : ''}`}>{p.player_name}</span>
                                {p.bats && !ph && <span className={styles.rosterSide}>{p.bats}</span>}
                                <button type="button" className={styles.rosterRemoveBtn} onClick={() => handleRosterRemove(p)} title="Remove">×</button>
                              </div>
                              {ph && (
                                <div className={styles.rosterRowPH}>
                                  <span className={styles.phConnectorRoster}>└</span>
                                  <span className={styles.rosterName}>{ph.player_name}</span>
                                  {ph.bats && <span className={styles.rosterSide}>{ph.bats}</span>}
                                  <span className={styles.phBadgeRoster}>PH</span>
                                  <button type="button" className={styles.rosterRemoveBtn} onClick={() => handleRosterRemove(ph)} title="Remove PH">×</button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Bench — slots 10+ */}
                        {batters.some((p, i) => (p.batting_order || (i + 1)) > 9) && (
                          <div className={styles.benchSubLabel}>Bench</div>
                        )}
                        {batters.map((p, i) => {
                          const order = p.batting_order || (i + 1);
                          if (order <= 9) return null;
                          return (
                            <div key={p.id} className={styles.rosterRow}>
                              <span className={styles.rosterName}>{p.player_name}</span>
                              {p.bats && <span className={styles.rosterSide}>{p.bats}</span>}
                              <span className={styles.rosterSide} style={{ color: 'var(--text-muted)' }}>Bench</span>
                              <button type="button" className={styles.rosterRemoveBtn} onClick={() => handleRosterRemove(p)} title="Remove">×</button>
                            </div>
                          );
                        })}

                        {/* Add row: toggle between Batter and Pinch Hitter */}
                        <div className={styles.rosterAddTypeRow}>
                          <button type="button"
                            className={`${styles.rosterAddTypeBtn} ${!rosterPHMode[team] ? styles.rosterAddTypeBtnActive : ''}`}
                            onClick={() => setRosterPHMode((prev) => ({ ...prev, [team]: false }))}>
                            Batter
                          </button>
                          <button type="button"
                            className={`${styles.rosterAddTypeBtn} ${rosterPHMode[team] ? styles.rosterAddTypeBtnActive : ''}`}
                            onClick={() => setRosterPHMode((prev) => ({ ...prev, [team]: true }))}>
                            Pinch Hitter
                          </button>
                        </div>
                        {rosterPHMode[team] ? (
                          <div className={styles.rosterAddRow} style={{ flexWrap: 'wrap', gap: 6 }}>
                            <select
                              className={styles.rosterPHSelect}
                              value={rosterPHFor[team] || ''}
                              onChange={(e) => setRosterPHFor((prev) => ({ ...prev, [team]: e.target.value }))}
                            >
                              <option value="">PHing for...</option>
                              {batters.filter((b, i) => (b.batting_order || (i + 1)) <= 9).map((b, i) => (
                                <option key={b.id} value={b.batting_order || (i + 1)}>
                                  #{b.batting_order || (i + 1)} {b.player_name}
                                </option>
                              ))}
                            </select>
                            {(() => {
                              const benchNames = batters.filter((b, i) => (b.batting_order || (i + 1)) > 9);
                              return (
                                <>
                                  <input
                                    list={`bench-ph-list-${team}`}
                                    className={styles.rosterAddInput}
                                    placeholder="PH name or pick from bench..."
                                    value={rosterPHInputs[team] || ''}
                                    onChange={(e) => setRosterPHInputs((prev) => ({ ...prev, [team]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRosterAddPH(team, rosterPHFor[team], rosterPHInputs[team])}
                                  />
                                  {benchNames.length > 0 && (
                                    <datalist id={`bench-ph-list-${team}`}>
                                      {benchNames.map((b) => <option key={b.id} value={b.player_name} />)}
                                    </datalist>
                                  )}
                                </>
                              );
                            })()}
                            <button type="button" className={styles.rosterAddBtn}
                              onClick={() => handleRosterAddPH(team, rosterPHFor[team], rosterPHInputs[team])}
                              disabled={!rosterPHFor[team] || !(rosterPHInputs[team] || '').trim()}>
                              Add PH
                            </button>
                          </div>
                        ) : (
                          <div className={styles.rosterAddRow}>
                            <input
                              className={styles.rosterAddInput}
                              placeholder="Add batter name..."
                              value={rosterAddInputs[team] || ''}
                              onChange={(e) => setRosterAddInputs((prev) => ({ ...prev, [team]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && handleRosterAddBatter(team)}
                            />
                            <button type="button" className={styles.rosterAddBtn}
                              onClick={() => handleRosterAddBatter(team)}
                              disabled={!(rosterAddInputs[team] || '').trim()}>Add</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {pitchers.length === 0 && (
                          <div className={styles.rosterEmpty}>No pitchers added yet.</div>
                        )}
                        {pitchers.map((p) => (
                          <div key={p.id} className={styles.rosterRow}>
                            <span className={styles.rosterName}>{p.player_name}</span>
                            {p.throws && <span className={styles.rosterSide}>{p.throws}</span>}
                            <button type="button" className={styles.rosterRemoveBtn} onClick={() => handleRosterRemove(p)} title="Remove">×</button>
                          </div>
                        ))}
                        <div className={styles.rosterAddRow}>
                          <input
                            className={styles.rosterAddInput}
                            placeholder="Add pitcher name..."
                            value={rosterAddPitcherInputs[team] || ''}
                            onChange={(e) => setRosterAddPitcherInputs((prev) => ({ ...prev, [team]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleRosterAddPitcher(team)}
                          />
                          <button type="button" className={styles.rosterAddBtn}
                            onClick={() => handleRosterAddPitcher(team)}
                            disabled={!(rosterAddPitcherInputs[team] || '').trim()}>Add</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Game Log Modal */}
      {showGameLog && (
        <div className={styles.overlay} onClick={() => setShowGameLog(false)}>
          <div className={styles.gameLogModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.gameLogHeader}>
              <h2>Game Log — {game.away_team} @ {game.home_team}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={styles.csvBtn} onClick={() => exportCSV(gamePitches, game)}>
                  Download CSV
                </button>
                <button type="button" className={styles.closeLogBtn} onClick={() => setShowGameLog(false)}>×</button>
              </div>
            </div>
            <div className={styles.gameLogTable}>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Inning</th><th>Batter</th><th>Pitcher</th>
                    <th>Type</th><th>Outcome</th><th>Count</th><th>Runners</th>
                    <th>QOC</th><th>Spray</th><th>T2P</th>
                  </tr>
                </thead>
                <tbody>
                  {gamePitches.map((p) => (
                    <tr key={p.id}>
                      <td>{p.pitch_number}</td>
                      <td>{(p.half_inning === 'TOP' ? 'Top' : 'Bottom')} {p.inning}</td>
                      <td>{p.batter}{p.batter_side ? ` (${p.batter_side})` : ''}</td>
                      <td>{p.pitcher}{p.pitcher_side ? ` (${p.pitcher_side})` : ''}</td>
                      <td>{PITCH_TYPE_LABELS[p.pitch_type] || p.pitch_type || '—'}</td>
                      <td>{p.outcome}</td>
                      <td>{p.balls}-{p.strikes}</td>
                      <td>{normalizeRunners(p.runners)}</td>
                      <td>{QOC_EXPORT[p.quality_of_contact] || p.quality_of_contact || '—'}</td>
                      <td>{SPRAY_EXPORT[p.spray_chart] || p.spray_chart || '—'}</td>
                      <td>{p.time_to_plate_man_on_first ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function exportCSV(pitches, game) {
  const dateFormatted = game?.date
    ? new Date(game.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : '';
  const headers = [
    'Half Inning','Inning','Outs','Balls','Strikes','Count',
    'Batter_Team','Pitcher_Team','Date','Home Team','Away Team',
    'Time To Plate (sec) with Man on First',
    'Batter','Pitcher','Batter_Side','Pitcher_Side',
    'Pitch_Type','Outcome','Quality of Contact','Spray Chart',
    'Runners','Pitch_Location_X','Pitch_Location_Y','Notes',
  ];
  const rows = pitches.map((p) => {
    const qocExport = p.outcome === "Fielder's Choice Out"
      ? 'Ground Ball'
      : (QOC_EXPORT[p.quality_of_contact] || p.quality_of_contact || '');
    const sprayExport = SPRAY_EXPORT[p.spray_chart] || p.spray_chart || '';
    return [
      p.half_inning || '',
      p.inning ?? '',
      p.outs ?? '',
      p.balls ?? '',
      p.strikes ?? '',
      p.count || '',
      p.batter_team || '',
      p.pitcher_team || '',
      dateFormatted,
      game?.home_team || '',
      game?.away_team || '',
      p.time_to_plate_man_on_first != null ? p.time_to_plate_man_on_first : '',
      p.batter || '',
      p.pitcher || '',
      p.batter_side || '',
      p.pitcher_side || '',
      PITCH_TYPE_LABELS[p.pitch_type] || p.pitch_type || '',
      p.outcome || '',
      qocExport,
      sprayExport,
      normalizeRunners(p.runners),
      p.pitch_location_x != null ? p.pitch_location_x : '',
      p.pitch_location_y != null ? p.pitch_location_y : '',
      p.notes || '',
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${game.away_team}_at_${game.home_team}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
