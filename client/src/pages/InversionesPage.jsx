import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import MapaRed from '../components/MapaRed.jsx';
import SensitivityMatrix from '../components/SensitivityMatrix.jsx';
import { api } from '../lib/api.js';
import { numero, moneda, porcentaje } from '../lib/format.js';
import { useEscenario } from '../context/ScenarioContext.jsx';

// Trazados propuestos (referenciales) para los 5 macroproyectos, aproximando corredores reales
const PROPUESTAS = [
  { id: 'PRY-01', nombre: 'Ampliación Corredor Boomerang', coords: [[-17.78, -63.18], [-17.9, -63.6], [-18.3, -63.4]] },
  { id: 'PRY-02', nombre: 'Nuevo Ducto GIJA-II', coords: [[-21.7, -63.4], [-21.9, -63.5], [-22.02, -63.65]] },
  { id: 'PRY-03', nombre: 'Interconexión Chaco', coords: [[-21.26, -63.44], [-21.0, -63.6], [-20.5, -63.5]] },
  { id: 'PRY-04', nombre: 'Modernización Poliductos Altiplano', coords: [[-17.39, -66.16], [-17.7, -66.8], [-17.98, -67.15], [-16.5, -68.2]] },
  { id: 'PRY-05', nombre: 'Interconexión Rural Chuquisaca', coords: [[-19.8, -63.98], [-19.4, -64.6], [-19.03, -65.26]] },
];

export default function InversionesPage() {
  const [proyectos, setProyectos] = useState([]);
  const [seleccionId, setSeleccionId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const { escenario } = useEscenario();
  const navigate = useNavigate();

  useEffect(() => {
    api.proyectos().then((r) => {
      setProyectos(r);
      if (r.length) setSeleccionId(r[0].id);
    });
  }, []);

  useEffect(() => {
    if (!seleccionId) return;
    api.proyecto(seleccionId).then(setDetalle);
  }, [seleccionId]);

  const roiEscenario = detalle?.escenarios_roi?.[escenario];
  const flujo = detalle
    ? detalle.financiero_detallado.flujo.reduce((acc, v, i) => {
        const prev = i > 0 ? acc[i - 1].acumulado : 0;
        acc.push({ anio: i, acumulado: prev + v });
        return acc;
      }, [])
    : [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <div style={{ height: 420 }}>
          <MapaRed sistemas={[]} propuestas={PROPUESTAS} alturaClase="h-full" />
        </div>
        <div className="card">
          <h3 className="font-semibold text-slate-800 text-sm mb-2">Macroproyectos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {proyectos.map((p) => (
              <button
                key={p.id}
                onClick={() => setSeleccionId(p.id)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  seleccionId === p.id ? 'border-acento bg-cyan-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">{p.nombre}</p>
                <p className="text-xs text-slate-400">CAPEX US$ {numero(p.capex_total_mm_usd)} MM</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {detalle && (
          <>
            <div className="card">
              <h3 className="font-semibold text-slate-800 text-sm mb-1">{detalle.nombre}</h3>
              <p className="text-xs text-slate-500 mb-3">{detalle.descripcion}</p>
              <div className="space-y-1 text-xs">
                {detalle.fases.map((f) => (
                  <div key={f.anio} className="flex justify-between">
                    <span className="text-slate-500">Fase {f.anio}</span>
                    <span className="font-semibold text-slate-700">US$ {numero(f.capex_mm_usd)} MM</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/simulador')}
                className="mt-3 w-full bg-acento text-white text-xs font-semibold py-2 rounded-lg"
              >
                Abrir en simulador
              </button>
            </div>

            <div className="card grid grid-cols-2 gap-3">
              <p className="col-span-2 text-xs text-slate-400">Escenario activo: <b className="text-slate-600">{escenario}</b></p>
              <Kpi label="VAN" value={moneda((roiEscenario?.van_mm_usd ?? 0) * 1e6)} />
              <Kpi label="TIR" value={roiEscenario?.tir_pct != null ? porcentaje(roiEscenario.tir_pct) : '—'} />
              <Kpi label="Payback" value={roiEscenario?.payback_anios != null ? `${roiEscenario.payback_anios} a` : '—'} />
              <Kpi label="LCOT" value={detalle.financiero_detallado.lcot_usd != null ? `US$ ${numero(detalle.financiero_detallado.lcot_usd)}` : '—'} />
            </div>

            <div className="card">
              <h4 className="font-semibold text-slate-800 text-sm mb-2">Flujo 25 años (detallado, base)</h4>
              <div style={{ height: 180 }}>
                <ResponsiveContainer>
                  <LineChart data={flujo}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="anio" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(v) => moneda(v)} />
                    <Line type="monotone" dataKey="acumulado" stroke="#0e7490" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h4 className="font-semibold text-slate-800 text-sm mb-2">Sensibilidad TIR (5×5)</h4>
              <SensitivityMatrix sensibilidad={detalle.sensibilidad} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="font-bold text-slate-800 text-sm">{value}</p>
    </div>
  );
}
