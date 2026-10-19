import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Panel, Skeleton } from '../components/ui.jsx';
import { whenLabel } from '../lib/format.js';

const TABLES = { feed_consumption: 'Consumo', animal_movements: 'Animales', food_lots: 'Ingreso de bultos' };

export default function DeletionLog() {
  const [rows, setRows] = useState(null);
  const [table, setTable] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    const q = new URLSearchParams();
    if (table) q.set('table', table);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    api
      .get('/api/deletion-log?' + q.toString())
      .then((r) => setRows(r.log))
      .catch((e) => setErr(e.message));
  }, [table, from, to]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-[30px] leading-tight">Historial de eliminados</h1>
        <p className="text-ink-soft">Cada registro que se elimina queda guardado aquí, con quién lo hizo y por qué.</p>
      </div>

      <Panel>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <label className="block">
            <span className="label">Tipo de registro</span>
            <select value={table} onChange={(e) => setTable(e.target.value)} className="field">
              <option value="">Todos</option>
              {Object.entries(TABLES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Desde</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="field" />
          </label>
          <label className="block">
            <span className="label">Hasta</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="field" />
          </label>
        </div>

        {err && <p className="text-alert text-sm">No se pudo cargar: {err}</p>}
        {!rows && !err ? (
          <Skeleton className="h-40" />
        ) : rows && rows.length === 0 ? (
          <p className="text-sm text-ink-soft py-6 text-center">No hay registros eliminados.</p>
        ) : rows ? (
          <div className="rtable-wrap overflow-x-auto rounded-xl border border-line">
            <table className="rtable w-full text-[15px]">
              <thead className="bg-field text-left text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Cuándo</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Eliminó</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                  <th className="px-3 py-2 font-medium">Datos</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td data-label="Cuándo" className="px-3 py-2 whitespace-nowrap">{whenLabel(r.deletedAt)}</td>
                    <td data-label="Tipo" className="px-3 py-2">{TABLES[r.tableName] || r.tableName}</td>
                    <td data-label="Eliminó" className="px-3 py-2 text-ink-soft">{r.deletedBy || '—'}</td>
                    <td data-label="Motivo" className="px-3 py-2">{r.reason || <span className="text-ink-faint">Sin motivo</span>}</td>
                    <td data-label="Datos" className="px-3 py-2">
                      <details>
                        <summary className="cursor-pointer text-farm-green font-medium min-h-[40px] inline-flex items-center">Ver datos</summary>
                        <pre className="mt-1 text-xs bg-field p-2 rounded-lg max-w-xs overflow-x-auto text-left">{prettyJson(r.payloadJson)}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function prettyJson(s) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
