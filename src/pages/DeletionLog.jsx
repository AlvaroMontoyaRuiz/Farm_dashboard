import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';

export default function DeletionLog() {
  const [rows, setRows] = useState([]);
  const [table, setTable] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function load() {
    const q = new URLSearchParams();
    if (table) q.set('table', table);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const r = await api.get('/api/deletion-log?' + q.toString());
    setRows(r.log);
  }
  useEffect(() => {
    load();
  }, [table, from, to]);

  return (
    <Card
      title="Historial de registros eliminados"
      right={
        <div className="flex gap-2 text-xs">
          <select value={table} onChange={(e) => setTable(e.target.value)} className="border rounded px-1 py-0.5">
            <option value="">Todas las tablas</option>
            <option value="feed_consumption">Consumo</option>
            <option value="animal_movements">Animales</option>
            <option value="food_lots">Lotes</option>
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-1 py-0.5" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-1 py-0.5" />
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-farm-dark/70">
            <tr>
              <th className="py-1">Eliminado</th>
              <th>Tabla</th>
              <th>Registro</th>
              <th>Por</th>
              <th>Motivo</th>
              <th>Datos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-farm-sand/40 align-top">
                <td className="py-1 whitespace-nowrap">{r.deletedAt}</td>
                <td>{labelFor(r.tableName)}</td>
                <td>#{r.recordId}</td>
                <td className="text-xs text-farm-dark/70">{r.deletedBy}</td>
                <td>{r.reason}</td>
                <td>
                  <pre className="text-[11px] bg-farm-beige p-1 rounded max-w-xs overflow-x-auto">
                    {prettyJson(r.payloadJson)}
                  </pre>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-farm-dark/50">
                  Sin eliminaciones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function labelFor(t) {
  return { feed_consumption: 'Consumo', animal_movements: 'Animales', food_lots: 'Lotes' }[t] || t;
}
function prettyJson(s) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
