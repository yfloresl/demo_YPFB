import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import { Layers, Search, Maximize, LocateFixed } from 'lucide-react';
import FlowArrows from './FlowArrows.jsx';
import DuctoDrawer from './DuctoDrawer.jsx';
import { COLOR_TIPO, colorUtilizacion, iconoEstacion, iconoPozo } from '../lib/icons.js';

const TILES = {
  claro: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  oscuro: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

function Recentrar({ centro, zoom }) {
  const map = useMap();
  return (
    <button
      className="leaflet-bar bg-white rounded-lg shadow p-2 hover:bg-slate-50"
      onClick={() => map.flyTo(centro, zoom)}
      title="Recentrar Bolivia"
    >
      <LocateFixed size={16} className="text-slate-600" />
    </button>
  );
}

export default function MapaRed({ sistemas = [], estaciones = [], pozos = [], propuestas = [], alturaClase = 'h-full' }) {
  const [tile, setTile] = useState('claro');
  const [capas, setCapas] = useState({
    gasoductos: true,
    oleoductos: true,
    poliductos: true,
    estaciones: true,
    pozos: true,
    propuestas: true,
  });
  const [modoUtilizacion, setModoUtilizacion] = useState(false);
  const [ductoSeleccionado, setDuctoSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const mapRef = useRef(null);
  const [panelAbierto, setPanelAbierto] = useState(false);

  const centro = [-17.0, -64.5];
  const zoom = 6;

  const sugerencias = useMemo(() => {
    if (!busqueda.trim()) return [];
    const q = busqueda.toLowerCase();
    const s = sistemas
      .filter((s) => s.nombre.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
      .slice(0, 5);
    return s;
  }, [busqueda, sistemas]);

  const sistemasFiltrados = sistemas.filter((s) => capas[`${s.tipo}s`]);

  return (
    <div className={`relative w-full ${alturaClase} rounded-2xl overflow-hidden border border-slate-200`}>
      <MapContainer center={centro} zoom={zoom} className="z-0" ref={mapRef} zoomControl={true}>
        <TileLayer url={TILES[tile]} attribution="&copy; OpenStreetMap, &copy; CARTO" />

        {sistemasFiltrados.map((s) => {
          const color = modoUtilizacion ? colorUtilizacion(s.utilizacion_pct ?? 50) : COLOR_TIPO[s.tipo];
          return (
            <Polyline
              key={s.id}
              positions={s.coords}
              pathOptions={{ color, weight: 1.5 + s.diametro_pulg * 0.18, opacity: 0.85 }}
              eventHandlers={{ click: () => { setDuctoSeleccionado(s.id); setPanelAbierto(true); } }}
            >
              <Tooltip sticky>
                <div className="text-xs">
                  <p className="font-semibold">{s.nombre}</p>
                  <p>{s.tramo}</p>
                  <p>Utilización: {s.utilizacion_pct ?? '—'}%</p>
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {capas.propuestas &&
          propuestas.map((p) => (
            <Polyline
              key={p.id}
              positions={p.coords}
              pathOptions={{ color: COLOR_TIPO.propuesta, weight: 3, opacity: 0.9, dashArray: '8 6' }}
            >
              <Tooltip sticky>{p.nombre}</Tooltip>
            </Polyline>
          ))}

        {sistemasFiltrados.map((s) => (
          <FlowArrows key={`fl-${s.id}`} coords={s.coords} color={modoUtilizacion ? colorUtilizacion(s.utilizacion_pct ?? 50) : COLOR_TIPO[s.tipo]} />
        ))}

        {capas.estaciones &&
          estaciones.map((e) => {
            const sis = sistemas.find((s) => s.id === e.sistema_id);
            return (
              <Marker key={e.id} position={e.coords} icon={iconoEstacion(e.tipo, sis ? COLOR_TIPO[sis.tipo] : '#64748b')}>
                <Tooltip>
                  <div className="text-xs">
                    <p className="font-semibold">{e.nombre}</p>
                    <p>Score: {e.score}</p>
                  </div>
                </Tooltip>
              </Marker>
            );
          })}

        {capas.pozos &&
          pozos.map((p) => (
            <Marker key={p.id} position={p.coords} icon={iconoPozo(p.categoria, p.prioridad)}>
              <Tooltip>
                <div className="text-xs">
                  <p className="font-semibold">{p.nombre}</p>
                  <p>{p.categoria}</p>
                </div>
              </Tooltip>
            </Marker>
          ))}

        <div className="leaflet-bottom leaflet-right mb-16">
          <Recentrar centro={centro} zoom={zoom} />
        </div>
      </MapContainer>

      {/* Panel de capas + selector de tiles + leyenda (columna única para no solaparse en mapas bajos) */}
      <div className="absolute top-3 left-3 z-[500] max-h-[calc(100%-1.5rem)] overflow-y-auto bg-white rounded-xl shadow-lg border border-slate-200 p-3 w-40 sm:w-52 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-slate-600">
          <Layers size={14} /> Capas
        </div>
        {Object.keys(capas).map((k) => (
          <label key={k} className="flex items-center gap-2 text-slate-600 capitalize">
            <input type="checkbox" checked={capas[k]} onChange={() => setCapas((c) => ({ ...c, [k]: !c[k] }))} />
            {k}
          </label>
        ))}
        <hr className="border-slate-100" />
        <label className="flex items-center gap-2 text-slate-600 font-medium">
          <input type="checkbox" checked={modoUtilizacion} onChange={() => setModoUtilizacion((v) => !v)} />
          Modo utilización
        </label>
        <div className="flex gap-1 pt-1">
          <button
            className={`flex-1 py-1 rounded ${tile === 'claro' ? 'bg-acento text-white' : 'bg-slate-100 text-slate-600'}`}
            onClick={() => setTile('claro')}
          >
            Claro
          </button>
          <button
            className={`flex-1 py-1 rounded ${tile === 'oscuro' ? 'bg-acento text-white' : 'bg-slate-100 text-slate-600'}`}
            onClick={() => setTile('oscuro')}
          >
            Oscuro
          </button>
        </div>
        <hr className="border-slate-100" />
        <p className="font-semibold text-slate-600">Leyenda</p>
        <Leyenda color={COLOR_TIPO.gasoducto} label="Gasoducto" />
        <Leyenda color={COLOR_TIPO.oleoducto} label="Oleoducto" />
        <Leyenda color={COLOR_TIPO.poliducto} label="Poliducto" />
        <Leyenda color={COLOR_TIPO.propuesta} label="Propuesta" />
      </div>

      {/* Buscador */}
      <div className="absolute top-3 right-3 z-[500] w-32 sm:w-64">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 flex items-center px-3 py-2 gap-2">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar ducto..."
            className="text-xs outline-none w-full"
          />
        </div>
        {sugerencias.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 mt-1 overflow-hidden">
            {sugerencias.map((s) => (
              <button
                key={s.id}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
                onClick={() => {
                  mapRef.current?.flyTo(s.coords[Math.floor(s.coords.length / 2)], 8);
                  setDuctoSeleccionado(s.id);
                  setPanelAbierto(true);
                  setBusqueda('');
                }}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {panelAbierto && ductoSeleccionado && (
        <DuctoDrawer ductoId={ductoSeleccionado} onClose={() => setPanelAbierto(false)} />
      )}
    </div>
  );
}

function Leyenda({ color, label }) {
  return (
    <div className="flex items-center gap-1.5 text-slate-600">
      <span className="w-3 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}
