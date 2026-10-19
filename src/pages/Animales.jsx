import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Panel, Skeleton } from '../components/ui.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';
import ConversionBadge from '../components/ConversionBadge.jsx';
import ConversionResult from '../components/ConversionResult.jsx';
import { num, num2, shortDay } from '../lib/format.js';

const field = 'field';

export default function Animales() {
  const [corrales, setCorrales] = useState([]);
  const [rows, setRows] = useState(null);
  const [avail, setAvail] = useState(null); // { animals: {corralId: n} }
  const [form, setForm] = useState({ corralId: '', movement: 'ingreso', quantity: '', weight: '', note: '' });
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [result, setResult] = useState(null); // feed conversion of the exit just saved
  const [busy, setBusy] = useState(false);
  const resultRef = useRef(null);

  // Bring the metrics into view when an exit is saved or a past exit is opened
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [result]);

  const reload = useCallback(async () => {
    const [m, s] = await Promise.all([api.get('/api/animals'), api.get('/api/stock')]);
    setRows(m.movements);
    setAvail(s);
  }, []);

  useEffect(() => {
    api.get('/api/corrales').then((r) => setCorrales(r.corrales));
    reload();
  }, [reload]);

  const corral = corrales.find((c) => String(c.id) === String(form.corralId));
  const here = avail && form.corralId ? avail.animals[form.corralId] ?? 0 : null;
  const qty = Number(form.quantity) || 0;
  const weight = Number(form.weight) || 0;
  const isOut = form.movement === 'salida';
  const nothingToRemove = isOut && here !== null && here <= 0;
  const over = isOut && here !== null && qty > here;
  const perAnimal = qty > 0 && weight > 0 ? weight / qty : null;
  const canSave = !busy && form.corralId && qty > 0 && Number.isInteger(qty) && weight > 0 && !over && !nothingToRemove;

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setSaved('');
    setResult(null);
    setBusy(true);
    try {
      const r = await api.post('/api/animals', {
        corralId: Number(form.corralId),
        movement: form.movement,
        quantity: qty,
        weightKg: weight,
        note: form.note || null,
      });
      setSaved(`Guardado: ${isOut ? 'salida' : 'ingreso'} de ${qty} ${qty === 1 ? 'animal' : 'animales'} ${isOut ? 'de' : 'a'} ${corral?.name || 'el corral'} (${num2(weight)} kg).`);
      if (isOut) setResult({ c: r.conversion, corralName: corral?.name || 'el corral' });
      setForm({ ...form, quantity: '', weight: '', note: '' });
      await reload();
    } catch (e2) {
      setErr(e2.message);
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-[30px] leading-tight">Animales</h1>
        <p className="text-ink-soft">Registra los animales que entran y salen de cada corral, con su peso.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          <Panel title="Ingreso o salida" subtitle="Actualiza los animales del corral">
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-sm">
                <span className="label">Corral</span>
                <select className={field} value={form.corralId} onChange={(e) => setForm({ ...form, corralId: e.target.value })} required>
                  <option value="">Elige un corral</option>
                  {corrales.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {avail ? ` (${num(avail.animals[c.id] ?? 0)})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="label">Movimiento</span>
                <select className={field} value={form.movement} onChange={(e) => setForm({ ...form, movement: e.target.value })}>
                  <option value="ingreso">Ingreso (entran animales)</option>
                  <option value="salida">Salida (salen animales)</option>
                </select>
              </label>

              {here !== null && (
                <div
                  className={`rounded-xl px-3 py-2.5 text-sm ${nothingToRemove || over ? 'bg-alert-bg text-alert' : 'bg-field text-ink-soft'}`}
                  aria-live="polite"
                >
                  {nothingToRemove ? (
                    <><b>{corral?.name} no tiene animales</b> para sacar.</>
                  ) : over ? (
                    <><b>Solo hay {num(here)} {here === 1 ? 'animal' : 'animales'}</b> en {corral?.name}.</>
                  ) : (
                    <>
                      En {corral?.name}: <b className="text-ink">{num(here)} {here === 1 ? 'animal' : 'animales'}</b>
                      {qty > 0 && <span> · quedarían {num(isOut ? here - qty : here + qty)}</span>}
                    </>
                  )}
                </div>
              )}

              <label className="block text-sm">
                <span className="label">Cantidad de animales</span>
                <input
                  className={field}
                  type="number"
                  min="1"
                  step="1"
                  max={isOut && here > 0 ? here : undefined}
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </label>

              <label className="block text-sm">
                <span className="label">Peso a registrar: total del grupo que {isOut ? 'sale' : 'entra'} (kg)</span>
                <input
                  className={field}
                  type="number"
                  min="0.5"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Ej: 500"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                  required
                />
                <span className="block mt-1 text-xs text-ink-faint">
                  {perAnimal ? `Son ${num2(perAnimal)} kg por animal. ` : ''}
                  Pesa todos los animales juntos y escribe el total, no el de uno solo.
                </span>
              </label>

              <label className="block text-sm">
                <span className="label">Nota (opcional)</span>
                <input className={field} placeholder="Venta, traslado, compra…" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </label>

              {err && <p className="text-sm text-alert" role="alert">{err}</p>}
              {saved && <p className="text-sm text-farm-green font-medium" role="status">{saved}</p>}
              <button disabled={!canSave} className="btn btn-primary w-full">
                {busy ? 'Guardando…' : 'Guardar movimiento'}
              </button>
            </form>
          </Panel>

          {result && (
            <div ref={resultRef}>
              <ConversionResult c={result.c} corralName={result.corralName} onClose={() => setResult(null)} />
            </div>
          )}
        </div>

        <Panel className="lg:col-span-2" title="Movimientos recientes" subtitle="Toca la conversión de una salida para ver su detalle">
          {!rows ? (
            <Skeleton className="h-48" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-ink-soft py-8 text-center">Aún no hay movimientos. Registra el primer ingreso de animales con el formulario.</p>
          ) : (
            <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
              <table className="rtable w-full text-[15px]">
                <thead className="bg-field text-left text-ink-soft">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Corral</th>
                    <th className="px-3 py-2 font-medium">Movimiento</th>
                    <th className="px-3 py-2 font-medium text-right">Animales</th>
                    <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Peso</th>
                    <th className="px-3 py-2 font-medium">Conversión</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td data-label="Fecha" className="px-3 py-2 whitespace-nowrap">
                        {shortDay(r.movementAt)}
                        <div className="text-xs text-ink-faint">{r.createdBy || '—'}</div>
                      </td>
                      <td data-label="Corral" className="px-3 py-2 whitespace-nowrap">{r.corralName}</td>
                      <td data-label="Movimiento" className="px-3 py-2">
                        {r.movement === 'ingreso' ? 'Ingreso' : 'Salida'}
                        {r.note && <div className="text-xs text-ink-faint">{r.note}</div>}
                      </td>
                      <td data-label="Animales" className="px-3 py-2 text-right font-semibold">{r.movement === 'ingreso' ? '+' : '−'}{r.quantity}</td>
                      <td data-label="Peso" className="px-3 py-2 text-right whitespace-nowrap">{r.weightKg != null ? `${num2(r.weightKg)} kg` : '—'}</td>
                      <td data-label="Conversión" className="px-3 py-2">
                        {r.movement === 'salida' ? <ConversionBadge c={r.conversion} onClick={r.conversion ? () => setResult({ c: r.conversion, corralName: r.corralName }) : undefined} /> : <span className="text-ink-faint">—</span>}
                      </td>
                      <td data-label="" className="px-3 py-1 text-right">
                        <ConfirmDelete table="animal_movements" id={r.id} onDeleted={reload} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
