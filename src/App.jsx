import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from './lib/api.js';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Consumo from './pages/Consumo.jsx';
import Animales from './pages/Animales.jsx';
import Inventario from './pages/Inventario.jsx';
import DailyLog from './pages/DailyLog.jsx';
import DeletionLog from './pages/DeletionLog.jsx';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined=loading, null=anon
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    api
      .get('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await api.post('/api/auth/logout');
    setUser(null);
    nav('/login');
  }

  if (user === undefined) {
    return <div className="p-10 text-center text-farm-dark/60">Cargando…</div>;
  }

  // Public routes
  if (!user) {
    return (
      <Routes>
        <Route path="/setup" element={<Setup onDone={() => nav('/login')} />} />
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: loc }} />} />
      </Routes>
    );
  }

  // Authed layout
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-farm-green text-white px-4 py-3 flex items-center gap-4 shadow">
        <div className="font-semibold text-lg">🌾 Inventario Finca</div>
        <nav className="flex gap-3 text-sm">
          <NavItem to="/">Panel</NavItem>
          <NavItem to="/consumo">Consumo</NavItem>
          <NavItem to="/animales">Animales</NavItem>
          <NavItem to="/inventario">Inventario</NavItem>
          <NavItem to="/diario">Historial diario</NavItem>
          {user.role === 'admin' && <NavItem to="/eliminados">Historial eliminados</NavItem>}
        </nav>
        <div className="ml-auto text-sm flex items-center gap-3">
          <span className="opacity-90">
            {user.displayName}{' '}
            <span className="opacity-70">({user.role === 'admin' ? 'Admin' : 'Trabajador'})</span>
          </span>
          <button
            onClick={logout}
            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/consumo" element={<Consumo user={user} />} />
          <Route path="/animales" element={<Animales user={user} />} />
          <Route path="/inventario" element={<Inventario user={user} />} />
          <Route path="/diario" element={<DailyLog />} />
          <Route
            path="/eliminados"
            element={user.role === 'admin' ? <DeletionLog /> : <Navigate to="/" />}
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <footer className="text-xs text-farm-dark/50 text-center py-3">
        Inventario · Finca
      </footer>
    </div>
  );
}

function NavItem({ to, children }) {
  const loc = useLocation();
  const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={`px-2 py-1 rounded ${active ? 'bg-white/20' : 'hover:bg-white/10'}`}
    >
      {children}
    </Link>
  );
}
