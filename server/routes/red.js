import { Router } from 'express';
import { sistemas, resumenRedFuente } from '../services/datos.js';
import { estacionesConScore, seriesPorSistema } from '../services/estado.js';
import { parametros_globales } from '../services/datos.js';

const router = Router();

router.get('/resumen', (req, res) => {
  // Km de red: se reportan los totales OFICIALES de sistemas.json.resumen_red
  // (incluye ramales/tramos menores no desglosados como sistema individual),
  // no la suma de longitud_km de los 32 ductos itemizados (que da ~7.325 km:
  // ver README § Supuestos sobre esta diferencia conocida del dataset real).
  const km = {
    total: resumenRedFuente.total_km,
    gas: resumenRedFuente.gasoductos_km,
    oleo: resumenRedFuente.oleoductos_km,
    poli: resumenRedFuente.poliductos_km,
  };
  const km_itemizado = sistemas.reduce(
    (acc, s) => {
      acc.total += s.longitud_km;
      if (s.tipo === 'gasoducto') acc.gas += s.longitud_km;
      if (s.tipo === 'oleoducto') acc.oleo += s.longitud_km;
      if (s.tipo === 'poliducto') acc.poli += s.longitud_km;
      return acc;
    },
    { total: 0, gas: 0, oleo: 0, poli: 0 }
  );
  Object.keys(km_itemizado).forEach((k) => (km_itemizado[k] = Number(km_itemizado[k].toFixed(1))));

  const estacionesCont = estacionesConScore.reduce(
    (acc, e) => {
      acc[e.tipo] = (acc[e.tipo] || 0) + 1;
      return acc;
    },
    { compresion: 0, bombeo: 0, poliducto: 0 }
  );
  // Potencia instalada: se reporta el total oficial de resumen_red; el
  // computado a partir de las 17 estaciones de compresión itemizadas difiere
  // levemente (dataset real, ver README § Supuestos).
  const potencia_hp = resumenRedFuente.potencia_instalada_hp;
  const potencia_hp_itemizado = estacionesConScore.filter((e) => e.tipo === 'compresion').reduce((a, e) => a + (e.potencia_hp || 0), 0);

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
    km_itemizado,
    ductos: sistemas.length,
    estaciones: estacionesCont,
    potencia_hp,
    potencia_hp_itemizado,
    utilizacion_promedio_pct: Number((sumaUtil / sistemas.length).toFixed(1)),
    ingresos_anualizados_usd_mm: Number(((ingresosMensuales * 12) / 1e6).toFixed(1)),
    volumen_ultimo_mes: Number(volumenUltimoMes.toFixed(1)),
    parametros_globales,
  });
});

export default router;
