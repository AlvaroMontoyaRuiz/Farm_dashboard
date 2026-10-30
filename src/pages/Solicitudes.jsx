import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Panel, Skeleton } from '../components/ui.jsx';
import { num, shortDay, whenLabel } from '../lib/format.js';

const STATUS = {
  pendiente: { label: 'Pendiente', cls: 'bg-[#FFF1D6] text-[#8A5A00]' },
  aprobada: { label: 'Aprobada', cls: 'bg-[#E3EFE8] text-farm-green' },
  rechazada: { label: 'Rechazada', cls: 'bg-alert-bg text-alert' },
  cancelada: { label: 'Cancelada', cls: 'bg-field text-ink-soft' },
};
const changed = () => window.dispatchEvent(new Event('solicitudes:changed'));
const animalsWord = (n) => (n === 1 ? 'animal' : 'animales');

// Moving animals from one corral to another.
//   Worker: asks. Nothing moves until the administrator approves.
//   Administrator: approves or rejects what workers asked, and can also move animals directly.
export default function Solicitudes({ user }) {
  const isAdmin = user.role === 'admin';
  const [rows, setRows] = useState(null);
  const [corrales, setCorrales] = useState([]);
  const [animals, setAnimals] = useState({});
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, c, s] = await Promise.all([api.get('/api/solicitudes'), api.get('/api/corrales'), api.get('/api/stock')]);
      setRows(r.requests);
      setCorrales(c.corrales);
      setAnimals(s.animals);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const afterChange = () => {
    load();
    changed();
  };

  const pending = rows ? rows.filter((r) => r.status === 'pendiente') : [];
  const done = rows ? rows.filter((r) => r.status !== 'pendiente') : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-[30px] leading-tight">Solicitudes</h1>
        <p className="text-ink-soft max-w-2xl">
          {isAdmin
            ? 'Aprueba o rechaza los traslados de animales que piden los trabajadores. Los animales solo se mueven cuando tú apruebas.'
            : 'Pide mover animales de un corral a otro. Los animales solo se mueven cuando el administrador aprueba la solicitud.'}
        </p>
      </div>

      {err && <p className="text-alert text-sm">No se pudo cargar: {err}</p>}
      {!rows && !err && <Skeleton className="h-48" />}

      {rows && (
        <>
          {isAdmin && (
            <Panel
              title={`Por aprobar${pending.length ? ` (${pending.length})` : ''}`}
              subtitle="Toca Aprobar para mover los animales ahora"
              className={pending.length ? 'border-alert/30' : ''}
            >
              {pending.length === 0 ? (
                <p className="text-sm text-ink-soft py-3">No hay solicitudes pendientes.</p>
              ) : (
                <ul className="space-y-3">
                  {pending.map((r) => (
                    <PendingCard key={r.id} r={r} isAdmin onDone={afterChange} />
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            <Panel
              title={isAdmin ? 'Mover animales ahora' : 'Nueva solicitud'}
              subtitle={isAdmin ? 'Como administrador, el traslado se hace de inmediato' : 'El administrador debe aprobarla'}
            >
              <RequestForm corrales={corrales} animals={animals} isAdmin={isAdmin} onSent={afterChange} />
            </Panel>

            <div className="lg:col-span-2 space-y-5">
              {!isAdmin && (
                <Panel title={`Esperando aprobación${pending.length ? ` (${pending.length})` : ''}`} subtitle="Tus solicitudes que el administrador aún no resuelve">
                  {pending.length === 0 ? (
                    <p className="text-sm text-ink-soft py-3">No tienes solicitudes pendientes.</p>
                  ) : (
                    <ul className="space-y-3">
                      {pending.map((r) => (
                        <PendingCard key={r.id} r={r} onDone={afterChange} />
                      ))}
                    </ul>
                  )}
                </Panel>
              )}

              <Panel title="Historial" subtitle={isAdmin ? 'Solicitudes ya resueltas' : 'Tus solicitudes ya resueltas'}>
                {done.length === 0 ? (
                  <p className="text-sm text-ink-soft py-6 text-center">Aún no hay solicitudes resueltas.</p>
                ) : (
                  <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
                    <table className="rtable w-full text-[15px]">
                      <thead className="bg-field text-left text-ink-soft">
                        <tr>
                          <th className="px-3 py-2 font-medium">Fecha</th>
                          <th className="px-3 py-2 font-medium">Traslado</th>
                          <th className="px-3 py-2 font-medium text-right">Animales</th>
                          {isAdmin && <th className="px-3 py-2 font-medium">Pidió</th>}
                          <th className="px-3 py-2 font-medium">Estado</th>
                          <th className="px-3 py-2 font-medium">Resolvió</th>
                        </tr>
                      </thead>
                      <tbody>
                        {done.map((r) => (
                          <tr key={r.id} className="border-t border-line align-top">
                            <td data-label="Fecha" className="px-3 py-2 whitespace-nowrap">{shortDay((r.resolvedAt || r.requestedAt).slice(0, 10))}</td>
                            <td data-label="Traslado" className="px-3 py-2 whitespace-nowrap">
                              <span>{r.fromName} → {r.toName}</span>
                            </td>
                            <td data-label="Animales" className="px-3 py-2 text-right font-semibold">{num(r.quantity)}</td>
                            {isAdmin && <td data-label="Pidió" className="px-3 py-2 text-ink-soft">{r.requestedBy || '—'}</td>}
                            <td data-label="Estado" className="px-3 py-2">
                              <Pill status={r.status} />
                            </td>
                            <td data-label="Resolvió" className="px-3 py-2 text-ink-soft">
                              <div>
                                {r.resolvedBy || '—'}
                                {r.decisionNote && <div className="text-xs text-ink-faint whitespace-normal">“{r.decisionNote}”</div>}
                              </div>
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
        </>
      )}
    </div>
  );
}

function Pill({ status }) {
  const s = STATUS[status] || STATUS.pendiente;
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

/* ---------- a request waiting for approval ---------- */

function PendingCard({ r, isAdmin = false, onDone }) {
  const [mode, setMode] = useState(null); // null | 'reject'
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const tooMany = r.quantity > r.fromAnimals;

  async function act(action) {
    setBusy(true);
    setErr('');
    try {
      await api.post(`/api/solicitudes/${r.id}`, { action, note: note || undefined });
      onDone();
    } catch (e) {
      setErr(e.message);
      if (e.code === 'already_resolved') onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-display font-semibold text-[19px] leading-tight">
            {r.fromName} <span aria-hidden>→</span> {r.toName}
          </p>
          <p className="text-[15px] mt-1">
            <b>{num(r.quantity)}</b> {animalsWord(r.quantity)}
          </p>
          <p className="text-sm text-ink-soft mt-1">
            {isAdmin ? `Pidió ${r.requestedBy || 'un trabajador'} · ` : ''}
            {whenLabel(r.requestedAt)}
          </p>
          {r.note && <p className="text-sm mt-1.5">“{r.note}”</p>}
          {isAdmin && (
            <p className={`text-xs mt-1.5 ${tooMany ? 'text-alert font-semibold' : 'text-ink-faint'}`}>
              {r.fromName} tiene ahora {num(r.fromAnimals)} {animalsWord(r.fromAnimals)}
              {tooMany ? ': no alcanzan para aprobar este traslado.' : '.'}
            </p>
          )}
        </div>
        <Pill status="pendiente" />
      </div>

      {err && <p className="text-sm text-alert mt-3" role="alert">{err}</p>}

      {isAdmin ? (
        mode === 'reject' ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[200px] text-sm">
              <span className="label">Motivo (opcional)</span>
              <input className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ej: espera a que se venda el otro lote" autoFocus />
            </label>
            <button className="btn btn-danger" disabled={busy} onClick={() => act('reject')}>Confirmar rechazo</button>
            <button className="btn btn-quiet" disabled={busy} onClick={() => setMode(null)}>Volver</button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary flex-1 sm:flex-none sm:min-w-[180px]" disabled={busy || tooMany} onClick={() => act('approve')}>
              {busy ? 'Moviendo…' : 'Aprobar traslado'}
            </button>
            <button className="btn btn-quiet flex-1 sm:flex-none" disabled={busy} onClick={() => setMode('reject')}>Rechazar</button>
          </div>
        )
      ) : (
        <div className="mt-3">
          <button className="btn btn-quiet" disabled={busy} onClick={() => act('cancel')}>
            {busy ? 'Cancelando…' : 'Cancelar solicitud'}
          </button>
        </div>
      )}
    </li>
  );
}

/* ---------- form ---------- */

function RequestForm({ corrales, animals, isAdmin, onSent }) {
  const [form, setForm] = useState({ from: '', to: '', quantity: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const have = form.from ? animals[form.from] || 0 : null;
  const q = Number(form.quantity) || 0;
  const over = have !== null && q > have;
  const canSend = !busy && form.from && form.to && form.from !== form.to && Number.isInteger(q) && q > 0 && !over;
  const nameOf = (id) => corrales.find((c) => String(c.id) === String(id))?.name || '';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setOk('');
    try {
      await api.post('/api/solicitudes', {
        fromCorralId: Number(form.from),
        toCorralId: Number(form.to),
        quantity: q,
        note: form.note || null,
      });
      setOk(
        isAdmin
          ? `Listo: ${q} ${animalsWord(q)} pasaron de ${nameOf(form.from)} a ${nameOf(form.to)}.`
          : `Solicitud enviada: ${q} ${animalsWord(q)} de ${nameOf(form.from)} a ${nameOf(form.to)}. Espera la aprobación del administrador.`
      );
      setForm({ from: '', to: '', quantity: '', note: '' });
      onSent();
    } catch (e2) {
      setErr(e2.message);
      onSent();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        <span className="label">Corral de origen (de dónde salen)</span>
        <select className="field" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: form.to === e.target.value ? '' : form.to })} required>
          <option value="">Elige un corral</option>
          {corrales
            .filter((c) => (animals[c.id] || 0) > 0)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {animals[c.id]} {animalsWord(animals[c.id])}
              </option>
            ))}
        </select>
        {corrales.length > 0 && corrales.every((c) => !(animals[c.id] > 0)) && (
          <span className="block mt-1 text-xs text-ink-faint">Ningún corral tiene animales registrados.</span>
        )}
      </label>

      <label className="block text-sm">
        <span className="label">Corral de destino (a dónde van)</span>
        <select className="field" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required>
          <option value="">Elige un corral</option>
          {corrales
            .filter((c) => String(c.id) !== form.from)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {animals[c.id] || 0} {animalsWord(animals[c.id] || 0)}
              </option>
            ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="label">Cantidad de animales</span>
        <input
          className="field"
          type="number"
          min="1"
          step="1"
          max={have || undefined}
          inputMode="numeric"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          required
        />
        {have !== null && (
          <span className={`block mt-1 text-xs ${over ? 'text-alert font-semibold' : 'text-ink-faint'}`}>
            {over ? `Solo hay ${have} ${animalsWord(have)} en ${nameOf(form.from)}.` : `${nameOf(form.from)} tiene ${have} ${animalsWord(have)}.`}
          </span>
        )}
      </label>

      <label className="block text-sm">
        <span className="label">Motivo o nota (opcional)</span>
        <input className="field" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ej: separar los más pequeños" />
      </label>

      {err && <p className="text-sm text-alert" role="alert">{err}</p>}
      {ok && <p className="text-sm text-farm-green font-medium" role="status">{ok}</p>}
      <button className="btn btn-primary w-full" disabled={!canSend}>
        {busy ? 'Enviando…' : isAdmin ? 'Mover animales' : 'Enviar solicitud'}
      </button>
    </form>
  );
}
