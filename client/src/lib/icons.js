import L from 'leaflet';
import { COLOR_TIPO } from './format.js';

const SIMBOLO_ESTACION = { compresion: '▲', bombeo: '●', poliducto: '■' };

export function iconoEstacion(tipoEstacion, colorSistema) {
  const simbolo = SIMBOLO_ESTACION[tipoEstacion] || '●';
  return L.divIcon({
    className: '',
    html: `<div style="color:${colorSistema};font-size:14px;line-height:14px;text-shadow:0 0 2px white, 0 0 2px white">${simbolo}</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const HALO_CATEGORIA = {
  descubrimiento: '#16a34a',
  desarrollo: '#16a34a',
  perforacion: '#2563eb',
  programado: '#64748b',
  estratigrafico: '#64748b',
  negativo: '#dc2626',
};

export function iconoPozo(categoria, prioridad = 2) {
  const color = HALO_CATEGORIA[categoria] || '#64748b';
  const size = 10 + (3 - prioridad) * 2;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:0.85;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function colorUtilizacion(pct) {
  if (pct < 60) return '#16a34a';
  if (pct <= 85) return '#eab308';
  return '#dc2626';
}

export { COLOR_TIPO };
