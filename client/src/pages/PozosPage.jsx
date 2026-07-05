import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import MapaRed from '../components/MapaRed.jsx';
import DataTable from '../components/DataTable.jsx';
import { api } from '../lib/api.js';
import { numero, moneda, porcentaje } from '../lib/format.js';

export default function PozosPage() {
  const [pozos, setPozos] = useState([]);
  const [corredores, setCorredores] = useState([]);
  const [filtroCorredor, setFiltroCorredor] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroOperador, setFiltroOperador] = useState('');
  const [seleccion, setSeleccion] = useState(null);

  useEffect(() => {
    api.pozos().then(setPozos);
    api.corredores().then(setCorredores);
  }, []);

  const operadores = useMemo(() => [...new Set(pozos.map((p) => p.operador))], [pozos]);

  const filtrados = pozos.filter(
    (p) =>
      (!filtroCorredor || p.corredor === filtroCorredor) &&
      (!filtroCategoria || p.categoria === filtroCategoria) &&
      (!filtroOperador || p.operador === filtroOperador)
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {corredores.map((c) => (
          <button
            key={c.id}
            onClick={() => setFiltroCorredor(filtroCorredor === c.nombre ? '' : c.nombre)}
            className={`card text-left ${filtroCorredor === c.nombre ? 'ring-2 ring-acento' : ''}`}
          >
            <p className="text-xs text-slate-400">{c.deptos.join(' / ')}</p>
            <p className="font-semibold text-slate-800 text-sm">{c.nombre}</p>
            <p className="text-xs text-slate-500 mt-1">{c.n_pozos} pozos · {numero(c.gas_mmpcd_total)} MMpcd</p>
          </button>
        ))}
      </div>

      <div style={{ height: 380 }}>
        <MapaRed sistemas={[]} pozos={filtrados} />
      </div>

      <div className="card flex flex-wrap gap-3">
        <Select label="Corredor" value={filtroCorredor} onChange={setFiltroCorredor} opciones={corredores.map((c) => c.nombre)} />
        <Select label="Categoría" value={filtroCategoria} onChange={setFiltroCategoria} opciones={['descubrimiento', 'desarrollo', 'perforacion', 'programado', 'estratigrafico', 'negativo']} />
        <Select label="Operador" value={filtroOperador} onChange={setFiltroOperador} opciones={operadores} />
      </div>

      <div className="card">
        <h3 className="font-semibold text-slate-800 text-sm mb-3">Cartera de pozos ({filtrados.length})</h3>
        <DataTable
          columns={[
            { key: 'nombre', label: 'Pozo', render: (r) => (
              <button className="font-medium text-acento hover:underline" onClick={() => setSeleccion(r)}>{r.nombre}</button>
            ) },
            { key: 'categoria', label: 'Categoría' },
            { key: 'corredor', label: 'Corredor' },
            { key: 'indice', label: 'Índice' },
            { key: 'usd_mm_por_mmpcd', label: 'US$MM/MMpcd equiv.', render: (r) => r.usd_mm_por_mmpcd != null ? numero(r.usd_mm_por_mmpcd) : '—' },
            { key: 'tir_pct', label: 'TIR', render: (r) => r.tir_pct != null ? porcentaje(r.tir_pct) : '—' },
            { key: 'prioridad', label: 'Prioridad' },
          ]}
          data={filtrados}
          initialSort={{ key: 'indice', dir: 'desc' }}
        />
      </div>

      {seleccion && (
        <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4" onClick={() => setSeleccion(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-slate-800">{seleccion.nombre}</h3>
              <button onClick={() => setSeleccion(null)} className="text-slate-400">✕</button>
            </div>
            {seleccion.categoria === 'negativo' && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                {seleccion.nota}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info label="Operador" value={seleccion.operador} />
              <Info label="Categoría" value={seleccion.categoria} />
              <Info label="Gas potencial" value={`${numero(seleccion.produccion_potencial.gas_mmpcd)} MMpcd`} />
              <Info label="Líquidos potencial" value={`${numero(seleccion.produccion_potencial.liquidos_bpd)} BPD`} />
              <Info label="Distancia a red" value={`${numero(seleccion.distancia_km_red)} km`} />
              <Info label="Diámetro sugerido" value={`${seleccion.diametro_sugerido_pulg}"`} />
              <Info label="CAPEX interconexión" value={moneda(seleccion.capex_interconexion_mm_usd * 1e6)} />
              <Info label="TIR estimada" value={seleccion.tir_pct != null ? porcentaje(seleccion.tir_pct) : '—'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, opciones }) {
  return (
    <label className="text-xs font-medium text-slate-500">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[150px]">
        <option value="">Todos</option>
        {opciones.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value}</p>
    </div>
  );
}
