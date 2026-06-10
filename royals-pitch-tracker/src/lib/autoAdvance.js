export const PA_ENDING_OUTCOMES = new Set([
  'Walk', 'Hit By Pitch',
  'Single', 'Double', 'Triple', 'Home Run',
  'Groundout', 'Flyout', 'Lineout',
  'Strikeout Swinging', 'Strikeout Looking',
  'Sacrifice Fly', 'Sacrifice Bunt',
  'Double Play', "Fielder's Choice", 'Error',
]);

export const OUT_OUTCOMES = new Set([
  'Groundout', 'Flyout', 'Lineout',
  'Strikeout Swinging', 'Strikeout Looking',
  'Sacrifice Fly', 'Sacrifice Bunt',
  "Fielder's Choice", 'Error',
]);

export const IN_PLAY_OUTCOMES = new Set([
  'Single', 'Double', 'Triple', 'Home Run',
  'Groundout', 'Flyout', 'Lineout',
  'Sacrifice Fly', 'Sacrifice Bunt',
  'Double Play', "Fielder's Choice", 'Error',
]);

/**
 * Returns new { balls, strikes, paEnded, outsAdded } given current count and outcome.
 */
export function advanceCount(balls, strikes, outcome) {
  if (outcome === 'Ball') {
    const newBalls = balls + 1;
    if (newBalls >= 4) return { balls: 0, strikes: 0, paEnded: true, outsAdded: 0 };
    return { balls: newBalls, strikes, paEnded: false, outsAdded: 0 };
  }
  if (outcome === 'Walk') {
    return { balls: 0, strikes: 0, paEnded: true, outsAdded: 0 };
  }
  if (outcome === 'Hit By Pitch') {
    return { balls: 0, strikes: 0, paEnded: true, outsAdded: 0 };
  }
  if (outcome === 'Called Strike') {
    const newStrikes = strikes + 1;
    if (newStrikes >= 3) return { balls: 0, strikes: 0, paEnded: true, outsAdded: 1 };
    return { balls, strikes: newStrikes, paEnded: false, outsAdded: 0 };
  }
  if (outcome === 'Swinging Strike') {
    const newStrikes = strikes + 1;
    if (newStrikes >= 3) return { balls: 0, strikes: 0, paEnded: true, outsAdded: 1 };
    return { balls, strikes: newStrikes, paEnded: false, outsAdded: 0 };
  }
  if (outcome === 'Foul') {
    if (strikes < 2) return { balls, strikes: strikes + 1, paEnded: false, outsAdded: 0 };
    return { balls, strikes, paEnded: false, outsAdded: 0 };
  }
  if (outcome === 'Strikeout Swinging' || outcome === 'Strikeout Looking') {
    return { balls: 0, strikes: 0, paEnded: true, outsAdded: 1 };
  }
  if (outcome === 'Double Play') {
    return { balls: 0, strikes: 0, paEnded: true, outsAdded: 2 };
  }
  if (OUT_OUTCOMES.has(outcome)) {
    return { balls: 0, strikes: 0, paEnded: true, outsAdded: 1 };
  }
  if (PA_ENDING_OUTCOMES.has(outcome)) {
    return { balls: 0, strikes: 0, paEnded: true, outsAdded: 0 };
  }
  return { balls, strikes, paEnded: false, outsAdded: 0 };
}

/**
 * Returns new runners string ('000'–'111') based on outcome and prior runners.
 * Complex situations left for scorer to adjust manually.
 */
export function advanceRunners(runners, outcome) {
  if (outcome === 'Walk' || outcome === 'Hit By Pitch') {
    if (runners === '000') return '100';
    if (runners === '100') return '110';
    if (runners === '110') return '111';
    if (runners === '010') return '110';
    return runners; // manual
  }
  if (outcome === 'Single') return '1' + runners[1] + runners[2];
  if (outcome === 'Double') return '0' + '2'[0] + runners[2]; // set 2nd, keep 3rd
  // Actually: Double sets 020 but keep 3rd
  // runners = r1 r2 r3
  if (outcome === 'Double') {
    return '0' + '1' + runners[2];
  }
  if (outcome === 'Triple') return '001';
  if (outcome === 'Home Run') return '000';
  if (outcome === 'Double Play') {
    // clear one base
    if (runners[0] === '1') return '0' + runners[1] + runners[2];
    if (runners[1] === '1') return runners[0] + '0' + runners[2];
    return runners[0] + runners[1] + '0';
  }
  return runners;
}

/**
 * Properly handle Double outcome separately.
 */
export function advanceRunnersForOutcome(runners, outcome) {
  if (outcome === 'Walk' || outcome === 'Hit By Pitch') {
    if (runners === '000') return '100';
    if (runners === '100') return '110';
    if (runners === '110') return '111';
    if (runners === '010') return '110';
    if (runners === '001') return '101';
    if (runners === '101') return '111';
    if (runners === '011') return '111';
    if (runners === '111') return '111';
    return runners;
  }
  if (outcome === 'Single') {
    // batter to 1st, prior runners advance (scorer adjusts)
    return '1' + runners[1] + runners[2];
  }
  if (outcome === 'Double') {
    // batter to 2nd
    return '0' + '1' + runners[2];
  }
  if (outcome === 'Triple') {
    return '001';
  }
  if (outcome === 'Home Run') {
    return '000';
  }
  if (outcome === 'Double Play') {
    if (runners[0] === '1') return '0' + runners[1] + runners[2];
    if (runners[1] === '1') return runners[0] + '0' + runners[2];
    return runners[0] + runners[1] + '0';
  }
  return runners;
}

export function nextBatterIndex(currentIndex, rosterLength) {
  return (currentIndex + 1) % rosterLength;
}
