import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Skeleton, IconCheck, IconCircle } from '../components/ui.jsx';
import { num } from '../lib/format.js';

// Worker home for feeding: every corral as a big tile. Tap one to register its bultos.
export default function ConsumoGrid({ user }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get('/api/consumption/corrales')
        .then((r) => alive && (setD(r), setErr('')))
        .catch((e) => alive && setErr(e.message));
    load();
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const active = d ? d.corrales.filter((c) => c.animals > 0) : [];
  const fed = active.filter((c) => c.fedToday).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[30px] leading-tight">Consumo</h1>
          <p className="text-ink-soft">Toca un corral para registrar el alimento de hoy.</p>
        </div>
        {user.role === 'admin' && (
          <Link to="/consumo" className="text-sm font-semibold text-farm-green underline underline-offset-2">
            Registro detallado (fechas y notas)
          </Link>
        )}
      </div>

      {err && <p className="text-alert text-sm">No se pudo cargar: {err}</p>}
      {!d && !err && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {d && (
        <>
          <p className="text-[15px] text-ink-soft" aria-live="polite">
            Alimentados hoy: <b className="text-ink">{fed}</b> de <b className="text-ink">{active.length}</b> corrales con animales
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {d.corrales.map((c) => {
              const empty = c.animals === 0;
              return (
                <Link
                  key={c.id}
                  to={`/consumo/corral/${c.id}`}
                  aria-label={`${c.name}: ${c.animals} animales. ${empty ? 'Sin animales.' : c.fedToday ? 'Alimentado hoy.' : 'Pendiente de alimentar.'}`}
                  className={`block rounded-2xl border p-4 min-h-[132px] active:scale-[0.98] transition-transform hover:shadow-panel ${
                    empty ? 'border-dashed border-line bg-transparent' : 'border-line bg-white shadow-panel'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display font-semibold text-[19px] leading-tight">{c.name}</span>
                    {!empty && (
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-1 ${
                          c.fedToday ? 'bg-[#E3EFE8] text-farm-green' : 'bg-alert-bg text-alert'
                        }`}
                      >
                        {c.fedToday ? <IconCheck width={14} height={14} /> : <IconCircle width={13} height={13} />}
                        {c.fedToday ? 'Listo' : 'Falta'}
                      </span>
                    )}
                  </div>
                  <div className={`mt-2 flex items-baseline gap-1.5 ${empty ? 'opacity-50' : ''}`}>
                    <span className="font-display font-bold text-[34px] leading-none">{num(c.animals)}</span>
                    <span className="text-sm text-ink-soft">{c.animals === 1 ? 'animal' : 'animales'}</span>
                  </div>
                  <p className="text-xs text-ink-faint mt-2">
                    {c.lote ? `${c.lote} · ` : ''}
                    {empty ? 'Vacío' : `Hoy ${num(c.todayBultos)} ${c.todayBultos === 1 ? 'bulto' : 'bultos'}`}
                  </p>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
