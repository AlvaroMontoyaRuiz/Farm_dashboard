import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';

export default function Animales() {
  const [corrales, setCorrales] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ corralId: '', movement: 'ingreso', quantity: '', note: '' });
  const [err, setErr] = useState('');

  async function reload() {
    const r = await api.get('/api/animals');
    setRows(r.movements);
  }
  useEffect(() => {
    api.get('/api/corrales').then((r) => setCorrales(r.corrales));
    reload();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/api/animals', {
        corralId: Number(form.corralId),
        movement: form.movement,
        quantity: Number(form.quantity),
        note: form.note || null,
      });
      setForm({ corralId: '', movement: 'ingreso', quantity: '', note: '' });
      reload();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-5">
      <Card title="Ingreso / Salida de animales">
        <form onSubmit={submit} className="space-y-2">
          <select
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={form.corralId}
            onChange={(e) => setForm({ ...form, corralId: e.target.value })}
            required
          >
            <option value="">-- Corral --</option>
            {corrales.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={form.movement}
            onChange={(e) => setForm({ ...form, movement: e.target.value })}
          >
            <option value="ingreso">Ingreso (+)</option>
            <option value="salida">Salida (−)</option>
          </select>
          <input
            className="w-full border rounded px-2 py-1.5 text-sm"
            type="number"
            min="1"
            placeholder="Cantidad"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            required
          />
          <input
            className="w-full border rounded px-2 py-1.5 text-sm"
            placeholder="Nota (opcional)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          {err && <div className="text-red-600 text-sm">{err}</div>}
          <button className="w-full bg-farm-green text-white py-2 rounded text-sm">Guardar</button>
        </form>
      </Card>

      <div className="md:col-span-2">
        <Card title="Movimientos recientes">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-farm-dark/70">
                <tr>
                  <th className="py-1">Fecha</th>
                  <th>Corral</th>
                  <th>Movimiento</th>
                  <th>Cantidad</th>
                  <th>Por</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-farm-sand/40">
                    <td className="py-1">{r.movementAt}</td>
                    <td>{r.corralName}</td>
                    <td className={r.movement === 'ingreso' ? 'text-farm-green' : 'text-red-700'}>
                      {r.movement}
                    </td>
                    <td>{r.quantity}</td>
                    <td className="text-xs text-farm-dark/70">{r.createdBy}</td>
                    <td className="text-right">
                      <ConfirmDelete table="animal_movements" id={r.id} onDeleted={reload} />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-farm-dark/50">
                      Sin movimientos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
