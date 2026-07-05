import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api.js';
import { numero, porcentaje, TIPO_LABEL, COLOR_TIPO } from '../lib/format.js';
import { useNavigate } from 'react-router-dom';

export default function DuctoDrawer({ ductoId, onClose }) {
  const [detalle, setDetalle] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!ductoId) return;
    setDetalle(null);
    api.ducto(ductoId).then(setDetalle).catch(() => setDetalle(null));
  }, [ductoId]);

  if (!ductoId) return null;

  const sparkline = detalle ? detalle.serie_historica.slice(-12).map((p) => ({ v: p.volumen })) : [];
  const capTeorica = detalle?.capacidad_teorica;
  const capacidadTeoricaVal = capTeorica ? (capTeorica.mmpcd ?? capTeorica.bpd) : null;

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-none">
      <div
        className="absolute right-0 top-0 h-full md:w-[420px] w-full bg-white shadow-2xl pointer-events-auto overflow-y-auto
        md:translate-x-0 border-l border-slate-200
        max-md:top-auto max-md:bottom-0 max-md:h-[60vh] max-md:rounded-t-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div>
            <p className="text-xs text-slate-400">{detalle ? TIPO_LABEL[detalle.tipo] : '...'}</p>
            <h3 className="font-semibold text-slate-800">{detalle?.nombre || 'Cargando...'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>
        {detalle && (
          <div className="p-5 space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Info label="Tramo" value={detalle.tramo} span />
              <Info label="Longitud" value={`${numero(detalle.longitud_km)} km`} />
              <Info label="Diámetro" value={`${detalle.diametro_pulg}"`} />
              <Info label="Capacidad declarada" value={`${numero(detalle.capacidad)} ${detalle.unidad}`} span />
              <Info
                label="Capacidad teórica (fórmula)"
                value={capacidadTeoricaVal != null ? `${numero(capacidadTeoricaVal)} ${detalle.unidad === 'BPD' ? 'BPD' : 'MMpcd'}` : '—'}
                span
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Utilización actual</span>
                <span className="font-semibold">{porcentaje(detalle.utilizacion_pct)}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(detalle.utilizacion_pct, 100)}%`,
                    background: COLOR_TIPO[detalle.tipo],
                  }}
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Productos</p>
              <div className="flex flex-wrap gap-1">
                {detalle.productos.map((p) => (
                  <span key={p} className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                    {p.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Volumen — últimos 12 meses</p>
              <div style={{ height: 60 }}>
                <ResponsiveContainer>
                  <LineChart data={sparkline}>
                    <Line type="monotone" dataKey="v" stroke={COLOR_TIPO[detalle.tipo]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {detalle.estaciones.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Estaciones del sistema ({detalle.estaciones.length})</p>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {detalle.estaciones.map((e) => (
                    <li key={e.id} className="flex justify-between text-xs text-slate-600">
                      <span>{e.nombre}</span>
                      <span className="font-semibold">{e.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => navigate('/proyecciones')}
                className="flex-1 text-xs font-semibold bg-acento text-white rounded-lg py-2 hover:opacity-90"
              >
                Proyecciones
              </button>
              <button
                onClick={() => navigate('/simulador')}
                className="flex-1 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg py-2 hover:bg-slate-50"
              >
                Simular expansión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="font-medium text-slate-700 text-sm">{value}</p>
    </div>
  );
}
