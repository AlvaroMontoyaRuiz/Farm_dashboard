// GET /api/inventory?days=30&type=&kind=&from=&to=
//
// The bultos "kardex": every ingreso (food_lots) and every consumo
// (feed_consumption) in date order, with the running balance of each feed type
// after each movement. Used by the Bultos page.
//
//   summary : per feed type — received, consumed, remaining, daily average,
//             days left, last delivery, this month's in/out
//   series  : end-of-day stock per type for the last `days` days (chart)
//   ledger  : newest first, filtered, max 300 rows
//
// Stock is never stored: it is always received − consumed, so deleting or
// correcting a record fixes every balance automatically.

import { requireUser, json } from '../_lib/auth.js';
import { todayStr, lastDays, avgWindow } from '../_lib/time.js';

const TYPES = ['levante', 'finalizador'];
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (resp) {
    return resp;
  }

  const url = new URL(request.url);
  const days = [30, 60, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
  const fType = TYPES.includes(url.searchParams.get('type')) ? url.searchParams.get('type') : null;
  const fKind = ['ingreso', 'consumo'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : null;
  const fFrom = url.searchParams.get('from') || null;
  const fTo = url.searchParams.get('to') || null;

  const [lotsRes, consRes] = await Promise.all([
    env.DB.prepare(
      `SELECT f.id, f.type, f.bultos_received AS qty, f.received_at AS date, f.note,
              u.display_name AS who, f.created_at AS createdAt
         FROM food_lots f LEFT JOIN users u ON u.id = f.created_by`
    ).all(),
    env.DB.prepare(
      `SELECT fc.id, fc.food_type AS type, fc.bultos AS qty, fc.consumed_at AS date, fc.note,
              c.name AS corral, u.display_name AS who, fc.created_at AS createdAt
         FROM feed_consumption fc
         JOIN corrales c ON c.id = fc.corral_id
    LEFT JOIN users u ON u.id = fc.created_by`
    ).all(),
  ]);

  const events = [
    ...(lotsRes.results || []).map((x) => ({ ...x, kind: 'ingreso', corral: null, delta: Number(x.qty) })),
    ...(consRes.results || []).map((x) => ({ ...x, kind: 'consumo', delta: -Number(x.qty) })),
  ];
  events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.createdAt).localeCompare(String(b.createdAt)) ||
      (a.kind === b.kind ? a.id - b.id : a.kind === 'ingreso' ? -1 : 1)
  );

  // running balance per type
  const bal = { levante: 0, finalizador: 0 };
  const minBal = { levante: 0, finalizador: 0 };
  for (const e of events) {
    bal[e.type] += e.delta;
    minBal[e.type] = Math.min(minBal[e.type], bal[e.type]);
    e.balance = r2(bal[e.type]);
    e.qty = r2(e.qty);
  }

  // ---- series: end-of-day stock for the last N days
  const today = todayStr();
  const dates = lastDays(today, days);
  const run = { levante: 0, finalizador: 0 };
  let i = 0;
  while (i < events.length && events[i].date < dates[0]) {
    run[events[i].type] += events[i].delta;
    i++;
  }
  const series = dates.map((date) => {
    while (i < events.length && events[i].date <= date) {
      run[events[i].type] += events[i].delta;
      i++;
    }
    return { date, levante: r2(run.levante), finalizador: r2(run.finalizador) };
  });

  // ---- summary
  const monthStart = today.slice(0, 8) + '01';
  const firstConsumption = events.find((e) => e.kind === 'consumo');
  const win = avgWindow(firstConsumption && firstConsumption.date, today);

  const summary = {};
  for (const t of TYPES) {
    const mine = events.filter((e) => e.type === t);
    const received = mine.filter((e) => e.kind === 'ingreso').reduce((s, e) => s + e.qty, 0);
    const consumed = mine.filter((e) => e.kind === 'consumo').reduce((s, e) => s + e.qty, 0);
    const remaining = r2(received - consumed);
    const week = mine.filter((e) => e.kind === 'consumo' && e.date >= win.from && e.date <= win.to).reduce((s, e) => s + e.qty, 0);
    const avgDaily = r2(week / win.days);
    const lastLot = [...mine].reverse().find((e) => e.kind === 'ingreso');
    summary[t] = {
      received: r2(received),
      consumed: r2(consumed),
      remaining,
      avgDaily,
      daysLeft: avgDaily > 0 && remaining > 0 ? Math.floor(remaining / avgDaily) : null,
      lastLot: lastLot ? { date: lastLot.date, bultos: lastLot.qty } : null,
      monthIn: r2(mine.filter((e) => e.kind === 'ingreso' && e.date >= monthStart).reduce((s, e) => s + e.qty, 0)),
      monthOut: r2(mine.filter((e) => e.kind === 'consumo' && e.date >= monthStart).reduce((s, e) => s + e.qty, 0)),
      wentNegative: minBal[t] < -0.0001,
    };
  }

  // ---- ledger (filtered, newest first)
  let rows = events;
  if (fType) rows = rows.filter((e) => e.type === fType);
  if (fKind) rows = rows.filter((e) => e.kind === fKind);
  if (fFrom) rows = rows.filter((e) => e.date >= fFrom);
  if (fTo) rows = rows.filter((e) => e.date <= fTo);
  const total = rows.length;
  const ledger = rows
    .slice()
    .reverse()
    .slice(0, 300)
    .map((e) => ({
      key: `${e.kind}-${e.id}`,
      kind: e.kind,
      date: e.date,
      type: e.type,
      qty: e.qty,
      balance: e.balance,
      corral: e.corral,
      who: e.who,
      note: e.note,
      createdAt: e.createdAt,
    }));

  return json({ today, summary, series, ledger, ledgerTotal: total });
};
