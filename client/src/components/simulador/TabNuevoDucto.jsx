import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import { Download } from 'lucide-react';
import { api } from '../../lib/api.js';
import { numero, moneda, porcentaje } from '../../lib/format.js';
import FormulaDetails from '../FormulaDetails.jsx';
import { Campo, Resultado } from './TabGas.jsx';

const TERRENOS = ['llano', 'selva', 'montania'];

function CapturaClicks({ onClick }) {
  useMapEvents({ click: (e) => onClick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

export default function TabNuevoDucto() {
  const [origen, setOrigen] = useState(null);
  const [destino, setDestino] = useState(null);
  const [tipo, setTipo] = useState('gasoducto');
  const [terreno, setTerreno] = useState('llano');
  const [volumenObjetivo, setVolumenObjetivo] = useState(10);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [escenarios, setEscenarios] = useState([]);

  function manejarClick(pos) {
    if (!origen || (origen && destino)) {
      setOrigen(pos);
      setDestino(null);
      setResultado(null);
    } else {
      setDestino(pos);
    }
  }

  async function calcular() {
    if (!origen || !destino) return;
    setError(null);
    try {
      const r = await api.simularNuevoDucto({
        origen: { lat: origen[0], lng: origen[1] },
        destino: { lat: destino[0], lng: destino[1] },
        tipo,
        volumen_objetivo: Number(volumenObjetivo),
        terreno,
      });
      setResultado(r);
    } catch (err) {
      setError(err.message);
    }
  }

  function guardarEscenario() {
    if (!resultado) return;
    setEscenarios((e) => [
      ...e,
      { id: e.length + 1, tipo, terreno, volumen_objetivo: volumenObjetivo, ...resultado, financiero: resultado.financiero },
    ]);
  }

  function exportarCSV() {
    if (!escenarios.length) return;
    const headers = ['id', 'tipo', 'terreno', 'volumen_objetivo', 'longitud_km', 'diametro_sugerido_pulg', 'capex_mm_usd', 'van_mm_usd', 'tir_pct', 'payback_anios'];
    const filas = escenarios.map((e) =>
      [e.id, e.tipo, e.terreno, e.volumen_objetivo, e.longitud_km, e.diametro_sugerido_pulg, e.capex.capex_mm_usd, e.financiero.van_mm_usd, e.financiero.tir_pct ?? '', e.financiero.payback_anios ?? ''].join(',')
    );
    const csv = [headers.join(','), ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'escenarios_nuevo_ducto.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card space-y-3">
          <h3 className="font-semibold text-slate-800 text-sm">Nuevo ducto — click en el mapa (origen, luego destino)</h3>
          <div style={{ height: 320 }} className="rounded-xl overflow-hidden border border-slate-200">
            <MapContainer center={[-17.0, -64.5]} zoom={6} className="z-0">
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              <CapturaClicks onClick={manejarClick} />
              {origen && <Marker position={origen} />}
              {destino && <Marker position={destino} />}
              {origen && destino && <Polyline positions={[origen, destino]} pathOptions={{ color: '#d97706', dashArray: '8 6', weight: 3 }} />}
            </MapContainer>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs font-medium text-slate-500">
              Tipo
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm">
                <option value="gasoducto">Gasoducto</option>
                <option value="oleoducto">Oleoducto</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              Terreno
              <select value={terreno} onChange={(e) => setTerreno(e.target.value)} className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm">
                {TERRENOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <Campo label="Volumen objetivo" value={volumenObjetivo} onChange={setVolumenObjetivo} />
          </div>
          <button onClick={calcular} disabled={!origen || !destino} className="w-full bg-acento text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-40">
            Calcular
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <FormulaDetails>
            <p>Longitud = Haversine(origen, destino) × 1.25 (factor de ruta). Diámetro sugerido: menor de la lista estándar cuya capacidad ≥ objetivo.</p>
            <p>CAPEX = diámetro × longitud × costo_unitario(terreno) × factor_ruta.</p>
          </FormulaDetails>
        </div>

        <div className="space-y-4">
          {resultado && (
            <div className="card grid grid-cols-2 gap-3">
              <Resultado label="Longitud" value={`${numero(resultado.longitud_km)} km`} />
              <Resultado label="Diámetro sugerido" value={`${resultado.diametro_sugerido_pulg}"`} />
              <Resultado label="CAPEX" value={moneda(resultado.capex.capex_mm_usd * 1e6)} />
              <Resultado label="VAN" value={moneda(resultado.financiero.van_mm_usd * 1e6)} />
              <Resultado label="TIR" value={resultado.financiero.tir_pct != null ? porcentaje(resultado.financiero.tir_pct) : 'No converge'} />
              <Resultado label="Payback" value={resultado.financiero.payback_anios != null ? `${resultado.financiero.payback_anios} años` : '—'} />
              <button onClick={guardarEscenario} className="col-span-2 bg-slate-800 text-white text-xs font-semibold py-2 rounded-lg hover:bg-slate-700">
                Guardar escenario para comparar
              </button>
            </div>
          )}
        </div>
      </div>

      {escenarios.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-slate-800 text-sm">Comparador de escenarios</h3>
            <button onClick={exportarCSV} className="flex items-center gap-1.5 text-xs font-semibold text-acento hover:underline">
              <Download size={14} /> Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-left p-2">Terreno</th>
                  <th className="text-left p-2">Long. km</th>
                  <th className="text-left p-2">Diám.</th>
                  <th className="text-left p-2">CAPEX MM</th>
                  <th className="text-left p-2">VAN MM</th>
                  <th className="text-left p-2">TIR</th>
                  <th className="text-left p-2">Payback</th>
                </tr>
              </thead>
              <tbody>
                {escenarios.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="p-2">{e.id}</td>
                    <td className="p-2">{e.tipo}</td>
                    <td className="p-2">{e.terreno}</td>
                    <td className="p-2">{numero(e.longitud_km)}</td>
                    <td className="p-2">{e.diametro_sugerido_pulg}"</td>
                    <td className="p-2">{numero(e.capex.capex_mm_usd)}</td>
                    <td className="p-2">{numero(e.financiero.van_mm_usd)}</td>
                    <td className="p-2">{e.financiero.tir_pct != null ? porcentaje(e.financiero.tir_pct) : '—'}</td>
                    <td className="p-2">{e.financiero.payback_anios ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
