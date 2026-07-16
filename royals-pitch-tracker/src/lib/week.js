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

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}
