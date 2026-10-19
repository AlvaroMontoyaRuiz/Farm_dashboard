// GET /api/dashboard
// One request that feeds the whole Panel page:
//   - stock per feed type, with an estimate of how many days it will last
//   - today's consumption vs. the recent daily average
//   - last 30 days of consumption (stacked by feed type)
//   - one entry per corral: animals, fed today?, bultos today, 7-day average
//   - the latest activity across consumption, animal movements and food lots

import { requireUser, json } from '../_lib/auth.js';
import { todayStr, addDays, lastDays, avgWindow } from '../_lib/time.js';

const TYPES = ['levante', 'finalizador'];
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (resp) {
    return resp;
  }

  const today = todayStr();
  const from30 = addDays(today, -29);

  const firstRow = await env.DB.prepare(`SELECT MIN(consumed_at) AS d FROM feed_consumption`).first();
  const win = avgWindow(firstRow && firstRow.d, today);

  const [lots, consumedAll, daily, animals, perCorral, activity] = await Promise.all([
    env.DB.prepare(`SELECT type, COALESCE(SUM(bultos_received),0) AS n FROM food_lots GROUP BY type`).all(),
    env.DB.prepare(`SELECT food_type AS type, COALESCE(SUM(bultos),0) AS n FROM feed_consumption GROUP BY food_type`).all(),
    env.DB.prepare(
      `SELECT consumed_at AS d, food_type AS t, SUM(bultos) AS n
         FROM feed_consumption WHERE consumed_at BETWEEN ? AND ? GROUP BY consumed_at, food_type`
    )
      .bind(from30, today)
      .all(),
    env.DB.prepare(
      `SELECT c.id, c.name,
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
         SELECT 'animales', m.created_at, u.display_name, c.name, m.movement, m.quantity, m.note
           FROM animal_movements m JOIN corrales c ON c.id = m.corral_id
      LEFT JOIN users u ON u.id = m.created_by
         UNION ALL
         SELECT 'ingreso', f.created_at, u.display_name, NULL, f.type, f.bultos_received, f.note
           FROM food_lots f LEFT JOIN users u ON u.id = f.created_by
       ) ORDER BY ts DESC LIMIT 12`
    ).all(),
  ]);

  // ---- trend (30 days, missing days filled with zero)
  const byDay = {};
  for (const row of daily.results || []) {
    byDay[row.d] = byDay[row.d] || { levante: 0, finalizador: 0 };
    byDay[row.d][row.t] = Number(row.n);
  }
  const trend = lastDays(today, 30).map((date) => ({
    date,
    levante: r2(byDay[date]?.levante),
    finalizador: r2(byDay[date]?.finalizador),
  }));

  // ---- stock per type
  const received = { levante: 0, finalizador: 0 };
  const consumed = { levante: 0, finalizador: 0 };
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
  const todayTotal = r2(todayRow.levante + todayRow.finalizador);
  const avgTotal = r2(stock.levante.avgDaily + stock.finalizador.avgDaily);

  // ---- corrales
  const consById = {};
  for (const x of perCorral.results || []) consById[x.id] = x;
  const corrales = (animals.results || []).map((c) => {
    const k = consById[c.id];
    return {
      id: c.id,
      name: c.name,
      animals: Number(c.animals),
      todayBultos: r2(k?.today),
      avgDaily: r2((k?.week || 0) / win.days),
      fedToday: !!(k && k.entriesToday > 0),
    };
  });
  const active = corrales.filter((c) => c.animals > 0);

  return json({
    today,
    totalAnimals: corrales.reduce((s, c) => s + c.animals, 0),
    activeCorrales: active.length,
    fedCorrales: active.filter((c) => c.fedToday).length,
    todayConsumption: { levante: todayRow.levante, finalizador: todayRow.finalizador, total: todayTotal },
    avgDailyConsumption: avgTotal,
    stock,
    trend,
    corrales,
    activity: activity.results || [],
  });
};
