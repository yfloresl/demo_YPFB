import { useEffect, useMemo, useState } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import DataTable from '../components/DataTable.jsx';
import FormulaDetails from '../components/FormulaDetails.jsx';
import { api } from '../lib/api.js';
import { useNavigate } from 'react-router-dom';

const RECOMENDACION_LABEL = { mantener: 'Mantener', optimizar: 'Optimizar', evaluar_standby: 'Evaluar standby' };
const RECOMENDACION_COLOR = { mantener: 'bg-green-100 text-green-700', optimizar: 'bg-amber-100 text-amber-700', evaluar_standby: 'bg-red-100 text-red-700' };

export default function EstacionesPage() {
  const [estaciones, setEstaciones] = useState([]);
  const [pesos, setPesos] = useState({});
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroRecomendacion, setFiltroRecomendacion] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.estaciones().then((r) => {
      setEstaciones(r.estaciones);
      setPesos(r.pesos_score);
    });
  }, []);

  const filtradas = estaciones.filter(
    (e) =>
      (!filtroTipo || e.tipo === filtroTipo) &&
      (!filtroRecomendacion || e.recomendacion === filtroRecomendacion) &&
      (!busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const radarData = seleccion
    ? Object.entries(seleccion.sub_scores).map(([k, v]) => ({ criterio: k, valor: v }))
    : [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <div className="card flex flex-wrap gap-3">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar estación..."
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
          />
          <Select label="Tipo" value={filtroTipo} onChange={setFiltroTipo} opciones={['compresion', 'bombeo', 'poliducto']} />
          <Select
            label="Recomendación"
            value={filtroRecomendacion}
            onChange={setFiltroRecomendacion}
            opciones={['mantener', 'optimizar', 'evaluar_standby']}
            labels={RECOMENDACION_LABEL}
          />
        </div>

        <div className="card">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">Estaciones ({filtradas.length})</h3>
          <DataTable
            columns={[
              { key: 'nombre', label: 'Nombre', render: (r) => (
                <button className="font-medium text-acento hover:underline text-left" onClick={() => setSeleccion(r)}>{r.nombre}</button>
              ) },
              { key: 'tipo', label: 'Tipo' },
              { key: 'depto', label: 'Depto.' },
              { key: 'score', label: 'Score', render: (r) => (
                <div className="flex items-center gap-2 w-28">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-acento" style={{ width: `${r.score}%` }} />
                  </div>
                  <span className="text-xs font-semibold">{r.score}</span>
                </div>
              ) },
              { key: 'recomendacion', label: 'Recomendación', render: (r) => (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${RECOMENDACION_COLOR[r.recomendacion]}`}>
                  {RECOMENDACION_LABEL[r.recomendacion]}
                </span>
              ) },
            ]}
            data={filtradas}
            initialSort={{ key: 'score', dir: 'asc' }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {seleccion ? (
          <>
            <div className="card">
              <h3 className="font-semibold text-slate-800 text-sm">{seleccion.nombre}</h3>
              <p className="text-xs text-slate-400 mb-3">{seleccion.depto} · {seleccion.tipo}</p>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="criterio" tick={{ fontSize: 10 }} />
                    <Radar dataKey="valor" stroke="#0e7490" fill="#0e7490" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <button onClick={() => navigate('/simulador')} className="w-full bg-acento text-white text-xs font-semibold py-2 rounded-lg mt-2">
                Simular standby
              </button>
            </div>
            <div className="card">
              <h4 className="font-semibold text-slate-800 text-sm mb-2">Metodología de scoring</h4>
              <FormulaDetails titulo="Ver pesos y criterios">
                <ul className="list-disc pl-4">
                  {Object.entries(pesos).map(([k, v]) => (
                    <li key={k}>{k}: {(v * 100).toFixed(0)}%</li>
                  ))}
                </ul>
                <p>score = Σ(sub_score_i × peso_i). ≥70 mantener, 55-69 optimizar, &lt;55 evaluar standby.</p>
              </FormulaDetails>
            </div>
          </>
        ) : (
          <div className="card text-sm text-slate-400">Selecciona una estación de la tabla para ver su ficha.</div>
        )}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, opciones, labels = {} }) {
  return (
    <label className="text-xs font-medium text-slate-500">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[150px]">
        <option value="">Todos</option>
        {opciones.map((o) => (
          <option key={o} value={o}>{labels[o] || o}</option>
        ))}
      </select>
    </label>
  );
}
