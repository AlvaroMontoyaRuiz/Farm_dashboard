import { RATING, fix2 } from '../lib/format.js';

const REASON = {
  sin_peso: 'Sin pesos',
  sin_consumo: 'Sin consumo',
  sin_ganancia: 'Sin ganancia',
};

// Small pill for tables: "2,4 · Buena". The word always accompanies the colour.
export default function ConversionBadge({ c, onClick }) {
  if (!c) return <span className="text-ink-faint">—</span>;
  const r = c.rating ? RATING[c.rating] : null;
  const text = c.fcr != null ? `${fix2(c.fcr)} · ${r.label}` : c.rating ? `${REASON[c.reason]} · ${r.label}` : REASON[c.reason] || '—';
  const cls = `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap ${r ? r.cls : 'bg-field text-ink-soft'}`;
  const inner = (
    <>
      {r && <span aria-hidden>{r.icon}</span>}
      {text}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} min-h-[40px] underline underline-offset-2 decoration-dotted`} title="Ver el detalle de esta conversión">
        {inner}
      </button>
    );
  }
  return <span className={cls}>{inner}</span>;
}
