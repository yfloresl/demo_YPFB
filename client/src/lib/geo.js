/** Utilidades geométricas para el mapa (proyección simple lat/lng -> pixeles vía Leaflet). */

// Genera puntos intermedios a lo largo de una polilínea de coords [lat,lng]
// junto con el ángulo de dirección en ese punto (para dibujar flechas de flujo).
export function puntosFlecha(coords, cantidad = 3) {
  if (!coords || coords.length < 2) return [];
  // longitud acumulada
  const segmentos = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lat1, lng1] = coords[i - 1];
    const [lat2, lng2] = coords[i];
    const d = Math.hypot(lat2 - lat1, lng2 - lng1);
    segmentos.push({ a: coords[i - 1], b: coords[i], d });
    total += d;
  }
  const puntos = [];
  for (let k = 1; k <= cantidad; k++) {
    const objetivo = (total * k) / (cantidad + 1);
    let acumulado = 0;
    for (const seg of segmentos) {
      if (acumulado + seg.d >= objetivo || seg === segmentos[segmentos.length - 1]) {
        const t = seg.d === 0 ? 0 : (objetivo - acumulado) / seg.d;
        const lat = seg.a[0] + (seg.b[0] - seg.a[0]) * t;
        const lng = seg.a[1] + (seg.b[1] - seg.a[1]) * t;
        const anguloRad = Math.atan2(seg.b[1] - seg.a[1], seg.b[0] - seg.a[0]);
        const anguloDeg = (anguloRad * 180) / Math.PI;
        puntos.push({ pos: [lat, lng], angulo: 90 - anguloDeg });
        break;
      }
      acumulado += seg.d;
    }
  }
  return puntos;
}
