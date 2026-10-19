import { RATING, num2 } from '../lib/format.js';

const REASON = {
  sin_peso: 'Sin pesos',
  sin_consumo: 'Sin consumo',
  sin_ganancia: 'Sin ganancia',
};

// Small pill for tables: "2,4 · Buena". The word always accompanies the colour.
export default function ConversionBadge({ c }) {
  if (!c) return <span className="text-ink-faint">—</span>;
  const r = c.rating ? RATING[c.rating] : null;
  const text = c.fcr != null ? `${num2(c.fcr)} · ${r.label}` : c.rating ? `${REASON[c.reason]} · ${r.label}` : REASON[c.reason] || '—';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap ${r ? r.cls : 'bg-field text-ink-soft'}`}
      title="Conversión alimenticia: kg de alimento por cada kg de peso ganado"
    >
      {r && <span aria-hidden>{r.icon}</span>}
      {text}
    </span>
  );
}
