export const PA_ENDING_OUTCOMES = new Set([
  'Walk', 'Intentional Walk', 'Hit By Pitch', 'Catcher Interference',
  'Single', 'Double', 'Triple', 'Home Run',
  'Groundout', 'Flyout', 'Lineout', 'Popout',
  'Strikeout Swinging', 'Strikeout Looking',
  'Dropped Third Strike Swinging', 'Dropped Third Strike Looking',
  'Sacrifice Fly', 'Sacrifice Bunt',
  'Double Play', 'Triple Play',
  "Fielder's Choice Out", "Fielder's Choice Safe",
  'Error', 'Batter Interference',
]);

export const OUT_OUTCOMES = new Set([
  'Groundout', 'Flyout', 'Lineout', 'Popout',
  'Strikeout Swinging', 'Strikeout Looking',
  'Sacrifice Fly', 'Sacrifice Bunt',
  "Fielder's Choice Out",
  'Batter Interference',
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
  if (outcome === 'Walk' || outcome === 'Intentional Walk') {
    return { balls: 0, strikes: 0, paEnded: true, outsAdded: 0 };
  }
  if (outcome === 'Hit By Pitch' || outcome === 'Catcher Interference') {
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
  if (outcome === 'Dropped Third Strike Swinging' || outcome === 'Dropped Third Strike Looking') {
    return { balls: 0, strikes: 0, paEnded: true, outsAdded: 0 };
  }
  if (outcome === 'Triple Play') {
    return { balls: 0, strikes: 0, paEnded: true, outsAdded: 3 };
  }
  if (outcome === 'Pickoff' || outcome === 'Caught Stealing' || outcome === 'Additional Out' || outcome === 'Truncated Out') {
    return { balls, strikes, paEnded: false, outsAdded: 1 };
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

export function advanceRunnersForOutcome(runners, outcome) {
  if (outcome === 'Walk' || outcome === 'Intentional Walk' || outcome === 'Hit By Pitch' || outcome === 'Catcher Interference' || outcome === 'Dropped Third Strike Swinging' || outcome === 'Dropped Third Strike Looking') {
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
  if (outcome === "Fielder's Choice Safe") {
    // Batter reaches 1st safely; a runner was thrown out (scorer adjusts runners manually)
    return '1' + runners[1] + runners[2];
  }
  return runners;
}
