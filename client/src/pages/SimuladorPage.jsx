import { useState } from 'react';
import TabGas from '../components/simulador/TabGas.jsx';
import TabLiquidos from '../components/simulador/TabLiquidos.jsx';
import TabFinanciero from '../components/simulador/TabFinanciero.jsx';
import TabNuevoDucto from '../components/simulador/TabNuevoDucto.jsx';
import TabStandby from '../components/simulador/TabStandby.jsx';

const TABS = [
  { id: 'gas', label: 'Capacidad de gas', Comp: TabGas },
  { id: 'liquidos', label: 'Capacidad de líquidos', Comp: TabLiquidos },
  { id: 'financiero', label: 'Evaluación financiera', Comp: TabFinanciero },
  { id: 'nuevo', label: 'Nuevo ducto en el mapa', Comp: TabNuevoDucto },
  { id: 'standby', label: 'Standby de estación', Comp: TabStandby },
];

export default function SimuladorPage() {
  const [activa, setActiva] = useState('gas');
  const Activo = TABS.find((t) => t.id === activa).Comp;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiva(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-colors ${
              activa === t.id ? 'bg-acento text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Activo />
    </div>
  );
}
