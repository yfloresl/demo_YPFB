import { Marker } from 'react-leaflet';
import L from 'leaflet';
import { puntosFlecha } from '../lib/geo.js';

// Triángulos SVG calculados a mano en puntos intermedios de la polilínea,
// sin usar leaflet-polylinedecorator.
export default function FlowArrows({ coords, color, cantidad = 2 }) {
  const puntos = puntosFlecha(coords, cantidad);
  return (
    <>
      {puntos.map((p, i) => {
        const icon = L.divIcon({
          className: '',
          html: `<svg width="14" height="14" viewBox="0 0 14 14" style="transform:rotate(${p.angulo}deg)">
            <polygon points="7,0 14,14 0,14" fill="${color}" stroke="white" stroke-width="1"/>
          </svg>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        return <Marker key={i} position={p.pos} icon={icon} interactive={false} />;
      })}
    </>
  );
}
