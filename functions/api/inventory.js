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
//   costs   : what the bultos cost (prices are stored WITHOUT IVA; IVA is calculated)
//
// Stock is never stored: it is always received − consumed, so deleting or
// correcting a record fixes every balance automatically.

import { requireUser, requireAdmin, json } from '../_lib/auth.js';
import { todayStr, lastDays, avgWindow } from '../_lib/time.js';
import { compareEvents } from '../_lib/stock.js';
import { FOOD_TYPES as TYPES, IVA_RATE, zeroByType, costOf } from '../_lib/foods.js';
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export const onRequestGet = async ({ request, env }) => {
  try {
    requireAdmin(await requireUser(request, env));
  } catch (resp) {
    return resp;
  }

  const url = new URL(request.url);
  const days = [30, 60, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
  const fType = TYPES.includes(url.searchParams.get('type')) ? url.searchParams.get('type') : null;
  const fKind = ['ingreso', 'consumo'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : null;
  const fFrom = url.searchParams.get('from') || null;
  const fTo = url.searchParams.get('to') || null;

  const [lotsRes, consRes, typesRes] = await Promise.all([
    env.DB.prepare(
      `SELECT f.id, f.type, f.bultos_received AS qty, f.price_per_bulto AS price, f.received_at AS date, f.note,
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
    env.DB.prepare(`SELECT type, kg_per_bulto AS kg FROM food_types`).all(),
  ]);

  const events = [
    ...(lotsRes.results || []).map((x) => ({ ...x, kind: 'ingreso', corral: null, delta: Number(x.qty) })),
    ...(consRes.results || []).map((x) => ({ ...x, kind: 'consumo', delta: -Number(x.qty) })),
  ];
  // same-day order: deliveries first (see compareEvents), so balances here match the rules
  events.sort(compareEvents);

  // running balance per type
  const bal = zeroByType();
  const minBal = zeroByType();
  for (const e of events) {
    bal[e.type] += e.delta;
    minBal[e.type] = Math.min(minBal[e.type], bal[e.type]);
    e.balance = r2(bal[e.type]);
    e.qty = r2(e.qty);
  }

  // ---- series: end-of-day stock for the last N days
  const today = todayStr();
  const dates = lastDays(today, days);
  const run = zeroByType();
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
    return { date, ...Object.fromEntries(TYPES.map((t) => [t, r2(run[t])])) };
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

  // ---- costs. Only deliveries that have a price count (older ones may not).
  const kgOf = {};
  for (const t of typesRes.results || []) kgOf[t.type] = Number(t.kg);
  const byType = {};
  let totNet = 0, totBultos = 0, noPrice = 0;
  for (const t of TYPES) {
    const lots = events.filter((e) => e.type === t && e.kind === 'ingreso');
    const priced = lots.filter((e) => e.price != null);
    const bultos = priced.reduce((s, e) => s + e.qty, 0);
    const net = priced.reduce((s, e) => s + e.qty * e.price, 0);
    const last = [...priced].reverse()[0];
    const avg = bultos > 0 ? net / bultos : null;
    const c = costOf(1, avg);
    byType[t] = {
      bultos: r2(bultos),
      pricedLots: priced.length,
      lotsWithoutPrice: lots.length - priced.length,
      totalNet: r2(net),
      totalIva: r2(net * IVA_RATE),
      totalGross: r2(net * (1 + IVA_RATE)),
      avgNet: avg == null ? null : r2(avg),
      avgGross: c ? c.priceGross : null,
      avgNetPerKg: avg != null && kgOf[t] > 0 ? r2(avg / kgOf[t]) : null,
      lastPrice: last ? { date: last.date, net: r2(last.price), gross: r2(last.price * (1 + IVA_RATE)) } : null,
    };
    totNet += net;
    totBultos += bultos;
    noPrice += lots.length - priced.length;
  }
  const costs = {
    ivaRate: IVA_RATE,
    byType,
    total: { bultos: r2(totBultos), net: r2(totNet), iva: r2(totNet * IVA_RATE), gross: r2(totNet * (1 + IVA_RATE)), lotsWithoutPrice: noPrice },
  };

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

  return json({ today, summary, series, costs, ledger, ledgerTotal: total });
};
