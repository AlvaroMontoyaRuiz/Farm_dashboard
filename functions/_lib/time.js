// The farm is in Colombia (UTC-5, no daylight saving). SQLite's date('now') and
// JS's toISOString() both use UTC, which would file anything recorded after
// 7:00 pm under TOMORROW's date. Everything that needs "today" goes through here.

const OFFSET_HOURS = -5;

// SQL expression for today's date on the farm, e.g. "2026-10-19".
export const TODAY_SQL = "date('now','-5 hours')";

// Same thing in JS.
export function todayStr() {
  return new Date(Date.now() + OFFSET_HOURS * 3600 * 1000).toISOString().slice(0, 10);
}

// 'YYYY-MM-DD' + n days -> 'YYYY-MM-DD'. Pure calendar math, no timezone involved.
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ['2026-10-17','2026-10-18','2026-10-19'] for (end='2026-10-19', count=3)
export function lastDays(end, count) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

// Window used for "average daily consumption". Today is excluded because it is
// still in progress (counting half a day would understate the average and make
// the stock look like it lasts longer than it does). Uses up to the last 7 full
// days; if the farm has fewer, uses what exists. If there is no full day yet
// (first day of use), falls back to today alone.
export function avgWindow(firstDate, today) {
  if (!firstDate || firstDate >= today) return { from: today, to: today, days: 1 };
  const diff = Math.round((new Date(today + 'T00:00:00Z') - new Date(firstDate + 'T00:00:00Z')) / 86400000);
  const days = Math.min(7, diff);
  return { from: addDays(today, -days), to: addDays(today, -1), days };
}
