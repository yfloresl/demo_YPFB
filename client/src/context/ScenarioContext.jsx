import { createContext, useContext, useState, useMemo } from 'react';

const ScenarioContext = createContext(null);

export function ScenarioProvider({ children }) {
  const [escenario, setEscenario] = useState('base');
  const [fechaSimulada] = useState('2026-07-05');

  const value = useMemo(() => ({ escenario, setEscenario, fechaSimulada }), [escenario, fechaSimulada]);

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useEscenario() {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error('useEscenario debe usarse dentro de ScenarioProvider');
  return ctx;
}

export const ESCENARIOS = [
  { id: 'conservador', label: 'Conservador' },
  { id: 'base', label: 'Base' },
  { id: 'optimista', label: 'Optimista' },
];
