import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Calculator, TrendingUp, Landmark, Drill, Gauge, ChevronsLeft, ChevronsRight, Droplets } from 'lucide-react';
import { useState } from 'react';

const MODULOS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/mapa', icon: Map, label: 'Mapa' },
  { to: '/simulador', icon: Calculator, label: 'Simulador' },
  { to: '/proyecciones', icon: TrendingUp, label: 'Proyecciones' },
  { to: '/inversiones', icon: Landmark, label: 'Inversiones' },
  { to: '/pozos', icon: Drill, label: 'Pozos' },
  { to: '/estaciones', icon: Gauge, label: 'Estaciones' },
];

export default function Sidebar({ abierto, onCerrar }) {
  const [colapsado, setColapsado] = useState(false);

  return (
    <>
      {abierto && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onCerrar} />}
      <aside
        className={`fixed md:static z-40 top-0 left-0 h-full bg-sidebar text-slate-300 flex flex-col transition-all duration-200
        ${colapsado ? 'md:w-16' : 'md:w-64'} w-64
        ${abierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex items-center gap-2 px-4 h-16 border-b border-slate-800 shrink-0">
          <Droplets className="text-acento shrink-0" size={26} />
          {!colapsado && (
            <div className="leading-tight">
              <p className="font-bold text-white text-sm">DuctoVision</p>
              <p className="text-[11px] text-slate-400">Bolivia</p>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {MODULOS.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              onClick={onCerrar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
                ${isActive ? 'bg-sidebaractive text-white' : 'hover:bg-slate-800/60 hover:text-white'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1 bottom-1 w-1 rounded-r bg-acento" />}
                  <m.icon size={18} className="shrink-0" />
                  {!colapsado && <span>{m.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          className="hidden md:flex items-center gap-2 px-4 py-3 text-slate-400 hover:text-white text-xs border-t border-slate-800"
          onClick={() => setColapsado((c) => !c)}
        >
          {colapsado ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!colapsado && <span>Colapsar</span>}
        </button>
      </aside>
    </>
  );
}
