import { Router } from 'express';
import { sistemas } from '../services/datos.js';
import { estacionesConScore, seriesPorSistema } from '../services/estado.js';
import { parametros_globales } from '../services/datos.js';

const router = Router();

router.get('/resumen', (req, res) => {
  const km = sistemas.reduce(
    (acc, s) => {
      acc.total += s.longitud_km;
      if (s.tipo === 'gasoducto') acc.gas += s.longitud_km;
      if (s.tipo === 'oleoducto') acc.oleo += s.longitud_km;
      if (s.tipo === 'poliducto') acc.poli += s.longitud_km;
      return acc;
    },
    { total: 0, gas: 0, oleo: 0, poli: 0 }
  );
  Object.keys(km).forEach((k) => (km[k] = Number(km[k].toFixed(1))));

  const estacionesCont = estacionesConScore.reduce(
    (acc, e) => {
      acc[e.tipo] = (acc[e.tipo] || 0) + 1;
      return acc;
    },
    { compresion: 0, bombeo: 0, poliducto: 0 }
  );
  const potencia_hp = estacionesConScore.filter((e) => e.tipo === 'compresion').reduce((a, e) => a + e.potencia_hp, 0);

  let sumaUtil = 0, ingresosMensuales = 0, volumenUltimoMes = 0;
  for (const s of sistemas) {
    const serie = seriesPorSistema.get(s.id);
    const ultimo = serie[serie.length - 1];
    sumaUtil += ultimo.utilizacion_pct;
    ingresosMensuales += ultimo.ingresos_usd;
    volumenUltimoMes += ultimo.volumen;
  }

  res.json({
    km,
    ductos: sistemas.length,
    estaciones: estacionesCont,
    potencia_hp,
    utilizacion_promedio_pct: Number((sumaUtil / sistemas.length).toFixed(1)),
    ingresos_anualizados_usd_mm: Number(((ingresosMensuales * 12) / 1e6).toFixed(1)),
    volumen_ultimo_mes: Number(volumenUltimoMes.toFixed(1)),
    parametros_globales,
  });
});

export default router;
