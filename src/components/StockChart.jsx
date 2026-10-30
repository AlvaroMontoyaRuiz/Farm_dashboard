import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { LegendDot } from './ui.jsx';
import { num2, longDay, shortDay, dayNumber, TYPE_COLOR, TYPE_LABEL, FOOD_TYPES, sumTypes } from '../lib/format.js';

function Tip({ active, payload, label }) {
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
    </div>
  );
}

// End-of-day stock for every feed type. `data` = [{date, levante, engorde, finalizador}]
export default function StockChart({ data }) {
  const [asTable, setAsTable] = useState(false);
  const hasData = data.some((d) => FOOD_TYPES.some((t) => d[t] !== 0));
  const last = data[data.length - 1] || {};

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {FOOD_TYPES.map((t) => (
            <LegendDot key={t} color={TYPE_COLOR[t]}>{TYPE_LABEL[t]} <b className="text-ink font-semibold">{num2(last[t])}</b></LegendDot>
          ))}
        </div>
        <button type="button" onClick={() => setAsTable((v) => !v)} className="text-sm text-ink-soft underline underline-offset-2 hover:text-ink">
          {asTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
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
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="px-3 py-1.5">{shortDay(d.date)}</td>
                  {FOOD_TYPES.map((t) => (
                    <td key={t} className="px-3 py-1.5 text-right">{num2(d[t])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" style={{ width: '100%', height: 330 }}>
          {!hasData && (
            <div className="absolute inset-0 grid place-items-center text-sm text-ink-soft z-10 text-center px-6">
              Registra el primer ingreso de bultos para empezar a ver el nivel de stock.
            </div>
          )}
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid vertical={false} stroke="#E8ECE3" />
              <ReferenceLine y={0} stroke="#B4421E" strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                tickFormatter={dayNumber}
                tickLine={false}
                axisLine={{ stroke: '#D5DCCF' }}
                tick={{ fontSize: 12, fill: '#5B6B60' }}
                interval={data.length > 30 ? Math.ceil(data.length / 15) - 1 : 2}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5B6B60' }} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              {FOOD_TYPES.map((t) => (
                <Line key={t} isAnimationActive={false} type="monotone" dataKey={t} stroke={TYPE_COLOR[t]} strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
