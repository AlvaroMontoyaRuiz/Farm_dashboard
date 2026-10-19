import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../lib/api.js';
import { Card, Stat } from '../components/Card.jsx';

export default function Dashboard() {
  const [s, setS] = useState(null);

  useEffect(() => {
    api.get('/api/summary').then(setS);
  }, []);

  if (!s) return <div>Cargando…</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Animales totales" value={s.totalAnimals} />
        <Stat
          label="Bultos levante"
          value={s.inventory.remaining.levante}
          sub={`recibidos ${s.inventory.received.levante} · consumidos ${s.inventory.consumed.levante}`}
        />
        <Stat
          label="Bultos finalizador"
          value={s.inventory.remaining.finalizador}
          sub={`recibidos ${s.inventory.received.finalizador} · consumidos ${s.inventory.consumed.finalizador}`}
        />
        <Stat
          label="Consumo hoy"
          value={(s.todayConsumption.levante + s.todayConsumption.finalizador).toFixed(2)}
          sub={`L ${s.todayConsumption.levante} · F ${s.todayConsumption.finalizador}`}
        />
      </div>

      <Card title="Animales por corral">
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={s.corrales} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="animals" fill="#2f7d4f" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
