import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Segmented, Meter, IconCheck, IconCircle } from './ui.jsx';
import { num } from '../lib/format.js';

function statusOf(c) {
  if (c.animals === 0) return 'empty';
  return c.fedToday ? 'fed' : 'pending';
}

function Tile({ c }) {
  const st = statusOf(c);
  const pct = c.avgDaily > 0 ? Math.min(c.todayBultos / c.avgDaily, 1) : c.todayBultos > 0 ? 1 : 0;
  return (
    <Link
      to={`/consumo?corral=${c.id}`}
      aria-label={`${c.name}: ${c.animals} animales. ${st === 'fed' ? 'Alimentado hoy.' : st === 'pending' ? 'Pendiente de alimentar.' : 'Sin animales.'} Registrar consumo.`}
      className={`group block rounded-xl border p-3.5 transition-shadow hover:shadow-panel ${
        st === 'empty' ? 'border-dashed border-line bg-transparent' : 'border-line bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold whitespace-nowrap">{c.name}</span>
        {st === 'fed' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
            <IconCheck width={15} height={15} className="text-farm-green" />
            Listo
          </span>
        )}
        {st === 'pending' && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-alert">
            <IconCircle width={14} height={14} />
            Pendiente
          </span>
        )}
        {st === 'empty' && <span className="text-xs text-ink-faint">Vacío</span>}
      </div>

      <div className={`mt-2 flex items-baseline gap-1.5 ${st === 'empty' ? 'opacity-50' : ''}`}>
        <span className="font-display font-bold text-[30px] leading-none">{num(c.animals)}</span>
        <span className="text-xs text-ink-soft">{c.animals === 1 ? 'animal' : 'animales'}</span>
      </div>

      {st !== 'empty' && (
        <div className="mt-3">
          <Meter value={pct} max={1} color="#17261D" label={`Alimento de hoy en ${c.name} frente al promedio`} />
          <div className="flex justify-between text-xs mt-1.5">
            <span className="font-semibold">Hoy {num(c.todayBultos)}</span>
            <span className="text-ink-faint">Prom. {num(c.avgDaily)}</span>
          </div>
        </div>
      )}
    </Link>
  );
}

// Plan view of every corral. Tapping a tile opens "Registrar consumo" for it.
export default function CorralGrid({ corrales }) {
  const [filter, setFilter] = useState('all');
  const pending = corrales.filter((c) => statusOf(c) === 'pending').length;
  const empty = corrales.filter((c) => statusOf(c) === 'empty').length;

  const shown = corrales.filter((c) => {
    if (filter === 'pending') return statusOf(c) === 'pending';
    if (filter === 'empty') return statusOf(c) === 'empty';
    return true;
  });

  return (
    <div>
      <div className="mb-3 overflow-x-auto no-scrollbar">
        <Segmented
          label="Filtrar corrales"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `Todos (${corrales.length})` },
            { value: 'pending', label: `Pendientes (${pending})` },
            { value: 'empty', label: `Vacíos (${empty})` },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-ink-soft py-6 text-center">
          {filter === 'pending' ? 'Todos los corrales con animales ya fueron alimentados hoy.' : 'No hay corrales en esta vista.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {shown.map((c) => (
            <Tile key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
