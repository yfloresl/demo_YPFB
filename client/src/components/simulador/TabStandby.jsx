import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { numero, moneda } from '../../lib/format.js';
import FormulaDetails from '../FormulaDetails.jsx';
import { Resultado } from './TabGas.jsx';

export default function TabStandby() {
  const [estaciones, setEstaciones] = useState([]);
  const [estacionId, setEstacionId] = useState('');
  const [reduccion, setReduccion] = useState(30);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.estaciones().then((r) => {
      setEstaciones(r.estaciones);
      if (r.estaciones.length) setEstacionId(r.estaciones[0].id);
    });
  }, []);

  async function calcular(e) {
    e.preventDefault();
    setError(null);
    try {
      setResultado(await api.simularStandby({ estacion_id: estacionId, reduccion_capacidad_pct: Number(reduccion) }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm">Standby de estación</h3>
        <form onSubmit={calcular} className="space-y-3">
          <label className="block text-xs font-medium text-slate-500">
            Estación
            <select value={estacionId} onChange={(e) => setEstacionId(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {estaciones.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} (score {e.score})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Reducción de capacidad (%)
            <input
              type="range"
              min="0"
              max="100"
              value={reduccion}
              onChange={(e) => setReduccion(e.target.value)}
              className="w-full mt-2"
            />
            <span className="text-slate-700 font-semibold">{reduccion}%</span>
          </label>
          <button className="w-full bg-acento text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90">Simular</button>
        </form>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <FormulaDetails>
          <p>Ahorro OPEX simulado = 2.2% del CAPEX equivalente de la estación. Score recalculado penalizando el sub-score de criticidad.</p>
        </FormulaDetails>
      </div>
      <div className="card flex flex-col gap-3">
        <h3 className="font-semibold text-slate-800 text-sm">Impacto</h3>
        {resultado ? (
          <div className="space-y-2">
            <Resultado label="Ahorro OPEX estimado" value={moneda(resultado.ahorro_opex_usd)} />
            <Resultado label="Score anterior" value={resultado.score_anterior} />
            <Resultado label="Score nuevo" value={resultado.score_nuevo} />
            <Resultado label="Recomendación" value={resultado.recomendacion_nueva} />
            {resultado.advertencias.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                {resultado.advertencias.map((a, i) => (
                  <p key={i}>{a}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Selecciona una estación y presiona Simular.</p>
        )}
      </div>
    </div>
  );
}
