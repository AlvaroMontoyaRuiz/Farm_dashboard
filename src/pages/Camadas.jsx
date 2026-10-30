import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Panel, Skeleton, Segmented } from '../components/ui.jsx';
import { num, shortDay } from '../lib/format.js';

// Camadas = groups of animals that go through a lote together. The mortality of each one is
// deaths ÷ animals that entered. Admin only. The current figure is also on each lote card in the Panel.
export default function Camadas() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [lote, setLote] = useState('all');

  useEffect(() => {
    api.get('/api/camadas').then(setData).catch((e) => setErr(e.message));
  }, []);

  const rows = data ? data.batches.filter((b) => lote === 'all' || String(b.loteId) === lote) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-[30px] leading-tight">Camadas</h1>
        <p className="text-ink-soft max-w-2xl">
          Una camada es el grupo de animales que entra a un lote. Empieza cuando entran animales a un lote vacío y termina cuando el lote
          vuelve a quedar vacío (todos vendidos o muertos). Mortalidad = muertes ÷ animales que ingresaron.
        </p>
      </div>

      {err && <p className="text-alert text-sm">No se pudo cargar: {err}</p>}
      {!data && !err && <Skeleton className="h-64" />}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {data.lotes.map((l) => (
              <div key={l.id} className="rounded-2xl border border-line bg-white shadow-panel p-4">
                <h2 className="font-display font-semibold text-[16px]">{l.name}</h2>
                {l.batches === 0 ? (
                  <p className="text-sm text-ink-faint mt-2">Sin camadas todavía</p>
                ) : (
                  <>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="font-display font-bold text-[34px] leading-none">{num(l.mortality)} %</span>
                      <span className="text-sm text-ink-soft">mortalidad total</span>
                    </div>
                    <p className="text-sm text-ink-soft mt-1.5">
                      {num(l.deaths)} muertes de {num(l.entered)} animales · {l.batches} {l.batches === 1 ? 'camada' : 'camadas'}
                    </p>
                    <p className="text-xs text-ink-faint mt-1">
                      {l.current ? `Camada actual: ${num(l.current.mortality)} % (${num(l.current.deaths)} de ${num(l.current.entered)})` : 'Lote vacío ahora'}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>

          <Panel
            title="Historial de camadas"
            subtitle="La más reciente primero"
            action={
              <Segmented
                label="Lote"
                value={lote}
                onChange={setLote}
                options={[{ value: 'all', label: 'Todos' }, ...data.lotes.map((l) => ({ value: String(l.id), label: l.name }))]}
              />
            }
          >
            {rows.length === 0 ? (
              <p className="text-sm text-ink-soft py-8 text-center">
                Aún no hay camadas. Aparecen cuando se registra un ingreso de animales en un corral que pertenece a un lote.
              </p>
            ) : (
              <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
                <table className="rtable w-full text-[15px]">
                  <thead className="bg-field text-left text-ink-soft">
                    <tr>
                      <th className="px-3 py-2 font-medium">Lote</th>
                      <th className="px-3 py-2 font-medium">Inicio</th>
                      <th className="px-3 py-2 font-medium">Fin</th>
                      <th className="px-3 py-2 font-medium text-right">Días</th>
                      <th className="px-3 py-2 font-medium text-right">Ingresaron</th>
                      <th className="px-3 py-2 font-medium text-right">Muertes</th>
                      <th className="px-3 py-2 font-medium text-right">Vendidos</th>
                      <th className="px-3 py-2 font-medium text-right">En el lote</th>
                      <th className="px-3 py-2 font-medium text-right">Mortalidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <tr key={`${b.loteId}-${b.n}`} className="border-t border-line">
                        <td data-label="Lote" className="px-3 py-2 whitespace-nowrap">
                          <span>{b.loteName} <span className="text-ink-faint">#{b.n}</span></span>
                        </td>
                        <td data-label="Inicio" className="px-3 py-2 whitespace-nowrap">{shortDay(b.start)}</td>
                        <td data-label="Fin" className="px-3 py-2 whitespace-nowrap">
                          {b.open ? (
                            <span className="inline-flex items-center rounded-full bg-[#E3EFE8] text-farm-green text-xs font-semibold px-2.5 py-1">En curso</span>
                          ) : (
                            shortDay(b.end)
                          )}
                        </td>
                        <td data-label="Días" className="px-3 py-2 text-right">{b.days}</td>
                        <td data-label="Ingresaron" className="px-3 py-2 text-right">{num(b.entered)}</td>
                        <td data-label="Muertes" className="px-3 py-2 text-right">{num(b.deaths)}</td>
                        <td data-label="Vendidos" className="px-3 py-2 text-right">{num(b.sold)}</td>
                        <td data-label="En el lote" className="px-3 py-2 text-right">{b.open ? num(b.present) : '—'}</td>
                        <td data-label="Mortalidad" className="px-3 py-2 text-right font-semibold whitespace-nowrap">{num(b.mortality)} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-ink-faint mt-3">
              Los animales en enfermería siguen siendo parte de la camada. Las camadas se calculan con los corrales que tiene cada lote hoy: si
              pasas un corral a otro lote, el historial de ambos lotes se recalcula.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
