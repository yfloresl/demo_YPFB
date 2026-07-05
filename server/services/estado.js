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
    const producto = s.productos[0] || 'crudo';
    capacidadTeoricaPorSistema.set(s.id, capacidadLiquidosHazenWilliams(s.diametro_pulg, producto));
  }
}

// --- scoring de estaciones (12 curadas + resto determinístico) ---
export const estacionesConScore = estaciones.map((e) => {
  if (e.score_curado) return e;
  const serie = seriesPorSistema.get(e.sistema_id);
  const utilUltima = serie ? serie[serie.length - 1].utilizacion_pct : 50;
  const { sub_scores, score } = subScoresDeterministicos(e.id, utilUltima, pesos_score);
  return { ...e, sub_scores, score };
}).map((e) => ({ ...e, recomendacion: recomendacionScore(e.score) }));

export const estacionesPorId = new Map(estacionesConScore.map((e) => [e.id, e]));

// --- ranking de pozos ---
export const pozosRankeados = rankearPozos(pozos, tarifas);
export const pozosPorId = new Map(pozosRankeados.map((p) => [p.id, p]));

export function utilizacionUltimoMes(sistemaId) {
  const serie = seriesPorSistema.get(sistemaId);
  return serie[serie.length - 1].utilizacion_pct;
}
