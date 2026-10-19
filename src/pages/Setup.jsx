import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { AuthShell, PasswordField } from '../components/AuthShell.jsx';

// One-time initial setup page. Creates the administrator and up to 3 workers.
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
    setWorkers((ws) => ws.map((w, j) => (j === i ? { ...w, [k]: v } : w)));
  }

  const adminOk = admin.username.trim() && admin.password.length >= 6;
  const half = workers.filter((w) => (w.username.trim() && !w.password) || (!w.username.trim() && w.password));

  async function go() {
    setBusy(true);
    setErr('');
    try {
      await api.post('/api/auth/setup', {
        admin: { ...admin, username: admin.username.trim() },
        workers: workers
          .filter((w) => w.username.trim() && w.password)
          .map((w) => ({ ...w, username: w.username.trim() })),
      });
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      wide
      title="Crear los usuarios"
      subtitle="Este paso se hace una sola vez. Después cada persona ingresa con su usuario y contraseña."
    >
      {/* Column headers (tablet and desktop). On phones every field carries its own label. */}
      <div className="hidden md:grid grid-cols-[130px_1fr_1fr_1.2fr] gap-3 px-1 pb-2 text-sm font-semibold text-ink-soft">
        <div>Rol</div>
        <div>Nombre que se muestra</div>
        <div>Usuario</div>
        <div>Contraseña</div>
      </div>

      <div className="space-y-3">
        <UserRow
          id="admin"
          role="Administrador"
          tone="admin"
          v={admin}
          on={(k, v) => setAdmin({ ...admin, [k]: v })}
        />
        {workers.map((w, i) => (
          <UserRow key={i} id={`w${i}`} role="Trabajador" v={w} on={(k, v) => up(i, k, v)} optional />
        ))}
      </div>

      <ul className="mt-5 text-sm text-ink-soft space-y-1 list-disc pl-5">
        <li>La contraseña debe tener al menos 6 caracteres.</li>
        <li>Los trabajadores son opcionales: deja en blanco los que no necesites (máximo 3).</li>
        <li>Anota las contraseñas en un lugar seguro y entrégalas a cada persona.</li>
      </ul>

      {half.length > 0 && (
        <p className="mt-4 rounded-xl bg-field text-ink-soft text-sm px-3.5 py-2.5">
          Un trabajador sin usuario o sin contraseña no se creará.
        </p>
      )}
      {err && (
        <p role="alert" className="mt-4 rounded-xl bg-alert-bg text-alert text-sm px-3.5 py-2.5">
          {err}
        </p>
      )}

      <button className="btn btn-primary w-full mt-6" disabled={busy || !adminOk} onClick={go}>
        {busy ? 'Creando…' : 'Crear usuarios'}
      </button>
      <p className="text-sm text-ink-soft mt-4 text-center">
        <Link className="text-farm-green font-semibold underline underline-offset-2" to="/login">
          Volver a ingresar
        </Link>
      </p>
    </AuthShell>
  );
}

function UserRow({ id, role, tone, v, on, optional }) {
  // Same row on every screen: a 4-column grid on tablets, a stacked card with labels on phones.
  const lab = 'label md:sr-only';
  return (
    <div className="rounded-2xl border border-line bg-field/60 p-3.5 md:p-0 md:border-0 md:bg-transparent grid gap-3 md:grid-cols-[130px_1fr_1fr_1.2fr] md:items-center">
      <div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${
            tone === 'admin' ? 'bg-ink text-white' : 'bg-[#E3EFE8] text-farm-green'
          }`}
        >
          {role}
        </span>
        {optional && <span className="ml-2 text-xs text-ink-faint md:hidden">opcional</span>}
      </div>
      <div>
        <label htmlFor={`${id}-n`} className={lab}>Nombre que se muestra</label>
        <input id={`${id}-n`} className="field" value={v.displayName} onChange={(e) => on('displayName', e.target.value)} />
      </div>
      <div>
        <label htmlFor={`${id}-u`} className={lab}>Usuario</label>
        <input
          id={`${id}-u`}
          className="field"
          value={v.username}
          onChange={(e) => on('username', e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <div>
        <label htmlFor={`${id}-p`} className={lab}>Contraseña</label>
        <PasswordField id={`${id}-p`} value={v.password} onChange={(x) => on('password', x)} autoComplete="new-password" placeholder="Mínimo 6" />
      </div>
    </div>
  );
}
