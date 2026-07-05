import { useEffect, useState } from 'react';
import { Gauge, Route, Factory, DollarSign, Activity, Flame, TrendingUp, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiCard from '../components/KpiCard.jsx';
import ChartCard from '../components/ChartCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { numero, entero, porcentaje, COLOR_TIPO, TIPO_LABEL } from '../lib/format.js';

export default function Dashboard() {
  const [resumen, setResumen] = useState(null);
  const [ductos, setDuctos] = useState([]);
  const [estaciones, setEstaciones] = useState([]);
  const [pozos, setPozos] = useState([]);
  const [seriesSistemas, setSeriesSistemas] = useState([]);

  useEffect(() => {
    api.resumenRed().then(setResumen);
    api.ductos().then(setDuctos);
    api.estaciones().then((r) => setEstaciones(r.estaciones));
    api.pozos().then(setPozos);
  }, []);

  useEffect(() => {
    if (!ductos.length) return;
    // volumen apilado por tipo, 2022-2025, tomando 4 muestras representativas por sistema
    Promise.all(ductos.slice(0, 12).map((d) => api.ducto(d.id))).then((detalles) => {
      const porAnio = {};
      for (const d of detalles) {
        for (const p of d.serie_historica) {
          const anio = p.periodo.slice(0, 4);
          if (anio < '2022') continue;
          porAnio[anio] = porAnio[anio] || { anio, gasoducto: 0, oleoducto: 0, poliducto: 0 };
          porAnio[anio][d.tipo] += p.volumen / 12;
        }
      }
      setSeriesSistemas(Object.values(porAnio).sort((a, b) => a.anio.localeCompare(b.anio)));
    });
  }, [ductos]);

  if (!resumen) return <p className="text-slate-400 text-sm">Cargando...</p>;

  const topDuctos = [...ductos]
    .map((d) => ({ ...d, ingresos_estimados: d.capacidad * (d.utilizacion_pct / 100) }))
    .sort((a, b) => b.ingresos_estimados - a.ingresos_estimados)
    .slice(0, 8);

  const ductoTransito = ductos.find((d) => d.mercado === 'exportacion' && d.tipo === 'gasoducto');

  const alertasEstaciones = estaciones.filter((e) => e.score < 55).map((e) => ({ id: e.id, tipo: 'Estación', detalle: e.nombre, motivo: `Score ${e.score} — evaluar standby` }));
  const alertasDuctos = ductos
    .filter((d) => d.utilizacion_pct < 35 || d.utilizacion_pct > 85)
    .map((d) => ({ id: d.id, tipo: 'Ducto', detalle: d.nombre, motivo: d.utilizacion_pct > 85 ? `Utilización ${d.utilizacion_pct}% — cerca del límite` : `Utilización ${d.utilizacion_pct}% — subutilizado` }));
  const alertasPozos = pozos
    .filter((p) => p.prioridad === 1 && p.categoria !== 'negativo')
    .slice(0, 6)
    .map((p) => ({ id: p.id, tipo: 'Pozo', detalle: p.nombre, motivo: 'Prioridad 1 sin conectar a la red' }));
  const alertas = [...alertasDuctos, ...alertasEstaciones, ...alertasPozos];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Km de red" value={numero(resumen.km.total)} icon={Route} sub={`Gas ${numero(resumen.km.gas)} · Oleo ${numero(resumen.km.oleo)} · Poli ${numero(resumen.km.poli)}`} />
        <KpiCard label="Ductos" value={resumen.ductos} icon={Gauge} sub="Sistemas activos" />
        <KpiCard label="Estaciones" value={resumen.estaciones.compresion + resumen.estaciones.bombeo + resumen.estaciones.poliducto} icon={Factory} sub={`${resumen.estaciones.compresion} compresión · ${resumen.estaciones.bombeo} bombeo · ${resumen.estaciones.poliducto} poliducto`} />
        <KpiCard label="Potencia instalada" value={`${entero(resumen.potencia_hp)} HP`} icon={Activity} />
        <KpiCard label="Utilización promedio" value={porcentaje(resumen.utilizacion_promedio_pct)} icon={Gauge} />
        <KpiCard label="Ingresos anualizados" value={`US$ ${numero(resumen.ingresos_anualizados_usd_mm)} MM`} icon={DollarSign} />
        <KpiCard label="Volumen último mes" value={numero(resumen.volumen_ultimo_mes)} icon={Flame} sub="Unidades mixtas por sistema" />
        <KpiCard label="Tarifa gas exportación" value={`US$ ${resumen.parametros_globales.tarifas_referencia.gas_exportacion}/MPC`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Volumen por tipo de sistema (2022-2025)" subtitle="Promedio mensual apilado" className="lg:col-span-1">
          <ResponsiveContainer>
            <AreaChart data={seriesSistemas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="gasoducto" stackId="1" stroke={COLOR_TIPO.gasoducto} fill={COLOR_TIPO.gasoducto} fillOpacity={0.5} name="Gasoductos" />
              <Area type="monotone" dataKey="oleoducto" stackId="1" stroke={COLOR_TIPO.oleoducto} fill={COLOR_TIPO.oleoducto} fillOpacity={0.5} name="Oleoductos" />
              <Area type="monotone" dataKey="poliducto" stackId="1" stroke={COLOR_TIPO.poliducto} fill={COLOR_TIPO.poliducto} fillOpacity={0.5} name="Poliductos" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 8 ductos por ingresos estimados" subtitle="Proxy: capacidad × utilización">
          <ResponsiveContainer>
            <BarChart data={topDuctos} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="codigo" width={60} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="ingresos_estimados" radius={[0, 6, 6, 0]}>
                {topDuctos.map((d, i) => (
                  <Bar key={i} fill={COLOR_TIPO[d.tipo]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {ductoTransito && <TarjetaTransito ducto={ductoTransito} />}

      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-amber-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Alertas de decisión</h3>
        </div>
        <DataTable
          columns={[
            { key: 'tipo', label: 'Tipo' },
            { key: 'detalle', label: 'Elemento' },
            { key: 'motivo', label: 'Motivo', sortable: false },
          ]}
          data={alertas}
        />
      </div>
    </div>
  );
}

function TarjetaTransito({ ducto }) {
  const [detalle, setDetalle] = useState(null);
  useEffect(() => {
    api.ducto(ducto.id).then(setDetalle);
  }, [ducto.id]);
  const mini = detalle ? detalle.serie_historica.slice(-12).map((p) => ({ periodo: p.periodo.slice(2), v: p.volumen })) : [];
  return (
    <div className="card flex flex-col md:flex-row gap-4 items-center">
      <div className="flex-1">
        <p className="text-xs text-slate-400">Gas en tránsito — rampa desde abril 2025</p>
        <h3 className="font-semibold text-slate-800">{ducto.nombre}</h3>
        <p className="text-xs text-slate-500 mt-1">Utilización actual: {porcentaje(ducto.utilizacion_pct)}</p>
      </div>
      <div className="w-full md:w-64" style={{ height: 80 }}>
        <ResponsiveContainer>
          <LineChart data={mini}>
            <Line type="monotone" dataKey="v" stroke={COLOR_TIPO.gasoducto} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
