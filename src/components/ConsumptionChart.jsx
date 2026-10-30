import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { LegendDot } from './ui.jsx';
import { num, num2, longDay, shortDay, dayNumber, weekdayShort, TYPE_COLOR, TYPE_LABEL, FOOD_TYPES, sumTypes } from '../lib/format.js';

function ChartTip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-white border border-line rounded-xl shadow-panel px-3 py-2 text-sm">
      <div className="font-semibold mb-1">{longDay(label)}</div>
      {FOOD_TYPES.map((t) => (
        <div key={t} className="flex items-center justify-between gap-6">
          <LegendDot color={TYPE_COLOR[t]}>{TYPE_LABEL[t]}</LegendDot>
          <span className="font-semibold">{num2(row[t])}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-6 border-t border-line mt-1 pt-1">
        <span className="text-ink-soft">Total</span>
        <span className="font-semibold">{num2(sumTypes(row))}</span>
      </div>
    </div>
  );
}

// Stacked daily consumption. `data` = [{date, levante, engorde, finalizador}]
export default function ConsumptionChart({ data }) {
  const [asTable, setAsTable] = useState(false);
  const total = data.reduce((s, d) => s + sumTypes(d), 0);
  const tickFormat = (d) => (data.length <= 7 ? `${weekdayShort(d)} ${dayNumber(d)}` : dayNumber(d));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {FOOD_TYPES.map((t) => (
            <LegendDot key={t} color={TYPE_COLOR[t]}>{TYPE_LABEL[t]}</LegendDot>
          ))}
        </div>
        <div className="text-sm text-ink-soft">
          Total del período: <span className="font-semibold text-ink">{num(total)} bultos</span>
          <button type="button" onClick={() => setAsTable((v) => !v)} className="ml-3 underline underline-offset-2 hover:text-ink">
            {asTable ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        </div>
      </div>

      {asTable ? (
        <div className="max-h-[330px] overflow-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-field text-left text-ink-soft sticky top-0">
              <tr>
                <th className="px-3 py-2 font-medium">Día</th>
                {FOOD_TYPES.map((t) => (
                  <th key={t} className="px-3 py-2 font-medium text-right">{TYPE_LABEL[t]}</th>
                ))}
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="px-3 py-1.5">{weekdayShort(d.date)} {shortDay(d.date)}</td>
                  {FOOD_TYPES.map((t) => (
                    <td key={t} className="px-3 py-1.5 text-right">{num2(d[t])}</td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold">{num2(sumTypes(d))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" style={{ width: '100%', height: 330 }}>
          {total === 0 && (
            <div className="absolute inset-0 grid place-items-center text-sm text-ink-soft z-10 text-center px-6">
              Aún no hay consumo en este período. Cuando los trabajadores registren alimento, aparecerá aquí.
            </div>
          )}
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#E8ECE3" />
              <XAxis
                dataKey="date"
                tickFormatter={tickFormat}
                tickLine={false}
                axisLine={{ stroke: '#D5DCCF' }}
                tick={{ fontSize: 12, fill: '#5B6B60' }}
                interval={data.length > 14 ? 2 : 0}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5B6B60' }} allowDecimals={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(23,38,29,0.05)' }} />
              {FOOD_TYPES.map((t, i) => (
                <Bar
                  key={t}
                  isAnimationActive={false}
                  dataKey={t}
                  stackId="a"
                  fill={TYPE_COLOR[t]}
                  stroke="#fff"
                  strokeWidth={2}
                  radius={i === FOOD_TYPES.length - 1 ? [5, 5, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
