import { Menu } from 'lucide-react';
import { useEscenario, ESCENARIOS } from '../context/ScenarioContext.jsx';

export default function Topbar({ titulo, onAbrirMenu }) {
  const { escenario, setEscenario, fechaSimulada } = useEscenario();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button className="md:hidden text-slate-600" onClick={onAbrirMenu}>
          <Menu size={22} />
        </button>
        <h1 className="text-lg font-semibold text-slate-800 truncate">{titulo}</h1>
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <span className="hidden sm:inline-flex items-center text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
          Fecha simulada: {fechaSimulada}
        </span>
        <div className="flex items-center bg-slate-100 rounded-full p-1 gap-1">
          {ESCENARIOS.map((e) => (
            <button
              key={e.id}
              onClick={() => setEscenario(e.id)}
              className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                escenario === e.id ? 'bg-acento text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
