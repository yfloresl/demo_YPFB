/**
 * Cargador y normalizador de los datos REALES de la red de transporte de
 * YPFB Transporte (server/data/{sistemas,estaciones,pozos,proyectos_inversion}.json).
 *
 * Estos archivos son un inventario referencial compilado de fuentes públicas
 * (YPFB Transporte, ANH, GTB/Transierra, prensa especializada 2024-2026) —
 * ver el campo `_nota` de cada JSON para la atribución exacta. YA NO son
 * datos generados/simulados por `server/scripts/generar_datos.js` (ese
 * script queda solo como referencia histórica, ver su cabecera).
 *
 * Este módulo NO reescribe los JSON fuente: los lee tal cual y expone
 * estructuras normalizadas con los NOMBRES DE CAMPO que el resto del
 * backend (engine.js, estado.js, routes/*.js) ya esperaba, para minimizar
 * el impacto en el resto del código y en el frontend (mismos contratos de API).
 *
 * Decisiones de mapeo (ver también README.md § Supuestos):
 * - `diametro_pulg`: los ductos reales traen un ARRAY de uno o más diámetros
 *   (tramos con reducciones). Se usa el MAYOR como diámetro representativo
 *   para los cálculos de capacidad y para el grosor de línea en el mapa.
 * - `mercado`: el string libre real ("Interno Occidente", "Exportación / SIT", etc.)
 *   se clasifica en 'exportacion' | 'interno' por substring ("Exportación").
 *   El texto original se conserva en `mercado_detalle`.
 * - Gas en tránsito SIT (GSCY, GASYRG, GTB): además de la tarifa de
 *   exportación, se marcan con `transito_sit:true` para la lógica especial
 *   de rampa/consolidación de las secciones 4.8/4.9 del motor.
 * - `capacidad`/`unidad` se aplanan desde `capacidad:{valor,unidad,nota}` a
 *   `capacidad` (número) + `unidad` (string); "MMm3d" se normaliza a "MMm3/d".
 * - Estaciones: `sistema` puede traer varios códigos separados por "/"
 *   (ej. "GCY/GCC"); se usa el primero como `sistema_id` principal.
 * - Pozos: `capex_interconexion_usd_mm` -> `capex_interconexion_mm_usd`,
 *   `distancia_red_km` -> `distancia_km_red`, `tipo_hc` -> `tipo_hidrocarburo`,
 *   para conservar los nombres que el resto del backend/frontend ya usaba.
 *   Los 3 pozos con `capex_interconexion_usd_mm===0` (ya conectados: PZ38,
 *   PZ39, PZ40) se marcan `ya_conectado:true` y no se rankean numéricamente.
 * - `corredor` de cada pozo se normaliza al NOMBRE del corredor (no al id)
 *   para poder filtrar/cruzar directamente con `corredores[].nombre` en el
 *   frontend (PozosPage ya comparaba por nombre).
 * - Proyectos de inversión: `escenarios_roi` (array real) se convierte a un
 *   objeto indexado por escenario `{base,conservador,optimista}` con
 *   `van_mm_usd`/`tir_pct`/`payback_anios`, y `capex_total_usd_mm` ->
 *   `capex_total_mm_usd`. Proyectos sin `fases` (INV-SIT, INV-REVERSA-OSSA2,
 *   INV-PCS-AMPL, INV-INTERCONEXION-PRU) reciben una fase sintética única en
 *   año 0 con el CAPEX total, para que el frontend (que siempre itera
 *   `detalle.fases`) no requiera cambios. INV-MAYAYA: sus fases 1/2/3 se
 *   mapean a años 0/1/2 (rampa de obra civil, ver spec).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function cargar(nombre) {
  return JSON.parse(readFileSync(join(DATA_DIR, nombre), 'utf-8'));
}

// IDs de gasoductos que llevan gas en tránsito del Sistema Integrado de
// Transporte (Argentina -> Brasil, DS 5206/2024), ver spec 4.8/4.9.
export const IDS_TRANSITO_SIT = ['GSCY', 'GASYRG', 'GTB'];
export const ID_GAA = 'GAA';

// ---------------------------------------------------------------------
// sistemas.json (32 ductos reales)
// ---------------------------------------------------------------------
const sistemasRaw = cargar('sistemas.json');
export const resumenRedFuente = sistemasRaw.resumen_red;

function clasificarMercado(mercado) {
  return /exportaci[oó]n/i.test(mercado || '') ? 'exportacion' : 'interno';
}

function normalizarUnidad(unidad) {
  if (unidad === 'MMm3d') return 'MMm3/d';
  return unidad;
}

export const sistemas = sistemasRaw.ductos.map((d) => {
  const diametros = Array.isArray(d.diametro_pulg) ? d.diametro_pulg : [d.diametro_pulg];
  const diametro_pulg = Math.max(...diametros.filter((n) => Number.isFinite(n)));
  return {
    id: d.id,
    codigo: d.id,
    nombre: d.nombre,
    tipo: d.tipo,
    mercado: clasificarMercado(d.mercado),
    mercado_detalle: d.mercado,
    transito_sit: IDS_TRANSITO_SIT.includes(d.id),
    operador: d.operador,
    tramo: d.tramo,
    longitud_km: d.longitud_km,
    diametro_pulg,
    diametros_pulg: diametros,
    capacidad: d.capacidad.valor,
    unidad: normalizarUnidad(d.capacidad.unidad),
    capacidad_nota: d.capacidad.nota,
    productos: d.productos,
    anio: d.anio_inicio,
    estado: d.estado,
    coords: d.coords,
  };
});

export function sistemaPorId(id) {
  return sistemas.find((s) => s.id === id);
}

// ---------------------------------------------------------------------
// estaciones.json (55 sitios operativos, 12 con score curado)
// ---------------------------------------------------------------------
const estacionesRaw = cargar('estaciones.json');

// Pesos reales del scoring (ver estaciones.json.criterios_scoring.pesos),
// reemplazan los pesos inventados de la versión generada.
export const pesos_score = estacionesRaw.criterios_scoring.pesos;

const scoresCuradosPorId = new Map(estacionesRaw.scores_curados.map((s) => [s.id, s]));

export const estaciones = estacionesRaw.estaciones.map((e) => {
  const sistema_id = (e.sistema || '').split('/')[0].trim();
  const curado = scoresCuradosPorId.get(e.id);
  return {
    id: e.id,
    nombre: e.nombre,
    tipo: e.tipo,
    sistema_id,
    sistema_detalle: e.sistema,
    depto: e.depto,
    coords: e.coords,
    potencia_hp: e.potencia_hp,
    capacidad_bpd: e.capacidad_bpd,
    anio: e.anio,
    fuente: e.fuente,
    nota: e.nota,
    score_curado: Boolean(curado),
    _curado: curado || null,
  };
});

export function estacionPorId(id) {
  return estaciones.find((e) => e.id === id);
}

// ---------------------------------------------------------------------
// pozos.json (40 pozos, 4 corredores)
// ---------------------------------------------------------------------
const pozosRaw = cargar('pozos.json');

const corredorPorId = new Map(pozosRaw.corredores.map((c) => [c.id, c]));

export const pozos = pozosRaw.pozos.map((p) => {
  const capex = p.capex_interconexion_usd_mm ?? 0;
  const corredorObj = corredorPorId.get(p.corredor);
  return {
    id: p.id,
    nombre: p.nombre,
    operador: p.operador,
    depto: p.depto,
    zona: p.zona,
    categoria: p.categoria,
    tipo_hidrocarburo: p.tipo_hc,
    potencial: p.potencial,
    produccion_potencial: {
      gas_mmpcd: p.produccion_potencial?.gas_mmpcd ?? 0,
      liquidos_bpd: p.produccion_potencial?.liquidos_bpd ?? 0,
    },
    coords: p.coords,
    corredor: corredorObj ? corredorObj.nombre : p.corredor,
    corredor_id: p.corredor,
    distancia_km_red: p.distancia_red_km,
    diametro_sugerido_pulg: p.diametro_sugerido_pulg,
    terreno: p.terreno,
    capex_interconexion_mm_usd: capex,
    ya_conectado: capex <= 0,
    prioridad: p.prioridad,
    nota: p.nota,
  };
});

export const corredores = pozosRaw.corredores.map((c) => {
  const deptos = [...new Set(pozos.filter((p) => c.pozos.includes(p.id)).map((p) => p.depto).filter(Boolean))];
  return {
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    empalme: c.empalme,
    longitud_troncal_km: c.longitud_troncal_km,
    diametro_troncal_pulg: c.diametro_troncal_pulg,
    capex_troncal_usd_mm: c.capex_troncal_usd_mm,
    deptos,
    pozos_ids: c.pozos,
    coords: c.coords,
  };
});

export function pozoPorId(id) {
  return pozos.find((p) => p.id === id);
}

// ---------------------------------------------------------------------
// proyectos_inversion.json (parámetros financieros globales + 5 macroproyectos)
// ---------------------------------------------------------------------
const proyectosRaw = cargar('proyectos_inversion.json');
const pf = proyectosRaw.parametros_financieros;

export const parametros_globales = {
  tasa_pct: pf.tasa_descuento_pct,
  vida_anios: pf.vida_util_anios,
  opex_pct_capex: pf.opex_anual_pct_capex,
  capex_unitario_por_pulgada_km: pf.capex_usd_por_pulgada_km,
  factor_ruta: pf.factor_ruta,
  tarifas_referencia: {
    gas_interno: pf.tarifas_referencia.gas_mercado_interno_usd_mpc,
    gas_exportacion: pf.tarifas_referencia.gas_exportacion_usd_mpc,
    gas_transito_sit: pf.tarifas_referencia.gas_transito_sit_usd_mpc,
    crudo: pf.tarifas_referencia.liquidos_usd_bbl,
    // No hay tarifa GLP separada en el dataset real: se usa la de líquidos
    // (ver README § Supuestos).
    glp: pf.tarifas_referencia.liquidos_usd_bbl,
    refinados: pf.tarifas_referencia.refinados_poliducto_usd_bbl,
  },
  nota_tarifas: pf.nota_tarifas,
};

function volumenDiseno(p) {
  const v = p.volumen_diseno || {};
  if (v.gas_mmm3d != null) return { valor: v.gas_mmm3d, unidad: 'MMm3/d' };
  if (v.gas_mmpcd_incorporado != null) return { valor: v.gas_mmpcd_incorporado, unidad: 'MMpcd' };
  if (v.liquidos_bpd_incorporado != null) return { valor: v.liquidos_bpd_incorporado, unidad: 'BPD' };
  if (v.liquidos_bpd != null) return { valor: v.liquidos_bpd, unidad: 'BPD' };
  return { valor: 0, unidad: 'BPD' };
}

function tarifaProyecto(p) {
  const tarifas = parametros_globales.tarifas_referencia;
  const esTransito = /tr[aá]nsito/i.test(p.tipo || '') || p.id === 'INV-SIT';
  if (esTransito) return tarifas.gas_transito_sit;
  const vol = volumenDiseno(p);
  if (vol.unidad !== 'BPD') return tarifas.gas_interno;
  if (/poliducto/i.test(p.tipo || '')) return tarifas.refinados;
  return tarifas.crudo;
}

function normalizarFases(p) {
  if (Array.isArray(p.fases) && p.fases.length) {
    return p.fases.map((f) => ({
      anio: f.fase - 1,
      fase: f.fase,
      tramo: f.tramo,
      longitud_km: f.longitud_km,
      diametro_pulg: f.diametro_pulg,
      terreno: f.terreno,
      capex_mm_usd: f.capex_usd_mm,
    }));
  }
  // Proyectos sin desglose de fases: una única fase sintética en año 0 con
  // el CAPEX total, para que el frontend (que siempre itera detalle.fases)
  // no necesite cambios.
  return [{ anio: 0, fase: 1, tramo: p.nombre, capex_mm_usd: p.capex_total_usd_mm }];
}

function normalizarEscenariosRoi(p) {
  const out = {};
  for (const e of p.escenarios_roi || []) {
    out[e.escenario] = {
      utilizacion_pct: e.utilizacion_pct ?? null,
      van_mm_usd: e.van_usd_mm,
      tir_pct: e.tir_pct,
      payback_anios: e.payback_anios,
    };
  }
  return out;
}

export const proyectos = proyectosRaw.proyectos.map((p) => ({
  id: p.id,
  nombre: p.nombre,
  tipo: p.tipo,
  corredor: p.corredor,
  estado: p.estado,
  descripcion: p.justificacion,
  fases: normalizarFases(p),
  capex_total_mm_usd: p.capex_total_usd_mm,
  volumen_diseno: p.volumen_diseno,
  volumen_diseno_normalizado: volumenDiseno(p),
  tarifa_usd_estimada: tarifaProyecto(p),
  coords: p.coords,
  escenarios_roi: normalizarEscenariosRoi(p),
}));

export function proyectoPorId(id) {
  return proyectos.find((p) => p.id === id);
}
