import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Card } from '../components/Card.jsx';
import { localToday } from '../lib/format.js';

export default function DailyLog() {
  const today = localToday();
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/api/daily-log?date=${date}`).then(setData);
  }, [date]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-farm-dark/70">Fecha:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
      </div>

      {!data ? (
        <div>Cargando…</div>
      ) : (
        <>
          <Card title={`Consumo por corral — ${data.date}`}>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-farm-dark/70">
                <tr>
                  <th className="py-1">Corral</th>
                  <th>Bultos Levante</th>
                  <th>Bultos Finalizador</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.totalsPerCorral.map((r) => (
                  <tr key={r.corralId} className="border-t border-farm-sand/40">
                    <td className="py-1">{r.corralName}</td>
                    <td>{r.levante.toFixed(2)}</td>
                    <td>{r.finalizador.toFixed(2)}</td>
                    <td className="font-semibold">{(r.levante + r.finalizador).toFixed(2)}</td>
                  </tr>
                ))}
                {data.totalsPerCorral.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-farm-dark/50">
                      Sin consumo registrado este día.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <Card title="Movimientos de animales ese día">
            {data.movements.length === 0 ? (
              <div className="text-farm-dark/50 text-sm">Sin movimientos.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-farm-dark/70">
                  <tr>
                    <th className="py-1">Corral</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Por</th>
                    <th>Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movements.map((r) => (
                    <tr key={r.id} className="border-t border-farm-sand/40">
                      <td className="py-1">{r.corralName}</td>
                      <td>{r.movement}</td>
                      <td>{r.quantity}</td>
                      <td className="text-xs text-farm-dark/70">{r.createdBy}</td>
                      <td>{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Lotes de comida recibidos ese día">
            {data.lots.length === 0 ? (
              <div className="text-farm-dark/50 text-sm">Sin ingresos de bultos.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-farm-dark/70">
                  <tr>
                    <th className="py-1">Tipo</th>
                    <th>Bultos</th>
                    <th>Nota</th>
                    <th>Por</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lots.map((r) => (
                    <tr key={r.id} className="border-t border-farm-sand/40">
                      <td className="py-1 capitalize">{r.type}</td>
                      <td>{r.bultosReceived}</td>
                      <td>{r.note}</td>
                      <td className="text-xs text-farm-dark/70">{r.createdBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
