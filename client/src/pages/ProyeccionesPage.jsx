import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { api } from '../lib/api.js';
import { useEscenario } from '../context/ScenarioContext.jsx';
import { numero, porcentaje, COLOR_TIPO } from '../lib/format.js';
import FormulaDetails from '../components/FormulaDetails.jsx';

export default function ProyeccionesPage() {
  const { escenario } = useEscenario();
  const [ductos, setDuctos] = useState([]);
  const [ductoId, setDuctoId] = useState('');
  const [metrica, setMetrica] = useState('volumen');
  const [detalle, setDetalle] = useState(null);
  const [proyConservador, setProyConservador] = useState(null);
  const [proyOptimista, setProyOptimista] = useState(null);

  useEffect(() => {
    api.ductos().then((r) => {
      setDuctos(r);
      if (r.length) setDuctoId(r[0].id);
    });
  }, []);

  useEffect(() => {
    if (!ductoId) return;
    api.ducto(ductoId).then(setDetalle);
    api.ductoSeries(ductoId, metrica, 'conservador').then(setProyConservador);
    api.ductoSeries(ductoId, metrica, 'optimista').then(setProyOptimista);
  }, [ductoId, metrica]);

  const [serieBase, setSerieBase] = useState(null);
  useEffect(() => {
    if (!ductoId) return;
    api.ductoSeries(ductoId, metrica, 'base').then(setSerieBase);
  }, [ductoId, metrica]);

  const datos = useMemo(() => {
    if (!serieBase) return [];
    const historica = serieBase.historica.map((p) => ({ periodo: p.periodo, historica: p.valor }));
    const proyBase = serieBase.proyeccion.map((p) => ({ periodo: p.periodo, base: p.valor }));
    const proyCon = (proyConservador?.proyeccion || []).map((p) => ({ periodo: p.periodo, conservador: p.valor }));
    const proyOpt = (proyOptimista?.proyeccion || []).map((p) => ({ periodo: p.periodo, optimista: p.valor }));
    const mapa = new Map();
    for (const p of historica) mapa.set(p.periodo, { ...mapa.get(p.periodo), ...p });
    for (const p of proyBase) mapa.set(p.periodo, { ...mapa.get(p.periodo), ...p });
    for (const p of proyCon) mapa.set(p.periodo, { ...mapa.get(p.periodo), ...p });
    for (const p of proyOpt) mapa.set(p.periodo, { ...mapa.get(p.periodo), ...p });
    return Array.from(mapa.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [serieBase, proyConservador, proyOptimista]);

  const cagr = useMemo(() => {
    if (!serieBase?.historica?.length) return null;
    const inicio = serieBase.historica[0].valor;
    const fin = serieBase.historica[serieBase.historica.length - 1].valor;
    const anios = serieBase.historica.length / 12;
    if (inicio <= 0) return null;
    return (Math.pow(fin / inicio, 1 / anios) - 1) * 100;
  }, [serieBase]);

  const escenarioActivo = escenario === 'conservador' ? proyConservador : escenario === 'optimista' ? proyOptimista : serieBase;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-4 items-end">
        <label className="text-xs font-medium text-slate-500">
          Ducto
          <select value={ductoId} onChange={(e) => setDuctoId(e.target.value)} className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm w-64">
            {ductos.map((d) => (
              <option key={d.id} value={d.id}>{d.nombre}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          Métrica
          <select value={metrica} onChange={(e) => setMetrica(e.target.value)} className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="volumen">Volumen</option>
            <option value="ingresos">Ingresos</option>
          </select>
        </label>
        <div className="flex-1 flex flex-wrap gap-4 justify-end text-xs">
          <Chip label="CAGR histórico" value={cagr != null ? porcentaje(cagr) : '—'} />
          <Chip label="Escenario activo" value={escenario} />
          <Chip
            label="Año requiere expansión"
            value={escenarioActivo?.requiere_expansion_anio ?? 'No proyectado en horizonte'}
          />
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-slate-800 text-sm mb-2">
          Histórica y proyecciones — {detalle?.nombre}
        </h3>
        <div style={{ height: 340 }}>
          <ResponsiveContainer>
            <LineChart data={datos}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodo" tick={{ fontSize: 9 }} interval={5} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <ReferenceLine x="2026-07" stroke="#94a3b8" label={{ value: 'Hoy', fontSize: 10 }} />
              <Line type="monotone" dataKey="historica" stroke="#334155" strokeWidth={2} dot={false} name="Histórica" />
              <Line type="monotone" dataKey="base" stroke={COLOR_TIPO[detalle?.tipo] || '#0e7490'} strokeWidth={2} dot={false} name="Base" />
              <Line type="monotone" dataKey="conservador" stroke="#94a3b8" strokeDasharray="4 4" dot={false} name="Conservador" />
              <Line type="monotone" dataKey="optimista" stroke="#f59e0b" strokeDasharray="4 4" dot={false} name="Optimista" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card text-xs text-slate-600 space-y-1">
        <h3 className="font-semibold text-slate-800 text-sm mb-1">Tabla de supuestos de proyección</h3>
        <p>Escenario base: macroproyecto de gas entra en 2028 con rampa 2→10 MMm³/d en 3 años; consolidación de otro sistema en 8 MMm³/d hacia 2030.</p>
        <p>Conservador: base × 0.75, macroproyecto retrasado a 2031. Optimista: base × 1.20, macroproyecto adelantado a 2027.</p>
        <FormulaDetails titulo="Ver metodología completa">
          <p>Utilización histórica: gas exportación 55%/−4% anual; gas interno 68%/0% (+8% mayo-agosto); oleoductos 52%/−3%; poliductos 84%/+2%.</p>
          <p>Se marca "requiere expansión" en el primer año en que la utilización proyectada supera 90%.</p>
        </FormulaDetails>
      </div>
    </div>
  );
}

function Chip({ label, value }) {
  return (
    <div className="bg-slate-100 rounded-full px-3 py-1.5 text-slate-600">
      <span className="text-slate-400">{label}:</span> <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}
