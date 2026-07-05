/**
 * Estado derivado calculado una sola vez al arranque del servidor:
 * series históricas, proyecciones, scores de estaciones y ranking de pozos.
 * Todo en memoria (sin base de datos), determinístico.
 */
import { sistemas, estaciones, pesos_score, pozos, parametros_globales } from './datos.js';
import {
  serieHistoricaSistema,
  proyeccionSistema,
  subScoresDeterministicos,
  scoreEstacion,
  recomendacionScore,
  rankearPozos,
  capacidadGasWeymouth,
  capacidadLiquidosHazenWilliams,
  normalizarProducto,
} from './engine.js';

const tarifas = parametros_globales.tarifas_referencia;

// --- series históricas + proyecciones por sistema ---
export const seriesPorSistema = new Map();
export const proyeccionesPorSistema = new Map();
export const capacidadTeoricaPorSistema = new Map();

for (const s of sistemas) {
  const serie = serieHistoricaSistema(s, tarifas);
  seriesPorSistema.set(s.id, serie);
  const ultimaUtil = serie[serie.length - 1].utilizacion_pct;
  proyeccionesPorSistema.set(s.id, proyeccionSistema(s, tarifas, ultimaUtil));

  if (s.tipo === 'gasoducto') {
    capacidadTeoricaPorSistema.set(s.id, capacidadGasWeymouth(s.diametro_pulg, s.longitud_km));
  } else {
    const producto = normalizarProducto(s.productos[0] || 'crudo');
    capacidadTeoricaPorSistema.set(s.id, capacidadLiquidosHazenWilliams(s.diametro_pulg, producto));
  }
}

// --- scoring de estaciones (12 curadas con score final directo + 43 determinísticas) ---
export const estacionesConScore = estaciones.map((e) => {
  const serie = seriesPorSistema.get(e.sistema_id);
  const utilUltima = e._curado ? e._curado.utilizacion_pct : serie ? serie[serie.length - 1].utilizacion_pct : 50;
  // Los 5 sub-scores siempre se generan determinísticamente (se usan para el
  // radar de la ficha de estación); para las 12 curadas el score FINAL se
  // reemplaza por el valor curado de estaciones.json (fuente de verdad),
  // no por la combinación ponderada de los sub-scores generados.
  const { sub_scores, score: scoreGenerado } = subScoresDeterministicos(e.id, utilUltima, pesos_score);
  const score = e._curado ? e._curado.score : scoreGenerado;
  const recomendacion = e._curado ? e._curado.recomendacion : recomendacionScore(score);
  const { _curado, ...resto } = e;
  return { ...resto, utilizacion_pct: utilUltima, sub_scores, score, recomendacion };
});

export const estacionesPorId = new Map(estacionesConScore.map((e) => [e.id, e]));

// --- ranking de pozos ---
export const pozosRankeados = rankearPozos(pozos, tarifas);
export const pozosPorId = new Map(pozosRankeados.map((p) => [p.id, p]));

export function utilizacionUltimoMes(sistemaId) {
  const serie = seriesPorSistema.get(sistemaId);
  return serie[serie.length - 1].utilizacion_pct;
}
