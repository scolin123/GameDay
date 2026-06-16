import Papa from 'papaparse';

const QOC_FULL = {
  GB: 'Ground Ball',
  LD: 'Line Drive',
  PU: 'Pop Up',
  FB: 'Fly Ball',
};

const SPRAY_FULL = {
  Pull: 'Pull',
  Straight: 'Straightaway',
  Oppo: 'Opposite Field',
};

const PITCH_TYPE_FULL = {
  FB: 'Fastball',
  OS: 'Offspeed',
  CB: 'Curveball',
  SL: 'Slider',
  CH: 'Changeup',
  CT: 'Cutter',
  SK: 'Sinker',
  SV: 'Slurve',
  SW: 'Sweeper',
  SP: 'Splitter',
  OT: 'Other',
  UN: 'Unknown',
};

function safe(val) {
  return val == null ? '' : val;
}

function formatGameDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

function buildFilename(game) {
  const date = formatGameDate(game.date).replace(/,/g, '').replace(/\s+/g, '_');
  const home = (game.home_team || '').replace(/\s+/g, '_');
  const away = (game.away_team || '').replace(/\s+/g, '_');
  return `${home}_vs_${away}_${date}.csv`;
}

export async function exportGameCsv(gameId, supabase) {
  const [{ data: game, error: gameErr }, { data: pitches, error: pitchErr }] = await Promise.all([
    supabase.from('games').select('*').eq('id', gameId).single(),
    supabase.from('pitches').select('*').eq('game_id', gameId).order('pitch_number', { ascending: true }),
  ]);

  if (gameErr || pitchErr) {
    console.error('Export error:', gameErr || pitchErr);
    return;
  }

  const dateFormatted = formatGameDate(game.date);

  const rows = (pitches || []).map((p) => ({
    'Half Inning': safe(p.half_inning),
    'Inning': safe(p.inning),
    'Outs': safe(p.outs),
    'Balls': safe(p.balls),
    'Strikes': safe(p.strikes),
    'Count': safe(p.count),
    'Batter_Team': safe(p.batter_team),
    'Pitcher_Team': safe(p.pitcher_team),
    'Date': dateFormatted,
    'Home Team': safe(game.home_team),
    'Away Team': safe(game.away_team),
    'Time To Plate (sec) with Man on First': safe(p.time_to_plate_man_on_first),
    'Batter': safe(p.batter),
    'Pitcher': safe(p.pitcher),
    'Batter_Side': safe(p.batter_side),
    'Pitcher_Side': safe(p.pitcher_side),
    'Pitch_Type': p.pitch_type ? (PITCH_TYPE_FULL[p.pitch_type] || p.pitch_type) : '',
    'Outcome': safe(p.outcome),
    'Quality of Contact': p.quality_of_contact ? (QOC_FULL[p.quality_of_contact] || p.quality_of_contact) : '',
    'Spray Chart': p.spray_chart ? (SPRAY_FULL[p.spray_chart] || p.spray_chart) : '',
    'Runners': safe(p.runners),
    'Pitch_Location_X': safe(p.pitch_location_x),
    'Pitch_Location_Y': safe(p.pitch_location_y),
    'Notes': safe(p.notes),
  }));

  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFilename(game);
  a.click();
  URL.revokeObjectURL(url);
}
