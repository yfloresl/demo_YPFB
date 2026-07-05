/**
 * Motor de cálculo hidráulico, de capacidad y financiero — DuctoVision Bolivia.
 * Todas las funciones son puras (sin efectos secundarios) y están documentadas
 * con las fórmulas exactas de la especificación del proyecto.
 *
 * Los resultados son simulaciones de referencia; no sustituyen estudios de
 * ingeniería reales.
 */
import { mulberry32 } from './prng.js';
import { ID_GAA } from './datos.js';

// ---------------------------------------------------------------------
// 4.1 Capacidad de gasoducto — Weymouth simplificado
// ---------------------------------------------------------------------
/**
 * Q = 433.5 * (Tb/Pb) * d^(8/3) * sqrt((P1^2 - P2^2) / (G * Tf * L * Z)) * E
 * @param {number} diametro_pulg diámetro nominal en pulgadas
 * @param {number} longitud_km longitud del tramo en km
 * @param {object} [opts]
 * @returns {{ mmpcd:number, mmm3d:number, supuestos:object }}
 */
export function capacidadGasWeymouth(diametro_pulg, longitud_km, opts = {}) {
  const Tb = 520; // °R
  const Pb = 14.7; // psia
  const P1 = opts.p1_psia ?? 1200;
  const P2 = opts.p2_psia ?? 600;
  const G = 0.65;
  const Tf = 530; // °R
  const Z = 0.88;
  const E = opts.eficiencia ?? 0.92;
  const d = Math.max(diametro_pulg - 0.5, 0.1); // diámetro interno aproximado
  const L = longitud_km * 0.621371; // millas

  const Q_pcd =
    433.5 * (Tb / Pb) * Math.pow(d, 8 / 3) * Math.sqrt(Math.max(P1 ** 2 - P2 ** 2, 0) / (G * Tf * L * Z)) * E;

  const mmpcd = Q_pcd / 1e6;
  const mmm3d = mmpcd / 35.3147; // 1 m3 = 35.3147 pc

  return {
    mmpcd: Number(mmpcd.toFixed(2)),
    mmm3d: Number(mmm3d.toFixed(3)),
    supuestos: { Tb, Pb, P1, P2, G, Tf, Z, E, diametro_interno_pulg: d, longitud_millas: Number(L.toFixed(2)) },
  };
}

// ---------------------------------------------------------------------
// 4.2 Capacidad de líquidos — Hazen-Williams con corrección por viscosidad
// ---------------------------------------------------------------------
const FACTORES_VISCOSIDAD = {
  crudo: 0.85,
  reconstituido: 0.75,
  refinados: 0.95,
  glp: 1.0,
  gasolina: 0.95,
  diesel_oil: 0.9,
  jet_fuel: 0.95,
};

/**
 * Los productos reales vienen como texto libre en español (p.ej. "crudo
 * reconstituido", "combustibles importados (reversa)", "diésel", "jet fuel",
 * "GLP", "propano", "condensado"). Se normaliza por coincidencia de
 * substring a una de las claves de FACTORES_VISCOSIDAD, con 'crudo' como
 * valor por defecto razonable para líquidos no reconocidos.
 */
export function normalizarProducto(productoLibre = '') {
  const t = productoLibre.toLowerCase();
  if (t.includes('reconstituid')) return 'reconstituido';
  if (t.includes('glp') || t.includes('propano')) return 'glp';
  if (t.includes('jet')) return 'jet_fuel';
  if (t.includes('diesel') || t.includes('diésel')) return 'diesel_oil';
  if (t.includes('gasolina')) return 'gasolina';
  if (t.includes('kerosene') || t.includes('refinad')) return 'refinados';
  return 'crudo';
}

export function contieneGlp(productos = []) {
  return productos.some((p) => normalizarProducto(p) === 'glp');
}

/**
 * Q_bpd = 0.148 * C * d^2.63 * (dP_psi_milla)^0.54 * f_visc(producto)
 * @param {string} producto clave de FACTORES_VISCOSIDAD o texto libre (se normaliza)
 */
