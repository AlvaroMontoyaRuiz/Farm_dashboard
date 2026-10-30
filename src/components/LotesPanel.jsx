import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Meter, IconCheck } from './ui.jsx';
import { api } from '../lib/api.js';
import { num, bultosWord } from '../lib/format.js';

// Lotes = groups of corrales. Everyone sees how many animals each lote has;
// the administrator can rename lotes and move corrales between them.
export default function LotesPanel({ lotes, sinLote, corrales, isAdmin, onChanged }) {
  const [editing, setEditing] = useState(false);
  const total = lotes.reduce((s, l) => s + l.animals, 0) + (sinLote ? sinLote.animals : 0);
  // "Sin lote" is only worth a card while it has animals (or while organizing).
  const showLoose = sinLote && (sinLote.animals > 0 || editing);

  return (
    <Panel
      title="Lotes"
      subtitle={
        lotes.length === 0
          ? 'Agrupa los corrales en lotes para ver cuántos animales tiene cada grupo'
          : `${num(total)} ${total === 1 ? 'animal' : 'animales'} repartidos en ${lotes.length} ${lotes.length === 1 ? 'lote' : 'lotes'}`
      }
      action={
        isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Link to="/camadas" className="btn btn-quiet">Historial de camadas</Link>
            <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing} className="btn btn-quiet">
              {editing ? 'Cerrar' : 'Organizar lotes'}
            </button>
          </div>
        )
      }
    >
      {lotes.length === 0 && !showLoose ? (
        <p className="text-sm text-ink-soft py-4">
          Aún no hay lotes.{isAdmin ? ' Usa “Organizar lotes” para crear el primero.' : ' El administrador puede crearlos.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {lotes.map((l) => (
            <LoteCard key={l.id} lote={l} />
          ))}
          {showLoose && <LoteCard lote={sinLote} loose />}
        </div>
      )}

      {editing && isAdmin && <Organizer lotes={lotes} corrales={corrales} onChanged={onChanged} />}
    </Panel>
  );
}

// Mortality of the batch in progress: deaths ÷ animals that entered. See "Camadas" for the history.
function Mortality({ batch, last }) {
  if (batch) {
    return (
      <p className="mt-2 text-sm" title="Muertes ÷ animales que ingresaron en esta camada">
        <span className="text-ink-soft">Mortalidad </span>
        <b className="text-ink">{num(batch.mortality)} %</b>
        <span className="text-ink-soft">
          {' '}· {num(batch.deaths)} de {num(batch.entered)} · día {batch.days}
        </span>
      </p>
    );
  }
  if (last) {
    return (
      <p className="mt-2 text-sm text-ink-soft" title="Muertes ÷ animales que ingresaron en esa camada">
        Última camada: <b className="text-ink">{num(last.mortality)} %</b> · {num(last.deaths)} de {num(last.entered)}
      </p>
    );
  }
  return <p className="mt-2 text-sm text-ink-faint">Sin camadas todavía</p>;
}

