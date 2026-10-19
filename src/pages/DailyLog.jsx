import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Panel, Skeleton } from '../components/ui.jsx';
import { localToday, longDay, num2, TYPE_LABEL, TYPE_COLOR } from '../lib/format.js';

export default function DailyLog() {
  const today = localToday();
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setData(null);
    setErr('');
    api.get(`/api/daily-log?date=${date}`).then(setData).catch((e) => setErr(e.message));
  }, [date]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-[30px] leading-tight">Historial diario</h1>
          <p className="text-ink-soft">Todo lo que pasó en la finca en un día.</p>
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="fecha" className="label">Fecha</label>
          <input id="fecha" type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="field" />
        </div>
      </div>

      {err && <p className="text-alert">No se pudo cargar: {err}</p>}
      {!data && !err ? (
        <Skeleton className="h-64" />
      ) : data ? (
        <>
          <Panel title="Consumo por corral" subtitle={longDay(data.date)}>
            {data.totalsPerCorral.length === 0 ? (
              <Empty>No se registró consumo este día.</Empty>
            ) : (
              <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
                <table className="rtable w-full text-[15px]">
                  <thead className="bg-field text-left text-ink-soft">
                    <tr>
                      <th className="px-3 py-2 font-medium">Corral</th>
                      <th className="px-3 py-2 font-medium text-right">Levante</th>
                      <th className="px-3 py-2 font-medium text-right">Finalizador</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.totalsPerCorral.map((r) => (
                      <tr key={r.corralId} className="border-t border-line">
                        <td data-label="Corral" className="px-3 py-2 whitespace-nowrap">{r.corralName}</td>
                        <td data-label="Levante" className="px-3 py-2 text-right">{num2(r.levante)}</td>
                        <td data-label="Finalizador" className="px-3 py-2 text-right">{num2(r.finalizador)}</td>
                        <td data-label="Total" className="px-3 py-2 text-right font-semibold">{num2(r.levante + r.finalizador)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="grid lg:grid-cols-2 gap-5">
            <Panel title="Movimientos de animales">
              {data.movements.length === 0 ? (
                <Empty>No hubo ingresos ni salidas de animales.</Empty>
              ) : (
                <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
                  <table className="rtable w-full text-[15px]">
                    <thead className="bg-field text-left text-ink-soft">
                      <tr>
                        <th className="px-3 py-2 font-medium">Corral</th>
                        <th className="px-3 py-2 font-medium">Movimiento</th>
                        <th className="px-3 py-2 font-medium text-right">Animales</th>
                        <th className="px-3 py-2 font-medium">Nota</th>
                        <th className="px-3 py-2 font-medium">Registró</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movements.map((r) => (
                        <tr key={r.id} className="border-t border-line">
                          <td data-label="Corral" className="px-3 py-2 whitespace-nowrap">{r.corralName}</td>
                          <td data-label="Movimiento" className="px-3 py-2">{r.movement === 'ingreso' ? 'Ingreso' : 'Salida'}</td>
                          <td data-label="Animales" className="px-3 py-2 text-right font-semibold">{r.movement === 'ingreso' ? '+' : '−'}{r.quantity}</td>
                          <td data-label="Nota" className="px-3 py-2 text-ink-soft">{r.note || '—'}</td>
                          <td data-label="Registró" className="px-3 py-2 text-ink-soft">{r.createdBy || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Bultos recibidos">
              {data.lots.length === 0 ? (
                <Empty>No llegaron bultos este día.</Empty>
              ) : (
                <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
                  <table className="rtable w-full text-[15px]">
                    <thead className="bg-field text-left text-ink-soft">
                      <tr>
                        <th className="px-3 py-2 font-medium">Alimento</th>
                        <th className="px-3 py-2 font-medium text-right">Bultos</th>
                        <th className="px-3 py-2 font-medium">Nota</th>
                        <th className="px-3 py-2 font-medium">Registró</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lots.map((r) => (
                        <tr key={r.id} className="border-t border-line">
                          <td data-label="Alimento" className="px-3 py-2 whitespace-nowrap">
<span>
                            <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: TYPE_COLOR[r.type] }} aria-hidden />
                            {TYPE_LABEL[r.type]}</span>
                          </td>
                          <td data-label="Bultos" className="px-3 py-2 text-right font-semibold">{r.bultosReceived}</td>
                          <td data-label="Nota" className="px-3 py-2 text-ink-soft">{r.note || '—'}</td>
                          <td data-label="Registró" className="px-3 py-2 text-ink-soft">{r.createdBy || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-ink-soft py-6 text-center">{children}</p>;
}
