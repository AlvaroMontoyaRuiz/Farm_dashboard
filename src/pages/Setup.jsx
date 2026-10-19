import { useState } from 'react';
import { api } from '../lib/api.js';

// One-time initial setup page. Create admin + up to 3 workers.
export default function Setup({ onDone }) {
  const [admin, setAdmin] = useState({ username: 'admin', password: '', displayName: 'Administrador' });
  const [workers, setWorkers] = useState([
    { username: 'trabajador1', password: '', displayName: 'Trabajador 1' },
    { username: 'trabajador2', password: '', displayName: 'Trabajador 2' },
    { username: 'trabajador3', password: '', displayName: 'Trabajador 3' },
  ]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function up(i, k, v) {
    const copy = workers.slice();
    copy[i] = { ...copy[i], [k]: v };
    setWorkers(copy);
  }

  async function go() {
    setBusy(true);
    setErr('');
    try {
      await api.post('/api/auth/setup', {
        admin,
        workers: workers.filter((w) => w.username && w.password),
      });
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto my-10 bg-white p-6 rounded-lg shadow">
      <h1 className="text-xl font-semibold mb-1">Configuración inicial</h1>
      <p className="text-sm text-farm-dark/70 mb-4">
        Crea el administrador y hasta 3 trabajadores. Esta página solo funciona la primera vez.
      </p>

      <h2 className="font-semibold mt-4">Administrador</h2>
      <Row v={admin} on={(k, v) => setAdmin({ ...admin, [k]: v })} />

      <h2 className="font-semibold mt-6">Trabajadores (opcionales)</h2>
      {workers.map((w, i) => (
        <Row key={i} v={w} on={(k, v) => up(i, k, v)} />
      ))}

      {err && <div className="text-red-600 text-sm mt-3">{err}</div>}
      <button
        className="mt-5 w-full bg-farm-green text-white py-2 rounded disabled:opacity-50"
        disabled={busy || !admin.username || !admin.password}
        onClick={go}
      >
        {busy ? 'Creando…' : 'Crear usuarios'}
      </button>
    </div>
  );
}

function Row({ v, on }) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      <input
        className="border rounded px-2 py-1 text-sm"
        placeholder="usuario"
        value={v.username}
        onChange={(e) => on('username', e.target.value)}
      />
      <input
        className="border rounded px-2 py-1 text-sm"
        placeholder="nombre a mostrar"
        value={v.displayName}
        onChange={(e) => on('displayName', e.target.value)}
      />
      <input
        className="border rounded px-2 py-1 text-sm"
        placeholder="contraseña"
        type="password"
        value={v.password}
        onChange={(e) => on('password', e.target.value)}
      />
    </div>
  );
}
