import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Login({ onLogin }) {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function go(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api.post('/api/auth/login', { username, password });
      onLogin(r.user);
    } catch (e) {
      setErr(e.message || 'Usuario o contraseña incorrectos.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto my-16 bg-white p-6 rounded-lg shadow">
      <h1 className="text-xl font-semibold mb-1">🌾 Inventario Finca</h1>
      <p className="text-sm text-farm-dark/70 mb-4">Ingresa con tu usuario.</p>
      <form onSubmit={go} className="space-y-3">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="usuario"
          value={username}
          onChange={(e) => setU(e.target.value)}
          autoComplete="username"
        />
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="contraseña"
          type="password"
          value={password}
          onChange={(e) => setP(e.target.value)}
          autoComplete="current-password"
        />
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <button
          className="w-full bg-farm-green text-white py-2 rounded disabled:opacity-50"
          disabled={busy || !username || !password}
        >
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className="text-xs text-farm-dark/60 mt-4">
        ¿Primera vez? <Link className="underline" to="/setup">Configurar usuarios</Link>
      </p>
    </div>
  );
}
