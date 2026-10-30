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
import Camadas from './pages/Camadas.jsx';
import ConsumoGrid from './pages/ConsumoGrid.jsx';
import ConsumoCorral from './pages/ConsumoCorral.jsx';
import Solicitudes from './pages/Solicitudes.jsx';

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

  // Admin: how many move requests are waiting (badge in the menu)
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if (!user || user.role !== 'admin') return undefined;
    const load = () => api.get('/api/solicitudes?count=1').then((r) => setPending(r.pending)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    window.addEventListener('solicitudes:changed', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('solicitudes:changed', load);
    };
  }, [user]);

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
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="font-display font-semibold text-[18px] md:text-[20px] tracking-tight">Inventario Finca</div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-white/80 hidden md:inline">
                {user.displayName} <span className="text-white/50">({user.role === 'admin' ? 'Administrador' : 'Trabajador'})</span>
              </span>
              <button onClick={logout} className="px-4 min-h-[40px] rounded-full bg-white/10 hover:bg-white/20 text-sm font-medium">
                Salir
              </button>
            </div>
          </div>
          <nav aria-label="Principal" className="flex gap-1.5 pb-2.5 -mx-1 px-1 overflow-x-auto no-scrollbar text-[15px] md:text-base">
            {/* Workers only get Consumo and Solicitudes. The Panel and Animales are for the administrator. */}
            {user.role === 'admin' && <NavItem to="/" end>Panel</NavItem>}
            <NavItem to="/consumo">Consumo</NavItem>
            {user.role === 'admin' && <NavItem to="/animales">Animales</NavItem>}
            <NavItem to="/solicitudes" badge={user.role === 'admin' ? pending : 0}>Solicitudes</NavItem>
            {user.role === 'admin' && (
              <>
                <NavItem to="/inventario">Bultos</NavItem>
                <NavItem to="/camadas">Camadas</NavItem>
                <NavItem to="/diario">Historial diario</NavItem>
                <NavItem to="/eliminados">Historial eliminados</NavItem>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7">
        <Routes>
          <Route path="/" element={user.role === 'admin' ? <Dashboard user={user} /> : <Navigate to="/consumo" replace />} />
          {/* Workers feed from a simple tablet screen: all corrales, then +/− per type of bulto. The administrator keeps the detailed form. */}
          <Route
            path="/consumo"
            element={
              user.role === 'admin' ? (
                <Consumo user={user} />
              ) : (
                <WorkerConsumoEntry />
              )
            }
          />
          <Route path="/consumo/corrales" element={<ConsumoGrid user={user} />} />
          <Route path="/consumo/corral/:corralId" element={<ConsumoCorral user={user} />} />
          <Route path="/animales" element={user.role === 'admin' ? <Animales user={user} /> : <Navigate to="/consumo" replace />} />
          <Route path="/solicitudes" element={<Solicitudes user={user} />} />
          {/* Only the administrator gets the pages below. */}
          <Route path="/inventario" element={user.role === 'admin' ? <Inventario user={user} /> : <Navigate to="/" />} />
          <Route path="/camadas" element={user.role === 'admin' ? <Camadas /> : <Navigate to="/" />} />
          <Route path="/diario" element={user.role === 'admin' ? <DailyLog /> : <Navigate to="/" />} />
          <Route
            path="/eliminados"
            element={user.role === 'admin' ? <DeletionLog /> : <Navigate to="/" />}
          />
          <Route path="*" element={<Navigate to={user.role === 'admin' ? '/' : '/consumo'} />} />
        </Routes>
      </main>

      <footer className="text-xs text-ink-faint text-center py-4">Inventario Finca</footer>
    </div>
  );
}

// Old links like /consumo?corral=7 (Panel tiles) open that corral's tablet screen.
function WorkerConsumoEntry() {
  const corral = new URLSearchParams(useLocation().search).get('corral');
  return <Navigate to={corral ? `/consumo/corral/${corral}` : '/consumo/corrales'} replace />;
}

function NavItem({ to, end, children, badge = 0 }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-4 min-h-[44px] inline-flex items-center rounded-full whitespace-nowrap font-medium transition-colors ${
          isActive ? 'bg-white text-ink' : 'text-white/75 hover:text-white hover:bg-white/10'
        }`
      }
    >
      {children}
      {badge > 0 && (
        <span className="ml-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-alert text-white text-xs font-bold inline-grid place-items-center" aria-label={`${badge} por aprobar`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}
