import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Panel, Segmented, Skeleton, IconAlert } from '../components/ui.jsx';
import StockCard from '../components/StockCard.jsx';
import StockChart from '../components/StockChart.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';
import { num2, signed, shortDay, whenLabel, localToday, TYPE_LABEL, TYPE_COLOR } from '../lib/format.js';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'ingresos', label: 'Ingresos' },
];

const field = 'field';

export default function Inventario({ user }) {
  const isAdmin = user.role === 'admin';
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'resumen';
  const setTab = (id) => setParams(id === 'resumen' ? {} : { tab: id }, { replace: true });

  const [days, setDays] = useState(30);
  const [filters, setFilters] = useState({ type: '', kind: '', from: '', to: '' });
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const q = new URLSearchParams({ days: String(days) });
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
    try {
      setInv(await api.get('/api/inventory?' + q.toString()));
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, [days, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const negative = inv && ['levante', 'finalizador'].filter((t) => inv.summary[t].wentNegative);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-[30px] leading-tight">Bultos</h1>
        <p className="text-ink-soft">Cuánto alimento hay en bodega, cuánto entró y cuánto se consumió.</p>
      </div>

      <div role="tablist" aria-label="Secciones de bultos" className="flex gap-1 border-b border-line overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 min-h-[48px] text-[15px] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-farm-green text-ink' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <p className="text-sm text-alert">No se pudo cargar: {err}</p>}

      {tab === 'resumen' && (
        !inv ? (
          <div className="space-y-5"><Skeleton className="h-64" /><Skeleton className="h-80" /></div>
        ) : (
          <div className="space-y-5">
            {negative.length > 0 && (
              <div role="alert" className="flex gap-3 rounded-2xl bg-alert-bg text-alert p-4">
                <IconAlert className="shrink-0 mt-0.5" />
                <p className="text-sm">
                  <b>El saldo de {negative.map((t) => TYPE_LABEL[t].toLowerCase()).join(' y ')} llegó a ser negativo.</b>{' '}
                  Se registró más consumo del que ingresó. Revisa en Movimientos si falta registrar un ingreso.
                </p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-5">
              <StockCard type="levante" data={inv.summary.levante} detailed />
              <StockCard type="finalizador" data={inv.summary.finalizador} detailed />
            </div>

            <Panel
              title="Nivel de stock"
              subtitle="Bultos que había en bodega al cierre de cada día"
              action={
                <Segmented
                  label="Período"
                  value={days}
                  onChange={setDays}
                  options={[{ value: 30, label: '30 días' }, { value: 60, label: '60 días' }, { value: 90, label: '90 días' }]}
                />
              }
            >
              <StockChart data={inv.series} />
            </Panel>
          </div>
        )
      )}

      {tab === 'movimientos' && <Movimientos inv={inv} filters={filters} setFilters={setFilters} />}

      {tab === 'ingresos' && <Ingresos isAdmin={isAdmin} onChanged={load} />}
    </div>
  );
}

/* ---------------- Movimientos (kardex) ---------------- */

function Movimientos({ inv, filters, setFilters }) {
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const anyFilter = Object.values(filters).some(Boolean);

  return (
    <Panel
      title="Movimientos de bultos"
      subtitle="Cada ingreso y cada consumo, con el saldo que quedó después"
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <label className="text-sm">
          <span className="label">Alimento</span>
          <select className={field} value={filters.type} onChange={set('type')}>
            <option value="">Todos</option>
            <option value="levante">Levante</option>
            <option value="finalizador">Finalizador</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Movimiento</span>
          <select className={field} value={filters.kind} onChange={set('kind')}>
            <option value="">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="consumo">Consumos</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Desde</span>
          <input type="date" className={field} value={filters.from} onChange={set('from')} />
        </label>
        <label className="text-sm">
          <span className="label">Hasta</span>
          <input type="date" className={field} value={filters.to} onChange={set('to')} />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            disabled={!anyFilter}
            onClick={() => setFilters({ type: '', kind: '', from: '', to: '' })}
            className="btn btn-quiet w-full"
          >
            Quitar filtros
          </button>
        </div>
      </div>

      {!inv ? (
        <Skeleton className="h-48" />
      ) : inv.ledger.length === 0 ? (
        <p className="text-sm text-ink-soft py-8 text-center">
          {anyFilter ? 'No hay movimientos con estos filtros.' : 'Aún no hay movimientos. Registra un ingreso de bultos o un consumo para empezar.'}
        </p>
      ) : (
        <>
          <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
            <table className="rtable w-full text-[15px] min-w-[720px]">
              <thead className="bg-field text-left text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Movimiento</th>
                  <th className="px-3 py-2 font-medium">Alimento</th>
                  <th className="px-3 py-2 font-medium text-right">Bultos</th>
                  <th className="px-3 py-2 font-medium text-right">Saldo</th>
                  <th className="px-3 py-2 font-medium">Detalle</th>
                  <th className="px-3 py-2 font-medium">Registró</th>
                </tr>
              </thead>
              <tbody>
                {inv.ledger.map((r) => (
                  <tr key={r.key} className="border-t border-line align-top">
                    <td data-label="Fecha" className="px-3 py-2 whitespace-nowrap">{shortDay(r.date)}</td>
                    <td data-label="Movimiento" className="px-3 py-2">{r.kind === 'ingreso' ? 'Ingreso' : 'Consumo'}</td>
                    <td data-label="Alimento" className="px-3 py-2 whitespace-nowrap">
<span>
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: TYPE_COLOR[r.type] }} aria-hidden />
                      {TYPE_LABEL[r.type]}</span>
                    </td>
                    <td data-label="Bultos" className={`px-3 py-2 text-right whitespace-nowrap ${r.kind === 'ingreso' ? 'font-semibold' : ''}`}>
                      {signed(r.kind === 'ingreso' ? r.qty : -r.qty)}
                    </td>
                    <td data-label="Saldo" className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${r.balance < 0 ? 'text-alert' : ''}`}>
                      {num2(r.balance)}
                    </td>
                    <td data-label="Detalle" className="px-3 py-2 text-ink-soft">
                      {[r.corral, r.note].filter(Boolean).join(': ') || '—'}
                    </td>
                    <td data-label="Registró" className="px-3 py-2 text-ink-soft whitespace-nowrap">
                      {r.who || '—'}
                      <div className="text-xs text-ink-faint">{whenLabel(r.createdAt)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {inv.ledgerTotal > inv.ledger.length && (
            <p className="text-sm text-ink-soft mt-3">
              Mostrando los {inv.ledger.length} movimientos más recientes de {inv.ledgerTotal}. Usa los filtros para acotar.
            </p>
          )}
          <p className="text-xs text-ink-faint mt-2">
            El saldo se calcula en orden cronológico. Si se elimina un registro, todos los saldos se recalculan solos.
          </p>
        </>
      )}
    </Panel>
  );
}

/* ---------------- Ingresos (register + list) ---------------- */

function Ingresos({ isAdmin, onChanged }) {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({ type: 'levante', bultosReceived: '', receivedAt: localToday(), note: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');

  const reload = useCallback(async () => {
    const r = await api.get('/api/food-lots?limit=200');
    setRows(r.lots);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const afterChange = () => {
    reload();
    onChanged();
  };

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setSaved('');
    setBusy(true);
    try {
      await api.post('/api/food-lots', {
        type: form.type,
        bultosReceived: Number(form.bultosReceived),
        receivedAt: form.receivedAt || null,
        note: form.note || null,
      });
      setSaved(`Ingreso guardado: ${form.bultosReceived} bultos de ${TYPE_LABEL[form.type].toLowerCase()}.`);
      setForm({ ...form, bultosReceived: '', note: '' });
      afterChange();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {isAdmin ? (
        <Panel title="Registrar ingreso" subtitle="Bultos que llegaron a la bodega">
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm">
              <span className="label">Alimento</span>
              <select className={field} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="levante">Levante</option>
                <option value="finalizador">Finalizador</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="label">Cantidad de bultos</span>
              <input
                className={field}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={form.bultosReceived}
                onChange={(e) => setForm({ ...form, bultosReceived: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="label">Fecha de llegada</span>
              <input
                className={field}
                type="date"
                max={localToday()}
                value={form.receivedAt}
                onChange={(e) => setForm({ ...form, receivedAt: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="label">Nota (opcional)</span>
              <input className={field} placeholder="Proveedor, factura…" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>
            {err && <p className="text-sm text-alert" role="alert">{err}</p>}
            {saved && <p className="text-sm text-farm-green font-medium" role="status">{saved}</p>}
            <button disabled={busy} className="btn btn-primary w-full">
              {busy ? 'Guardando…' : 'Guardar ingreso'}
            </button>
          </form>
        </Panel>
      ) : (
        <Panel title="Ingresos de bultos" subtitle="Solo el administrador registra los ingresos">
          <p className="text-sm text-ink-soft">Aquí puedes consultar cuándo llegó cada lote de alimento.</p>
        </Panel>
      )}

      <Panel className="lg:col-span-2" title="Ingresos registrados" subtitle="Los más recientes primero">
        {!rows ? (
          <Skeleton className="h-40" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-soft py-6 text-center">
            Aún no hay ingresos. {isAdmin ? 'Registra el primero con el formulario.' : 'El administrador los registrará aquí.'}
          </p>
        ) : (
          <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
            <table className="rtable w-full text-[15px]">
              <thead className="bg-field text-left text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Alimento</th>
                  <th className="px-3 py-2 font-medium text-right">Bultos</th>
                  <th className="px-3 py-2 font-medium">Nota</th>
                  <th className="px-3 py-2 font-medium">Registró</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td data-label="Fecha" className="px-3 py-2 whitespace-nowrap">{shortDay(r.receivedAt)}</td>
                    <td data-label="Alimento" className="px-3 py-2 whitespace-nowrap">
<span>
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: TYPE_COLOR[r.type] }} aria-hidden />
                      {TYPE_LABEL[r.type]}</span>
                    </td>
                    <td data-label="Bultos" className="px-3 py-2 text-right font-semibold">{r.bultosReceived}</td>
                    <td data-label="Nota" className="px-3 py-2 text-ink-soft">{r.note || '—'}</td>
                    <td data-label="Registró" className="px-3 py-2 text-ink-soft">{r.createdBy || '—'}</td>
                    {isAdmin && (
                      <td data-label="" className="px-3 py-1 text-right">
                        <ConfirmDelete table="food_lots" id={r.id} onDeleted={afterChange} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