export function capacidadLiquidosHazenWilliams(diametro_pulg, producto = 'crudo', opts = {}) {
  const C = 120;
  const dP = opts.dp_psi_milla ?? 25;
  const d = Math.max(diametro_pulg - 0.5, 0.1);
  const Q_base = 0.148 * C * Math.pow(d, 2.63) * Math.pow(dP, 0.54);
  const productoClave = FACTORES_VISCOSIDAD[producto] != null ? producto : normalizarProducto(producto);
  const f_visc = FACTORES_VISCOSIDAD[productoClave] ?? 0.85;
  const Q_bpd = Q_base * f_visc;
  return {
    bpd: Number(Q_bpd.toFixed(0)),
    supuestos: { C, dp_psi_milla: dP, diametro_interno_pulg: d, f_visc, producto: productoClave },
  };
}

// ---------------------------------------------------------------------
// 4.3 CAPEX de ducto nuevo
// ---------------------------------------------------------------------
// Costo unitario real por pulgada-km (proyectos_inversion.json.parametros_financieros.capex_usd_por_pulgada_km)
const COSTO_UNITARIO_TERRENO = { llano: 45000, pie_de_monte: 62000, montana_selva: 85000 };

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * CAPEX = diametro_pulg * longitud_km * costo_unitario(terreno) * factor_ruta
 * factor_ruta = 1.25 si la longitud proviene de Haversine (estimada), 1.0 si es longitud real dada por el usuario.
 */
export function capexDuctoNuevo(diametro_pulg, longitud_km, terreno = 'llano', { esHaversine = true } = {}) {
  const costoUnitario = COSTO_UNITARIO_TERRENO[terreno] ?? COSTO_UNITARIO_TERRENO.llano;
  const factor_ruta = esHaversine ? 1.25 : 1.0;
  const capex_usd = diametro_pulg * longitud_km * costoUnitario * factor_ruta;
  return {
    capex_usd: Number(capex_usd.toFixed(0)),
    capex_mm_usd: Number((capex_usd / 1e6).toFixed(2)),
    supuestos: { costoUnitario, factor_ruta, terreno },
  };
}

// ---------------------------------------------------------------------
// 4.4 Financiero: VAN, TIR, payback, LCOT
// ---------------------------------------------------------------------
/** Convierte volumen de diseño + utilización a volumen anual, según unidad */
export function volumenAnual(valor, unidad, utilizacion_pct) {
  const util = utilizacion_pct / 100;
  switch (unidad) {
    case 'MMpcd': // MMpcd -> MPC/año: *365*1000
      return valor * util * 365 * 1000;
    case 'MMm3/d': // MM m3/d -> MPC/año: (valor*1e6 m3/d * 35.3147 cf/m3 / 1000 cf/MPC) * 365 = valor*365*35.3147*1000
      return valor * util * 365 * 35.3147 * 1000;
    case 'BPD': // BPD -> bbl/año
      return valor * util * 365;
    default:
      throw new Error(`Unidad no soportada: ${unidad}`);
  }
}

export function irr(cashflows, lo = -0.5, hi = 1.0, tol = 1e-6, maxIter = 200) {
  const npvAt = (r) => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
  let a = lo, b = hi;
  let fa = npvAt(a), fb = npvAt(b);
  if (fa * fb > 0) {
    // no hay cambio de signo en el rango: intentar ampliar levemente o devolver null
    return null;
  }
  for (let i = 0; i < maxIter; i++) {
    const m = (a + b) / 2;
    const fm = npvAt(m);
    if (Math.abs(fm) < tol) return m;
    if (fa * fm < 0) { b = m; fb = fm; } else { a = m; fa = fm; }
  }
  return (a + b) / 2;
}

