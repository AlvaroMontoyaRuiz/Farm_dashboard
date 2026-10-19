import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Panel, Skeleton } from '../components/ui.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';
import { num, num2, bultosWord, shortDay, TYPE_LABEL, TYPE_COLOR } from '../lib/format.js';

const field = 'field';

export default function Consumo() {
  // The Panel's corral tiles link here with ?corral=ID so the corral is already chosen.
  const [params] = useSearchParams();
  const [corrales, setCorrales] = useState([]);
  const [rows, setRows] = useState(null);
  const [avail, setAvail] = useState(null); // { stock: {levante, finalizador}, animals: {id: n} }
  const [form, setForm] = useState({ corralId: params.get('corral') || '', foodType: 'levante', bultos: '', note: '' });
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [c, s] = await Promise.all([api.get('/api/consumption'), api.get('/api/stock')]);
    setRows(c.consumption);
    setAvail(s);
  }, []);

  useEffect(() => {
    api.get('/api/corrales').then((r) => setCorrales(r.corrales));
    reload();
  }, [reload]);

  const type = form.foodType;
  const typeName = TYPE_LABEL[type].toLowerCase();
  const available = avail ? avail.stock[type] : null;
  const amount = Number(form.bultos) || 0;
  const noStock = available !== null && available <= 0;
  const over = available !== null && amount > available + 1e-9;
  const animalsHere = avail && form.corralId ? avail.animals[form.corralId] : null;
  const canSave = !busy && form.corralId && amount > 0 && !over && !noStock;

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setSaved('');
    setBusy(true);
    try {
      await api.post('/api/consumption', {
        corralId: Number(form.corralId),
        foodType: form.foodType,
        bultos: amount,
        note: form.note || null,
      });
      const name = corrales.find((c) => String(c.id) === String(form.corralId))?.name || 'el corral';
      setSaved(`Guardado: ${num2(amount)} ${bultosWord(amount)} de ${typeName} en ${name}.`);
      setForm({ ...form, bultos: '', note: '' });
      await reload();
    } catch (e2) {
      setErr(e2.message);
      reload(); // the stock may have changed while the form was open
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-[30px] leading-tight">Consumo</h1>
        <p className="text-ink-soft">Registra los bultos que entregaste a cada corral.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Panel title="Registrar consumo" subtitle="Se descuenta de los bultos en bodega">
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm">
              <span className="label">Corral</span>
              <select className={field} value={form.corralId} onChange={(e) => setForm({ ...form, corralId: e.target.value })} required>
                <option value="">Elige un corral</option>
                {corrales.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {animalsHere !== null && (
                <span className="block mt-1 text-xs text-ink-faint">
                  {animalsHere > 0 ? `${animalsHere} ${animalsHere === 1 ? 'animal' : 'animales'} en este corral` : 'Este corral no tiene animales registrados'}
                </span>
              )}
            </label>

            <label className="block text-sm">
              <span className="label">Alimento</span>
              <select className={field} value={form.foodType} onChange={(e) => setForm({ ...form, foodType: e.target.value })}>
                <option value="levante">Levante</option>
                <option value="finalizador">Finalizador</option>
              </select>
            </label>

            {/* What is in storage, always visible before saving */}
            <div
              className={`rounded-xl px-3 py-2.5 text-sm ${noStock || over ? 'bg-alert-bg text-alert' : 'bg-field text-ink-soft'}`}
              aria-live="polite"
            >
              {available === null ? (
                <Skeleton className="h-5 w-40" />
              ) : noStock ? (
                <>
                  <b>Sin stock de {typeName}.</b> El administrador debe registrar un ingreso de bultos.
                </>
              ) : over ? (
                <>
                  <b>Solo quedan {num(available)} {bultosWord(available)}</b> de {typeName} en bodega.
                </>
              ) : (
                <>
                  <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: TYPE_COLOR[type] }} aria-hidden />
                  En bodega: <b className="text-ink">{num(available)} {bultosWord(available)}</b>
                  {amount > 0 && <span> · quedarían {num(available - amount)}</span>}
                </>
              )}
            </div>

            <label className="block text-sm">
              <span className="label">Cantidad de bultos</span>
              <input
                className={field}
                type="number"
                step="0.5"
                min="0.5"
                max={available !== null && available > 0 ? available : undefined}
                inputMode="decimal"
                value={form.bultos}
                onChange={(e) => setForm({ ...form, bultos: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="label">Nota (opcional)</span>
              <input className={field} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>

            {err && <p className="text-sm text-alert" role="alert">{err}</p>}
            {saved && <p className="text-sm text-farm-green font-medium" role="status">{saved}</p>}
            <button disabled={!canSave} className="btn btn-primary w-full">
              {busy ? 'Guardando…' : 'Guardar consumo'}
            </button>
          </form>
        </Panel>

        <Panel className="lg:col-span-2" title="Últimos registros" subtitle="Los más recientes primero">
          {!rows ? (
            <Skeleton className="h-48" />
          ) : rows.length === 0 ? (
            <p className="text-sm text-ink-soft py-8 text-center">Aún no hay consumo registrado. Usa el formulario para guardar el primero.</p>
          ) : (
            <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
              <table className="rtable w-full text-[15px]">
                <thead className="bg-field text-left text-ink-soft">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Corral</th>
                    <th className="px-3 py-2 font-medium">Alimento</th>
                    <th className="px-3 py-2 font-medium text-right">Bultos</th>
                    <th className="px-3 py-2 font-medium">Registró</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <td data-label="Fecha" className="px-3 py-2 whitespace-nowrap">{shortDay(r.consumedAt)}</td>
                      <td data-label="Corral" className="px-3 py-2 whitespace-nowrap">{r.corralName}</td>
                      <td data-label="Alimento" className="px-3 py-2 whitespace-nowrap">
<span>
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: TYPE_COLOR[r.foodType] }} aria-hidden />
                        {TYPE_LABEL[r.foodType]}</span>
                      </td>
                      <td data-label="Bultos" className="px-3 py-2 text-right font-semibold">{num2(r.bultos)}</td>
                      <td data-label="Registró" className="px-3 py-2 text-ink-soft">{r.createdBy || '—'}</td>
                      <td data-label="" className="px-3 py-1 text-right">
                        <ConfirmDelete table="feed_consumption" id={r.id} onDeleted={reload} />
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