function LoteCard({ lote, loose = false }) {
  const pending = lote.activeCorrales - lote.fedCorrales;
  return (
    <div className={`rounded-xl border p-4 flex flex-col ${loose ? 'border-dashed border-line' : 'border-line bg-white'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display font-semibold text-[16px] leading-tight">{lote.name}</h3>
        <span className="text-xs text-ink-faint whitespace-nowrap">
          {lote.corrales.length} {lote.corrales.length === 1 ? 'corral' : 'corrales'}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display font-bold text-[38px] leading-none">{num(lote.animals)}</span>
        <span className="text-sm text-ink-soft">{lote.animals === 1 ? 'animal' : 'animales'}</span>
      </div>

      {!loose && <Mortality batch={lote.batch} last={lote.lastBatch} />}

      {lote.corrales.length === 0 ? (
        <p className="text-sm text-ink-faint mt-3">Sin corrales</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`Corrales de ${lote.name}`}>
          {lote.corrales.map((c) => (
            <li key={c.id}>
              <Link
                to={`/consumo?corral=${c.id}`}
                title={`${c.name}: ${c.animals} ${c.animals === 1 ? 'animal' : 'animales'}. Registrar consumo.`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 min-h-[36px] text-sm border ${
                  c.animals > 0 ? 'bg-field border-transparent hover:border-ink-faint' : 'border-dashed border-line text-ink-faint hover:border-ink-faint'
                }`}
              >
                <span className="font-semibold">{c.name}</span>
                <span className={c.animals > 0 ? 'text-ink-soft' : ''}>· {num(c.animals)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-3">
        {lote.activeCorrales > 0 ? (
          <>
            <Meter value={lote.fedCorrales} max={lote.activeCorrales} color="#17261D" label={`Corrales de ${lote.name} alimentados hoy`} />
            <p className={`text-xs mt-1.5 flex items-center gap-1 ${pending > 0 ? 'text-ink-soft' : 'text-farm-green font-medium'}`}>
              {pending === 0 && <IconCheck width={14} height={14} />}
              {pending === 0 ? 'Todos alimentados hoy' : `Faltan ${pending} de ${lote.activeCorrales} por alimentar`}
              <span className="ml-auto text-ink-faint font-normal">
                {num(lote.todayBultos)} {bultosWord(lote.todayBultos)}
              </span>
            </p>
          </>
        ) : (
          <p className="text-xs text-ink-faint">Sin animales</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- administrator: names and membership ---------------- */

function Organizer({ lotes, corrales, onChanged }) {
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const countOf = (id) => corrales.filter((c) => c.loteId === id).length;

  async function call(body, okText) {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      await api.post('/api/lotes', body);
      if (okText) setMsg(okText);
      await onChanged();
      return true;
    } catch (e) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e) {
    e.preventDefault();
    if (await call({ op: 'create', name: newName }, 'Lote creado.')) setNewName('');
  }

  return (
    <div className="mt-5 pt-5 border-t border-line grid lg:grid-cols-2 gap-6">
      <section aria-labelledby="org-corrales">
        <h3 id="org-corrales" className="font-semibold">¿En qué lote está cada corral?</h3>
        <p className="text-sm text-ink-soft mb-3">Elige el lote de cada corral. El cambio se guarda al instante.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
          {corrales.map((c) => (
            <label key={c.id} className="flex items-center gap-3 text-sm">
              <span className="w-[4.5rem] shrink-0 font-medium">{c.name}</span>
              <select
                className="field"
                value={c.loteId ?? ''}
                disabled={busy}
                onChange={(e) => call({ op: 'assign', corralId: c.id, loteId: e.target.value === '' ? null : Number(e.target.value) })}
                aria-label={`Lote de ${c.name}`}
              >
                <option value="">Sin lote</option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="org-lotes">
        <h3 id="org-lotes" className="font-semibold">Nombres de los lotes</h3>
        <p className="text-sm text-ink-soft mb-3">Cambia el nombre, agrega un lote nuevo o elimina uno vacío.</p>
        <div className="space-y-2.5">
          {lotes.map((l) => (
            <LoteRow key={l.id} lote={l} count={countOf(l.id)} busy={busy} call={call} />
          ))}
        </div>

        <form onSubmit={add} className="mt-4 flex gap-2">
          <input
            className="field"
            placeholder="Nombre del lote nuevo"
            maxLength={40}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="Nombre del lote nuevo"
          />
          <button className="btn btn-primary whitespace-nowrap" disabled={busy || !newName.trim()}>
            Agregar lote
          </button>
        </form>

        {err && <p className="text-sm text-alert mt-3" role="alert">{err}</p>}
        {msg && !err && <p className="text-sm text-farm-green font-medium mt-3" role="status">{msg}</p>}
      </section>
    </div>
  );
}

function LoteRow({ lote, count, busy, call }) {
  const [name, setName] = useState(lote.name);
  const [sure, setSure] = useState(false);
  const changed = name.trim() !== lote.name;

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed && name.trim()) call({ op: 'rename', id: lote.id, name }, 'Nombre guardado.');
        }}
      >
        <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label={`Nombre de ${lote.name}`} />
        {changed ? (
          <button className="btn btn-primary" disabled={busy || !name.trim()}>Guardar</button>
        ) : (
          <button
            type="button"
            className="btn btn-quiet"
            disabled={busy || count > 0}
            title={count > 0 ? 'Primero pasa sus corrales a otro lote' : 'Eliminar este lote'}
            onClick={() => setSure(true)}
          >
            Eliminar
          </button>
        )}
      </form>
      <p className="text-xs text-ink-faint mt-1">{count} {count === 1 ? 'corral' : 'corrales'}</p>
      {sure && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl bg-alert-bg text-alert text-sm px-3 py-2" role="alert">
          <span className="font-medium">¿Eliminar “{lote.name}”?</span>
          <button type="button" className="btn btn-danger !min-h-[36px] px-3" disabled={busy} onClick={() => call({ op: 'delete', id: lote.id }, 'Lote eliminado.')}>
            Sí, eliminar
          </button>
          <button type="button" className="btn btn-quiet !min-h-[36px] px-3" onClick={() => setSure(false)}>No</button>
        </div>
      )}
    </div>
  );
}