export function npv(rate, cashflows) {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

/**
 * Evaluación financiera completa de un proyecto de transporte.
 * @param {object} p
 * @param {number} p.capex_usd - CAPEX total (se aplica en año 0 si no hay fases)
 * @param {Array<{anio:number, capex_mm_usd:number}>} [p.fases] - CAPEX por fases (años 0..n)
 * @param {number} p.volumen_valor - volumen de diseño
 * @param {string} p.volumen_unidad - MMpcd | MMm3/d | BPD
 * @param {number} p.utilizacion_pct
 * @param {number} p.tarifa_usd - USD por MPC (gas) o USD por bbl (líquidos)
 * @param {number} [p.tasa_pct=10]
 * @param {number} [p.horizonte=25]
 * @param {number} [p.opex_pct_capex=3.5]
 */
export function evaluarFinanciero(p) {
  const tasa = (p.tasa_pct ?? 10) / 100;
  const horizonte = p.horizonte ?? 25;
  const opexPct = (p.opex_pct_capex ?? 3.5) / 100;

  const capexTotal = p.capex_usd ?? (p.fases || []).reduce((a, f) => a + f.capex_mm_usd * 1e6, 0);
  const opexAnual = capexTotal * opexPct;

  const volAnual = volumenAnual(p.volumen_valor, p.volumen_unidad, p.utilizacion_pct);
  const ingresoAnual = volAnual * p.tarifa_usd;

  const flujo = [];
  if (p.fases && p.fases.length) {
    const maxFaseAnio = Math.max(...p.fases.map((f) => f.anio));
    for (let t = 0; t <= horizonte; t++) {
      const fase = p.fases.find((f) => f.anio === t);
      const capex = fase ? -fase.capex_mm_usd * 1e6 : 0;
      const opera = t > maxFaseAnio ? ingresoAnual - opexAnual : 0;
      flujo.push(capex + opera);
    }
  } else {
    flujo.push(-capexTotal);
    for (let t = 1; t <= horizonte; t++) flujo.push(ingresoAnual - opexAnual);
  }

  const van = npv(tasa, flujo);
  const tir = irr(flujo);

  let acumSimple = 0, payback = null;
  for (let t = 0; t < flujo.length; t++) {
    acumSimple += flujo[t];
    if (acumSimple >= 0 && payback === null) payback = t;
  }
  let acumDesc = 0, paybackDesc = null;
  for (let t = 0; t < flujo.length; t++) {
    acumDesc += flujo[t] / Math.pow(1 + tasa, t);
    if (acumDesc >= 0 && paybackDesc === null) paybackDesc = t;
  }

  // LCOT = (CAPEX anualizado + OPEX) / volumen anual
  const factorAnualidad = tasa === 0 ? horizonte : (tasa * Math.pow(1 + tasa, horizonte)) / (Math.pow(1 + tasa, horizonte) - 1);
  const capexAnualizado = capexTotal * factorAnualidad;
  const lcot = volAnual > 0 ? (capexAnualizado + opexAnual) / volAnual : null;

  return {
    van_usd: Number(van.toFixed(0)),
    van_mm_usd: Number((van / 1e6).toFixed(2)),
    tir_pct: tir !== null ? Number((tir * 100).toFixed(2)) : null,
    payback_anios: payback,
    payback_descontado_anios: paybackDesc,
    lcot_usd: lcot !== null ? Number(lcot.toFixed(3)) : null,
    flujo: flujo.map((v) => Number(v.toFixed(0))),
    ingreso_anual_usd: Number(ingresoAnual.toFixed(0)),
    opex_anual_usd: Number(opexAnual.toFixed(0)),
    capex_total_usd: Number(capexTotal.toFixed(0)),
  };
}

// ---------------------------------------------------------------------
// 4.5 Sensibilidad 5x5
// ---------------------------------------------------------------------
const DELTAS = [-20, -10, 0, 10, 20];

export function matrizSensibilidad(base) {
  const filas = DELTAS.map((dUtil) => {
    return DELTAS.map((dTarifa) => {
      const util = base.utilizacion_pct * (1 + dUtil / 100);
      const tarifa = base.tarifa_usd * (1 + dTarifa / 100);
      const r = evaluarFinanciero({ ...base, utilizacion_pct: util, tarifa_usd: tarifa });
      return r.tir_pct;
    });
  });
  return { deltas_utilizacion_pct: DELTAS, deltas_tarifa_pct: DELTAS, tir_pct: filas };
}

// ---------------------------------------------------------------------
// 4.6 Ranking de pozos
// ---------------------------------------------------------------------
const FACTOR_CATEGORIA = {
  descubrimiento: 1.0,
  desarrollo: 1.0,
  perforacion: 0.8,
  programado: 0.55,
  estratigrafico: 0.35,
  negativo: 0,
};

/**
 * Índice de priorización = (gas_mmpcd + liquidos_bpd/500) / capex_interconexion_mm_usd × factor_categoria.
 * Los pozos "ya conectados" (capex_interconexion_mm_usd === 0: PZ38 Margarita-Huacaya,
 * PZ39 Incahuasi, PZ40 Boyuy-X2) no se dividen por cero: se devuelve `null`
 * (no rankeable numéricamente) en vez de una utilidad infinita o forzada a 0.
 */
export function indicePozo(pozo) {
  if (pozo.ya_conectado || !(pozo.capex_interconexion_mm_usd > 0)) return null;
  const { gas_mmpcd, liquidos_bpd } = pozo.produccion_potencial;
  const factor = FACTOR_CATEGORIA[pozo.categoria] ?? 0;
  const numerador = gas_mmpcd + liquidos_bpd / 500;
  const indice = (numerador / pozo.capex_interconexion_mm_usd) * factor;
  return Number(indice.toFixed(3));
}

export function rankearPozos(pozos, tarifas) {
  return pozos
    .map((p) => {
      const indice = indicePozo(p);
      const equivalenteMmpcd = p.produccion_potencial.gas_mmpcd + p.produccion_potencial.liquidos_bpd / 500;
      const usd_mm_por_mmpcd =
        equivalenteMmpcd > 0 && p.capex_interconexion_mm_usd > 0
          ? Number((p.capex_interconexion_mm_usd / equivalenteMmpcd).toFixed(2))
          : null;
      let tir_pct = null;
      if (!p.ya_conectado && p.categoria !== 'negativo' && equivalenteMmpcd > 0 && p.capex_interconexion_mm_usd > 0) {
        const esGas = p.produccion_potencial.gas_mmpcd >= p.produccion_potencial.liquidos_bpd / 500;
        const fin = evaluarFinanciero({
          capex_usd: p.capex_interconexion_mm_usd * 1e6,
          volumen_valor: esGas ? p.produccion_potencial.gas_mmpcd : p.produccion_potencial.liquidos_bpd,
          volumen_unidad: esGas ? 'MMpcd' : 'BPD',
          utilizacion_pct: 85,
          tarifa_usd: esGas ? tarifas.gas_interno : tarifas.crudo,
          horizonte: 20,
        });
        tir_pct = fin.tir_pct;
      }
      return { ...p, indice, usd_mm_por_mmpcd, tir_pct };
    })
    .sort((a, b) => (b.indice ?? -Infinity) - (a.indice ?? -Infinity));
}

// ---------------------------------------------------------------------
// 4.7 Scoring de estaciones
// ---------------------------------------------------------------------
export function scoreEstacion(sub_scores, pesos) {
  const score = Object.keys(pesos).reduce((acc, k) => acc + (sub_scores[k] ?? 0) * pesos[k], 0);
  return Number(score.toFixed(1));
}

export function recomendacionScore(score) {
  if (score >= 70) return 'mantener';
  if (score >= 55) return 'optimizar';
  return 'evaluar_standby';
}

/**
 * Genera los 5 sub-scores reales (utilizacion, criticidad, costo_mantenimiento,
 * integridad, demanda_futura) determinísticamente en [30,95], correlacionados
 * con la utilización del ducto/sistema asociado a la estación (semilla fija
 * 20260704 vía mulberry32). Se usa para las 43 estaciones sin score curado
 * (y también para poblar el radar de las 12 curadas, ver estado.js).
 */
export function subScoresDeterministicos(estacionId, utilizacionPct, pesos) {
  const seedLocal = Array.from(estacionId).reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = mulberry32(seedLocal * 7919 + Math.round(utilizacionPct * 100));
  const base = 30 + (utilizacionPct / 100) * 55; // correlación con utilización
  const gen = () => Math.min(95, Math.max(30, Number((base + (rng() - 0.5) * 20).toFixed(1))));
  const sub_scores = {
    utilizacion: gen(),
    criticidad: gen(),
    costo_mantenimiento: gen(),
    integridad: gen(),
    demanda_futura: gen(),
  };
  return { sub_scores, score: scoreEstacion(sub_scores, pesos) };
}

// ---------------------------------------------------------------------
// 4.8 Series históricas 2018-01 -> 2025-12
// ---------------------------------------------------------------------
const UTIL_BASE = {
  gasoducto_exportacion: { base: 0.55, tendencia: -0.04 },
  gasoducto_interno: { base: 0.68, tendencia: 0.0 },
  oleoducto: { base: 0.52, tendencia: -0.03 },
  poliducto: { base: 0.84, tendencia: 0.02 },
};

function claveUtil(sistema) {
  if (sistema.tipo === 'gasoducto') return sistema.mercado === 'exportacion' ? 'gasoducto_exportacion' : 'gasoducto_interno';
  return sistema.tipo;
}

function estacionalidad(mes, sistema) {
  // mayo-agosto (5-8) +8% para gas interno
  if (claveUtil(sistema) === 'gasoducto_interno' && mes >= 5 && mes <= 8) return 1.08;
  return 1.0;
}

function tarifaSistema(sistema, tarifas) {
  if (sistema.tipo === 'gasoducto') {
    if (sistema.transito_sit) return tarifas.gas_transito_sit;
    return sistema.mercado === 'exportacion' ? tarifas.gas_exportacion : tarifas.gas_interno;
  }
  if (sistema.tipo === 'oleoducto') return contieneGlp(sistema.productos) ? tarifas.glp : tarifas.crudo;
  return tarifas.refinados;
}

function unidadVolumenSistema(sistema) {
  return sistema.unidad;
}

/**
 * Serie histórica mensual 2018-01 a 2025-12 para un sistema.
 * volumen = capacidad * utilizacion_base * (1+tendencia)^años * estacionalidad * (1+ruido)
 */
export function serieHistoricaSistema(sistema, tarifas) {
  const { base, tendencia } = UTIL_BASE[claveUtil(sistema)];
  const rng = mulberry32(sistema.id.split('-').reduce((a, c) => a + c.charCodeAt(0), 0) * 104729);
  const tarifa = tarifaSistema(sistema, tarifas);
  const serie = [];
  let año0 = 2018;
  for (let anio = 2018; anio <= 2025; anio++) {
    for (let mes = 1; mes <= 12; mes++) {
      const años = anio - año0 + (mes - 1) / 12;
      let util = base * Math.pow(1 + tendencia, años) * estacionalidad(mes, sistema);
      // Rampa de gas en tránsito SIT (GSCY/GASYRG/GTB) desde 2025-04, DS 5206/2024
      if (sistema.transito_sit && anio === 2025 && mes >= 4) {
        const mesesDesdeAbril = mes - 4;
        const rampaMmm3d = 1.5 + (4.5 - 1.5) * Math.min(mesesDesdeAbril / 6, 1);
        const capacidadMmm3d = sistema.unidad === 'MMpcd' ? sistema.capacidad / 35.3147 : sistema.capacidad;
        util = Math.max(util, rampaMmm3d / capacidadMmm3d);
      }
      const ruido = 1 + (rng() * 2 - 1) * 0.06;
      util = Math.min(Math.max(util, 0.05), 1.05);
      const volumen = sistema.capacidad * util * ruido;
      const ingresos = volumen * tarifa * factorMensualIngreso(sistema.unidad);
      serie.push({
        periodo: `${anio}-${String(mes).padStart(2, '0')}`,
        utilizacion_pct: Number((util * 100).toFixed(1)),
        volumen: Number(volumen.toFixed(2)),
        ingresos_usd: Number(ingresos.toFixed(0)),
      });
    }
  }
  return serie;
}

function factorMensualIngreso(unidad) {
  // aproximación mensual de los factores anuales de la sección 4.4 (÷12)
  if (unidad === 'MMpcd') return (365 * 1000) / 12;
  if (unidad === 'MMm3/d') return (365 * 35.3147 * 1000) / 12;
  return 365 / 12; // BPD -> bbl/mes aprox
}

// ---------------------------------------------------------------------
// 4.9 Proyecciones 2026-01 -> 2035-12, 3 escenarios
// ---------------------------------------------------------------------
export function proyeccionSistema(sistema, tarifas, ultimaUtilPct) {
  const { tendencia } = UTIL_BASE[claveUtil(sistema)];
  const rng = mulberry32(sistema.id.split('-').reduce((a, c) => a + c.charCodeAt(0), 0) * 65537 + 7);
  const tarifa = tarifaSistema(sistema, tarifas);
  // GAA: recibe la rampa del macroproyecto Mayaya (2 -> 10 MMm3/d en 3 años desde 2028).
  const esGAA = sistema.id === ID_GAA;
  // GSCY/GASYRG/GTB: gas en tránsito SIT, consolidación a 8 MMm3/d hacia 2030.
  const esSIT = Boolean(sistema.transito_sit);

  const escenarios = {};
  const configs = {
    base: { factor: 1, anioMacro: 2028, rampaMeses: 36 },
    conservador: { factor: 0.75, anioMacro: 2031, rampaMeses: 36 },
    optimista: { factor: 1.2, anioMacro: 2027, rampaMeses: 36 },
  };

  for (const [nombreEsc, cfg] of Object.entries(configs)) {
    const serie = [];
    let utilInicial = ultimaUtilPct / 100;
    let expansionAnio = null;
    for (let anio = 2026; anio <= 2035; anio++) {
      for (let mes = 1; mes <= 12; mes++) {
        const años = anio - 2026 + (mes - 1) / 12;
        let util = utilInicial * Math.pow(1 + tendencia, años) * estacionalidad(mes, sistema);
        const capacidadMmm3d = sistema.unidad === 'MMpcd' ? sistema.capacidad / 35.3147 : sistema.capacidad;
        // Macroproyecto Mayaya (GAA): rampa 2 -> 10 MMm3/d en 3 años desde 2028 (por escenario)
        if (esGAA) {
          const inicioMacro = new Date(cfg.anioMacro, 0, 1);
          const actual = new Date(anio, mes - 1, 1);
          const mesesDesdeInicio = (actual - inicioMacro) / (1000 * 60 * 60 * 24 * 30.44);
          if (mesesDesdeInicio >= 0) {
            const rampa = 2 + (10 - 2) * Math.min(mesesDesdeInicio / cfg.rampaMeses, 1);
            util = Math.max(util, (rampa * cfg.factor) / capacidadMmm3d);
          }
        }
        // SIT (GSCY/GASYRG/GTB): consolidación de gas en tránsito a 8 MMm3/d hacia 2030
        if (esSIT && anio >= 2030) {
          util = Math.max(util, (8 * cfg.factor) / capacidadMmm3d);
        }
        util = util * cfg.factor;
        const ruido = 1 + (rng() * 2 - 1) * 0.03;
        util = Math.min(Math.max(util, 0.05), 1.1);
        if (util > 0.9 && expansionAnio === null) expansionAnio = anio;
        const volumen = sistema.capacidad * util * ruido;
        const ingresos = volumen * tarifa * factorMensualIngreso(sistema.unidad);
        serie.push({
          periodo: `${anio}-${String(mes).padStart(2, '0')}`,
          utilizacion_pct: Number((util * 100).toFixed(1)),
          volumen: Number(volumen.toFixed(2)),
          ingresos_usd: Number(ingresos.toFixed(0)),
        });
      }
    }
    escenarios[nombreEsc] = { serie, requiere_expansion_anio: expansionAnio };
  }
  return escenarios;
}
