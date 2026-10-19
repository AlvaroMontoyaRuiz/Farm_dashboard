import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
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
    return <div className="p-10 text-center text-ink-soft">Cargando…</div>;
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
      <header className="bg-ink text-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="font-display font-semibold text-[18px] tracking-tight">Inventario Finca</div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-white/80 hidden sm:inline">
                {user.displayName} <span className="text-white/50">({user.role === 'admin' ? 'Administrador' : 'Trabajador'})</span>
              </span>
              <button onClick={logout} className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium">
                Salir
              </button>
            </div>
          </div>
          <nav aria-label="Principal" className="flex gap-1 pb-2 -mx-1 px-1 overflow-x-auto no-scrollbar text-sm">
            <NavItem to="/" end>Panel</NavItem>
            <NavItem to="/consumo">Consumo</NavItem>
            <NavItem to="/animales">Animales</NavItem>
            <NavItem to="/inventario">Bultos</NavItem>
            <NavItem to="/diario">Historial diario</NavItem>
            {user.role === 'admin' && <NavItem to="/eliminados">Historial eliminados</NavItem>}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
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

      <footer className="text-xs text-ink-faint text-center py-4">Inventario Finca</footer>
    </div>
  );
}

function NavItem({ to, end, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-colors ${
          isActive ? 'bg-white text-ink' : 'text-white/75 hover:text-white hover:bg-white/10'
        }`
      }
    >
      {children}
    </NavLink>
  );
}
