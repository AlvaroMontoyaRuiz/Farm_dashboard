import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { AuthShell, PasswordField } from '../components/AuthShell.jsx';

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
      const r = await api.post('/api/auth/login', { username: username.trim(), password });
      onLogin(r.user);
    } catch (e2) {
      setErr(e2.message || 'Usuario o contraseña incorrectos.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Ingresar" subtitle="Escribe el usuario y la contraseña que te dio el administrador.">
      <form onSubmit={go} className="space-y-4">
        <div>
          <label htmlFor="usuario" className="label">Usuario</label>
          <input
            id="usuario"
            className="field"
            value={username}
            onChange={(e) => setU(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Ej: admin o trabajador1"
          />
        </div>
        <div>
          <label htmlFor="clave" className="label">Contraseña</label>
          <PasswordField id="clave" value={password} onChange={setP} autoComplete="current-password" />
        </div>

        {err && (
          <p role="alert" className="rounded-xl bg-alert-bg text-alert text-sm px-3.5 py-2.5">
            {err}
          </p>
        )}

        <button className="btn btn-primary w-full" disabled={busy || !username || !password}>
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <div className="mt-6 rounded-xl bg-field px-4 py-3 text-sm text-ink-soft space-y-1.5">
        <p className="font-semibold text-ink">¿Qué puede hacer cada rol?</p>
        <p>
          <b className="text-ink">Administrador:</b> registra los ingresos de bultos, ve todo el inventario y el historial de eliminados.
        </p>
        <p>
          <b className="text-ink">Trabajador:</b> registra el consumo de alimento y el ingreso o salida de animales.
        </p>
      </div>

      <p className="text-sm text-ink-soft mt-5 text-center">
        ¿Primera vez en la finca?{' '}
        <Link className="text-farm-green font-semibold underline underline-offset-2" to="/setup">
          Crear los usuarios
        </Link>
      </p>
    </AuthShell>
  );
}
