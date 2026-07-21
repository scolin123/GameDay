// Monday-based week helpers. All dates are 'YYYY-MM-DD' strings in UTC so they
// line up with the date-only columns in Postgres regardless of local timezone.

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}

// Monday of the week containing dateStr
export function weekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(dateStr, diff);
}

export function weekEnd(weekStartStr) {
  return addDays(weekStartStr, 6);
}

export function inWeek(dateStr, weekStartStr) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= weekStartStr && d <= weekEnd(weekStartStr);
}

export function formatWeekLabel(weekStartStr) {
  const start = new Date(`${weekStartStr}T00:00:00Z`);
  const end = new Date(`${weekEnd(weekStartStr)}T00:00:00Z`);
  const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${s} – ${e}`;
}

// Today as the user's *local* calendar date. Deliberately not UTC: game_date is
// a date-only column, so "has this game passed?" has to be judged against the
// day the user is actually living in. toISOString() would roll over to tomorrow
// after 8pm Eastern and push the current week/day forward a day early.
export function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
