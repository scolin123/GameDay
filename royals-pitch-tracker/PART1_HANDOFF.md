# Part 1 Handoff

## Completed
- Project scaffold (Vite + React + CSS Modules)
- Global styles and CSS tokens (`src/styles/global.css`, IBM Plex Sans from Google Fonts)
- Supabase client (`src/lib/supabase.js`)
- Auth (Login page, protected routes via `ProtectedRoute` in App.jsx, sign out)
- Dashboard (game list with pitch/inning counts, Score/Log/Export CSV per row, empty state)
- New Game (two-step form: game info → roster builder with per-team panels, validation)
- Live Scoring (full implementation — see details below)

## Stubs to complete in Part 2
- `src/pages/GameLog.jsx` — currently renders placeholder text
- `src/lib/exportCsv.js` — currently a no-op `console.log` function

## File structure
```
royals-pitch-tracker/
├── .claude/
│   └── launch.json
├── public/
├── src/
│   ├── components/
│   │   ├── BaseDiamond.jsx + BaseDiamond.module.css
│   │   ├── ChangePitcherModal.jsx + ChangePitcherModal.module.css
│   │   ├── GameCard.jsx + GameCard.module.css
│   │   ├── OutcomeButtons.jsx + OutcomeButtons.module.css
│   │   ├── PitchTypeButtons.jsx + PitchTypeButtons.module.css
│   │   ├── StrikeZone.jsx + StrikeZone.module.css
│   │   └── Toast.jsx + Toast.module.css
│   ├── hooks/
│   │   ├── useGame.js
│   │   └── useRoster.js
│   ├── lib/
│   │   ├── autoAdvance.js
│   │   ├── exportCsv.js      ← stub
│   │   └── supabase.js
│   ├── pages/
│   │   ├── Dashboard.jsx + Dashboard.module.css
│   │   ├── GameLog.jsx + GameLog.module.css   ← stub
│   │   ├── LiveScoring.jsx + LiveScoring.module.css
│   │   ├── Login.jsx + Login.module.css
│   │   └── NewGame.jsx + NewGame.module.css
│   ├── styles/
│   │   └── global.css
│   ├── App.jsx
│   └── main.jsx
├── .claude/launch.json
├── .env.example
├── .env                      ← fill with real Supabase creds
├── vercel.json
├── README.md
└── package.json
```

## Key implementation notes for Part 2

### State architecture in LiveScoring.jsx
- All game state (inning, outs, balls, strikes, runners, pitchNumber, currentPitcher, batterIdx per team) lives in `useState` in `LiveScoring.jsx` — no context or external store.
- State is restored from the last pitch row in Supabase on initial load (`loadGameData`), so refreshing the page mid-game recovers correctly.
- `recentPitches` is kept as local state (last 5, prepended on submit). Undo operates on `recentPitches[0].id` — the Supabase UUID returned from the insert (`.select().single()`).

### autoAdvance.js
- `advanceCount(balls, strikes, outcome)` → `{ balls, strikes, paEnded, outsAdded }` — drives all count/PA transitions.
- `advanceRunnersForOutcome(runners, outcome)` → new runners string. Complex situations (e.g. walk with bases loaded) auto-advance simple cases; scorer manually adjusts the diamond for others.
- `PA_ENDING_OUTCOMES` and `IN_PLAY_OUTCOMES` are exported Sets used by LiveScoring to control QOC/spray visibility and at-bat sequence resets.

### Roster encoding
- `player_role` is stored lowercase in Supabase: `'batter'`, `'pitcher'`, `'both'`. NewGame.jsx lowercases before insert.
- Batters list = players where role is `batter` or `both`. Pitchers list = `pitcher` or `both`.
- TOP of inning: away bats, home pitches. BOTTOM: home bats, away pitches.

### CSV export (Part 2)
- All pitch fields are already being stored in the `pitches` table with the correct column names. The export just needs to `SELECT *` ordered by `pitch_number` and map to the Google Sheets column order.
- `src/lib/exportCsv.js` already imports PapaParse (`papaparse`) which is installed.

### Game Log (Part 2)
- The `pitches` table has all needed data. A simple ordered table of all pitches with filtering by inning/batter/pitcher is the expected output.
- `useGame.js` and `useRoster.js` hooks are available for loading game metadata and roster.
