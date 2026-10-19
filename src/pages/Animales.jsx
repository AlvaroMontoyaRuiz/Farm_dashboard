import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Panel, Skeleton } from '../components/ui.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';
import { num, shortDay } from '../lib/format.js';

const field = 'field';

export default function Animales() {
  const [corrales, setCorrales] = useState([]);
  const [rows, setRows] = useState(null);
  const [avail, setAvail] = useState(null); // { animals: {corralId: n} }
  const [form, setForm] = useState({ corralId: '', movement: 'ingreso', quantity: '', note: '' });
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

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
  const isOut = form.movement === 'salida';
  const nothingToRemove = isOut && here !== null && here <= 0;
  const over = isOut && here !== null && qty > here;
  const canSave = !busy && form.corralId && qty > 0 && Number.isInteger(qty) && !over && !nothingToRemove;

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setSaved('');
    setBusy(true);
    try {
      await api.post('/api/animals', {
        corralId: Number(form.corralId),
        movement: form.movement,
        quantity: qty,
        note: form.note || null,
      });
      setSaved(`Guardado: ${isOut ? 'salida' : 'ingreso'} de ${qty} ${qty === 1 ? 'animal' : 'animales'} ${isOut ? 'de' : 'a'} ${corral?.name || 'el corral'}.`);
      setForm({ ...form, quantity: '', note: '' });
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
        <p className="text-ink-soft">Registra los animales que entran y salen de cada corral.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
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

        <Panel className="lg:col-span-2" title="Movimientos recientes" subtitle="Los más recientes primero">
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
                    <th className="px-3 py-2 font-medium">Nota</th>
                    <th className="px-3 py-2 font-medium">Registró</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td data-label="Fecha" className="px-3 py-2 whitespace-nowrap">{shortDay(r.movementAt)}</td>
                      <td data-label="Corral" className="px-3 py-2 whitespace-nowrap">{r.corralName}</td>
                      <td data-label="Movimiento" className="px-3 py-2">{r.movement === 'ingreso' ? 'Ingreso' : 'Salida'}</td>
                      <td data-label="Animales" className="px-3 py-2 text-right font-semibold">{r.movement === 'ingreso' ? '+' : '−'}{r.quantity}</td>
                      <td data-label="Nota" className="px-3 py-2 text-ink-soft">{r.note || '—'}</td>
                      <td data-label="Registró" className="px-3 py-2 text-ink-soft">{r.createdBy || '—'}</td>
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
