import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import ConfirmDelete from '../components/ConfirmDelete.jsx';

export default function Inventario({ user }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ type: 'levante', bultosReceived: '', note: '' });
  const [err, setErr] = useState('');
  const isAdmin = user.role === 'admin';

  async function reload() {
    const r = await api.get('/api/food-lots');
    setRows(r.lots);
  }
  useEffect(() => {
    reload();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/api/food-lots', {
        type: form.type,
        bultosReceived: Number(form.bultosReceived),
        note: form.note || null,
      });
      setForm({ type: 'levante', bultosReceived: '', note: '' });
      reload();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="grid md:grid-cols-3 gap-5">
      {isAdmin && (
        <Card title="Ingreso de bultos">
          <form onSubmit={submit} className="space-y-2">
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="levante">Levante</option>
              <option value="finalizador">Finalizador</option>
            </select>
            <input
              className="w-full border rounded px-2 py-1.5 text-sm"
              type="number"
              min="1"
              placeholder="Bultos recibidos"
              value={form.bultosReceived}
              onChange={(e) => setForm({ ...form, bultosReceived: e.target.value })}
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
      )}

      <div className={isAdmin ? 'md:col-span-2' : 'md:col-span-3'}>
        <Card title="Lotes de comida recibidos">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-farm-dark/70">
                <tr>
                  <th className="py-1">Fecha</th>
                  <th>Tipo</th>
                  <th>Bultos</th>
                  <th>Nota</th>
                  <th>Por</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-farm-sand/40">
                    <td className="py-1">{r.receivedAt}</td>
                    <td className="capitalize">{r.type}</td>
                    <td>{r.bultosReceived}</td>
                    <td>{r.note}</td>
                    <td className="text-xs text-farm-dark/70">{r.createdBy}</td>
                    {isAdmin && (
                      <td className="text-right">
                        <ConfirmDelete table="food_lots" id={r.id} onDeleted={reload} />
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-4 text-center text-farm-dark/50">
                      Sin registros.
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
