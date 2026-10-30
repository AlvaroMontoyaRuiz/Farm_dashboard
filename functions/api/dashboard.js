// GET /api/dashboard
// One request that feeds the whole Panel page:
//   - stock per feed type, with an estimate of how many days it will last
//   - today's consumption vs. the recent daily average
//   - last 30 days of consumption (stacked by feed type)
//   - one entry per corral: animals, fed today?, bultos today, 7-day average
//   - the lotes (groups of corrales) with their animals and today's feeding
//   - the latest activity across consumption, animal movements and food lots

import { requireUser, requireAdmin, json } from '../_lib/auth.js';
import { todayStr, addDays, lastDays, avgWindow } from '../_lib/time.js';
import { FOOD_TYPES as TYPES, zeroByType } from '../_lib/foods.js';
import { loadBatches } from '../_lib/batches.js';
// Warn the administrator when a type of bulto is below this many bultos in storage.
const LOW_STOCK_BULTOS = 40;
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export const onRequestGet = async ({ request, env }) => {
  try {
    requireAdmin(await requireUser(request, env)); // the Panel is for the administrator only
  } catch (resp) {
    return resp;
  }

  const today = todayStr();
  const from30 = addDays(today, -29);

  const firstRow = await env.DB.prepare(`SELECT MIN(consumed_at) AS d FROM feed_consumption`).first();
  const win = avgWindow(firstRow && firstRow.d, today);

  const [lots, consumedAll, daily, animals, perCorral, activity, lotesRes, batchesByLote, pendingRes] = await Promise.all([
    env.DB.prepare(`SELECT type, COALESCE(SUM(bultos_received),0) AS n FROM food_lots GROUP BY type`).all(),
    env.DB.prepare(`SELECT food_type AS type, COALESCE(SUM(bultos),0) AS n FROM feed_consumption GROUP BY food_type`).all(),
    env.DB.prepare(
      `SELECT consumed_at AS d, food_type AS t, SUM(bultos) AS n
         FROM feed_consumption WHERE consumed_at BETWEEN ? AND ? GROUP BY consumed_at, food_type`
    )
      .bind(from30, today)
      .all(),
    env.DB.prepare(
      `SELECT c.id, c.name, c.lote_id AS loteId,
              COALESCE(SUM(CASE WHEN m.movement='ingreso' THEN m.quantity ELSE -m.quantity END), 0) AS animals
         FROM corrales c LEFT JOIN animal_movements m ON m.corral_id = c.id
        GROUP BY c.id ORDER BY c.id`
    ).all(),
    env.DB.prepare(
      `SELECT corral_id AS id,
              SUM(CASE WHEN consumed_at = ? THEN bultos ELSE 0 END) AS today,
              SUM(CASE WHEN consumed_at BETWEEN ? AND ? THEN bultos ELSE 0 END) AS week,
              SUM(CASE WHEN consumed_at = ? THEN 1 ELSE 0 END) AS entriesToday
         FROM feed_consumption WHERE consumed_at BETWEEN ? AND ? GROUP BY corral_id`
    )
      .bind(today, win.from, win.to, today, win.from, today)
      .all(),
    env.DB.prepare(
      `SELECT * FROM (
         SELECT 'consumo' AS kind, fc.created_at AS ts, u.display_name AS who, c.name AS corral,
                fc.food_type AS sub, fc.bultos AS qty, fc.note AS note
           FROM feed_consumption fc JOIN corrales c ON c.id = fc.corral_id
      LEFT JOIN users u ON u.id = fc.created_by
         UNION ALL
         SELECT 'animales', m.created_at, u.display_name, c.name,
                CASE WHEN m.reason = 'traslado' THEN 'traslado_' || m.movement ELSE COALESCE(m.reason, m.movement) END, m.quantity, m.note
           FROM animal_movements m JOIN corrales c ON c.id = m.corral_id
      LEFT JOIN users u ON u.id = m.created_by
         UNION ALL
         SELECT 'ingreso', f.created_at, u.display_name, NULL, f.type, f.bultos_received, f.note
           FROM food_lots f LEFT JOIN users u ON u.id = f.created_by
       ) ORDER BY ts DESC LIMIT 12`
    ).all(),
    env.DB.prepare(`SELECT id, name FROM lotes ORDER BY id`).all(),
    loadBatches(env, today),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM transfer_requests WHERE status = 'pendiente'`).first(),
  ]);

  // ---- trend (30 days, missing days filled with zero)
  const byDay = {};
  for (const row of daily.results || []) {
    byDay[row.d] = byDay[row.d] || zeroByType();
    byDay[row.d][row.t] = Number(row.n);
  }
  const trend = lastDays(today, 30).map((date) => ({
    date,
    ...Object.fromEntries(TYPES.map((t) => [t, r2(byDay[date]?.[t])])),
  }));

  // ---- stock per type
  const received = zeroByType();
  const consumed = zeroByType();
  for (const x of lots.results || []) received[x.type] = Number(x.n);
  for (const x of consumedAll.results || []) consumed[x.type] = Number(x.n);

  const inWindow = trend.filter((d) => d.date >= win.from && d.date <= win.to);
  const stock = {};
  for (const t of TYPES) {
    const remaining = r2(received[t] - consumed[t]);
    const avgDaily = r2(inWindow.reduce((s, d) => s + d[t], 0) / win.days);
    stock[t] = {
      received: r2(received[t]),
      consumed: r2(consumed[t]),
      remaining,
      avgDaily,
      daysLeft: avgDaily > 0 && remaining > 0 ? Math.floor(remaining / avgDaily) : null,
    };
  }

  // ---- today
  const todayRow = trend[trend.length - 1];
  const todayTotal = r2(TYPES.reduce((s, t) => s + todayRow[t], 0));
  const avgTotal = r2(TYPES.reduce((s, t) => s + stock[t].avgDaily, 0));

  // ---- corrales
  const consById = {};
  for (const x of perCorral.results || []) consById[x.id] = x;
  const corrales = (animals.results || []).map((c) => {
    const k = consById[c.id];
    return {
      id: c.id,
      name: c.name,
      loteId: c.loteId == null ? null : Number(c.loteId),
      animals: Number(c.animals),
      todayBultos: r2(k?.today),
      avgDaily: r2((k?.week || 0) / win.days),
      fedToday: !!(k && k.entriesToday > 0),
    };
  });
  const active = corrales.filter((c) => c.animals > 0);

  // ---- lotes: groups of corrales (lote_id on each corral). Corrales without a lote go to "Sin lote".
  const mkLote = (id, name) => {
    const bs = id == null ? [] : batchesByLote.get(id) || [];
    const closed = bs.filter((b) => !b.open);
    const mine = corrales.filter((c) => c.loteId === id);
    const withAnimals = mine.filter((c) => c.animals > 0);
    return {
      id,
      name,
      animals: mine.reduce((s, c) => s + c.animals, 0),
      corrales: mine.map((c) => ({ id: c.id, name: c.name, animals: c.animals, fedToday: c.fedToday })),
      activeCorrales: withAnimals.length,
      fedCorrales: withAnimals.filter((c) => c.fedToday).length,
      todayBultos: r2(mine.reduce((s, c) => s + c.todayBultos, 0)),
      // mortality of the batch in progress (null when the lote is empty) and of the last finished one
      batch: bs.find((b) => b.open) || null,
      lastBatch: closed.length ? closed[closed.length - 1] : null,
    };
  };
  const lotes = (lotesRes.results || []).map((l) => mkLote(Number(l.id), l.name));
  const loose = mkLote(null, 'Sin lote');

  return json({
    today,
    totalAnimals: corrales.reduce((s, c) => s + c.animals, 0),
    activeCorrales: active.length,
    fedCorrales: active.filter((c) => c.fedToday).length,
    todayConsumption: { ...Object.fromEntries(TYPES.map((t) => [t, todayRow[t]])), total: todayTotal },
    avgDailyConsumption: avgTotal,
    stock,
    trend,
    lowStockLimit: LOW_STOCK_BULTOS,
    pendingRequests: Number(pendingRes?.n || 0),
    corrales,
    lotes,
    sinLote: loose.corrales.length ? loose : null,
    activity: activity.results || [],
  });
};
