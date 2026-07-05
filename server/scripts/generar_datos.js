#!/usr/bin/env node
/**
 * SCRIPT HISTÓRICO — YA NO SE USA PARA GENERAR server/data/*.json.
 *
 * server/data/{sistemas,estaciones,pozos,proyectos_inversion}.json contienen
 * ahora el dataset REAL/referencial de fuentes públicas sobre YPFB Transporte
 * (ver el campo `_nota` de cada JSON y `server/services/datos.js`). NO
 * ejecutes este script pensando que refresca esos archivos: los
 * sobrescribiría con datos simulados y perderías el dataset real.
 *
 * Se conserva únicamente como referencia histórica de cómo se generaban
 * datos de referencia plausibles (PRNG mulberry32, semilla 20260704) cuando
 * el dataset real todavía no había llegado al repositorio. La técnica de
 * generación determinística de sub-scores de estaciones sigue siendo
 * relevante: esa misma lógica (adaptada a los 5 criterios y pesos reales de
 * estaciones.json) vive ahora en `server/services/engine.js` ->
 * `subScoresDeterministicos`, usada para las 43 estaciones sin score
 * curado.
 *
 * Ejecución original: node server/scripts/generar_datos.js
 * Salida original: server/data/{sistemas,estaciones,pozos,proyectos_inversion}.json
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mulberry32, rango, entero, elegir, SEMILLA_PROYECTO } from '../services/prng.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const rng = mulberry32(SEMILLA_PROYECTO);

// ---------------------------------------------------------------------
// Ciudades / puntos de referencia geográfica aproximada (Bolivia real)
// ---------------------------------------------------------------------
const CIUDADES = {
  santa_cruz: { nombre: 'Santa Cruz de la Sierra', depto: 'Santa Cruz', c: [-17.78, -63.18] },
  tarija: { nombre: 'Tarija', depto: 'Tarija', c: [-21.53, -64.73] },
  yacuiba: { nombre: 'Yacuiba', depto: 'Tarija', c: [-22.02, -63.65] },
  villamontes: { nombre: 'Villamontes', depto: 'Tarija', c: [-21.26, -63.44] },
  camiri: { nombre: 'Camiri', depto: 'Santa Cruz', c: [-20.05, -63.52] },
  sucre: { nombre: 'Sucre', depto: 'Chuquisaca', c: [-19.03, -65.26] },
  cochabamba: { nombre: 'Cochabamba', depto: 'Cochabamba', c: [-17.39, -66.16] },
  oruro: { nombre: 'Oruro', depto: 'Oruro', c: [-17.98, -67.15] },
  la_paz: { nombre: 'La Paz', depto: 'La Paz', c: [-16.5, -68.15] },
  el_alto: { nombre: 'El Alto', depto: 'La Paz', c: [-16.5, -68.2] },
  potosi: { nombre: 'Potosí', depto: 'Potosí', c: [-19.59, -65.75] },
  trinidad: { nombre: 'Trinidad', depto: 'Beni', c: [-14.83, -64.9] },
  cobija: { nombre: 'Cobija', depto: 'Pando', c: [-11.03, -68.77] },
  puerto_suarez: { nombre: 'Puerto Suárez', depto: 'Santa Cruz', c: [-18.96, -57.8] },
  charana: { nombre: 'Charaña (frontera)', depto: 'La Paz', c: [-17.58, -69.45] },
  rio_grande: { nombre: 'Río Grande', depto: 'Santa Cruz', c: [-18.3, -63.4] },
  yapacani: { nombre: 'Yapacaní', depto: 'Santa Cruz', c: [-17.4, -64.3] },
  monteagudo: { nombre: 'Monteagudo', depto: 'Chuquisaca', c: [-19.8, -63.98] },
  bermejo: { nombre: 'Bermejo', depto: 'Tarija', c: [-22.73, -64.35] },
  margarita: { nombre: 'Campo Margarita', depto: 'Tarija', c: [-21.7, -63.4] },
  colpa: { nombre: 'Colpa-Caigua', depto: 'Santa Cruz', c: [-20.3, -63.3] },
  choreti: { nombre: 'Choreti', depto: 'Santa Cruz', c: [-19.6, -63.3] },
  san_matias: { nombre: 'San Matías (frontera Brasil)', depto: 'Santa Cruz', c: [-16.37, -58.4] },
  palmasola: { nombre: 'Palmasola', depto: 'Santa Cruz', c: [-17.72, -63.24] },
  vuelta_grande: { nombre: 'Vuelta Grande', depto: 'Santa Cruz', c: [-19.9, -63.6] },
  sabalo: { nombre: 'Sábalo', depto: 'Tarija', c: [-21.85, -63.55] },
};

function jitter(v, mag) {
  return v + rango(rng, -mag, mag);
}

/** Traza una polilínea simple entre dos ciudades con puntos intermedios jitterizados */
function trazar(origenKey, destinoKey, nPuntos = 2) {
  const o = CIUDADES[origenKey].c;
  const d = CIUDADES[destinoKey].c;
  const pts = [o];
  for (let i = 1; i <= nPuntos; i++) {
    const t = i / (nPuntos + 1);
    const lat = o[0] + (d[0] - o[0]) * t + jitter(0, 0.25);
    const lng = o[1] + (d[1] - o[1]) * t + jitter(0, 0.25);
    pts.push([Number(lat.toFixed(4)), Number(lng.toFixed(4))]);
  }
  pts.push(d);
  return pts;
}

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function longitudTrazado(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineKm(coords[i - 1], coords[i]);
  return Number(total.toFixed(1));
}

// ---------------------------------------------------------------------
// 1) SISTEMAS (32 ductos)
// ---------------------------------------------------------------------
const DIAMETROS_TIPICOS = [4, 6, 8, 10, 12, 16, 20, 24, 32];

const DEF_GAS = [
  ['GASYRG', 'Gasoducto Yacuiba - Río Grande', 'yacuiba', 'rio_grande', 'exportacion', 32, [1978, 1999]],
  ['GTB', 'Gasoducto Bolivia-Brasil (tramo boliviano)', 'rio_grande', 'san_matias', 'exportacion', 32, [1999, 1999]],
  ['GIJA', 'Gasoducto de Integración Juana Azurduy', 'margarita', 'yacuiba', 'exportacion', 24, [2010, 2010]],
  ['GCC', 'Gasoducto Carrasco - Cochabamba', 'colpa', 'cochabamba', 'interno', 16, [1996, 1996]],
  ['GVT', 'Gasoducto Villamontes - Tarija', 'villamontes', 'tarija', 'interno', 10, [2001, 2001]],
  ['GYSC', 'Gasoducto Yapacaní - Santa Cruz', 'yapacani', 'santa_cruz', 'interno', 12, [2004, 2004]],
  ['GSUR', 'Gasoducto Sur (Yacuiba - Villamontes)', 'yacuiba', 'villamontes', 'exportacion', 20, [1998, 1998]],
  ['GAOR', 'Gasoducto Al Oriente', 'camiri', 'santa_cruz', 'interno', 12, [2006, 2006]],
  ['GRGY', 'Gasoducto Río Grande - Yapacaní', 'rio_grande', 'yapacani', 'interno', 10, [2008, 2008]],
  ['RCC', 'Ramal Camiri - Choreti', 'camiri', 'choreti', 'interno', 8, [1995, 1995]],
  ['GNOR', 'Gasoducto Norte (La Paz - El Alto)', 'la_paz', 'el_alto', 'interno', 8, [2000, 2000]],
  ['RCO', 'Ramal Cochabamba - Oruro', 'cochabamba', 'oruro', 'interno', 10, [2003, 2003]],
  ['GCT', 'Gasoducto Colpa - Tacobo', 'colpa', 'camiri', 'interno', 12, [1997, 1997]],
  ['RSM', 'Ramal Sábalo - Margarita', 'sabalo', 'margarita', 'interno', 8, [2011, 2011]],
];

const DEF_OLEO = [
  ['OCSA', 'Oleoducto Carrasco - Sica Sica', 'cochabamba', 'oruro', 'interno', 16, [1978, 1978]],
  ['OCSC', 'Oleoducto Camiri - Santa Cruz', 'camiri', 'santa_cruz', 'interno', 10, [1975, 1975]],
  ['OSPS', 'Oleoducto Santa Cruz - Puerto Suárez', 'santa_cruz', 'puerto_suarez', 'exportacion', 8, [1993, 1993]],
  ['OSSA', 'Oleoducto Sica Sica - Arica (tramo boliviano)', 'oruro', 'charana', 'exportacion', 10, [1966, 1966]],
  ['PRSZ', 'Propanoducto Río Grande - Santa Cruz', 'rio_grande', 'santa_cruz', 'interno', 6, [2009, 2009]],
  ['OCC', 'Oleoducto Colpa - Camiri', 'colpa', 'camiri', 'interno', 8, [1994, 1994]],
  ['OMC', 'Oleoducto Monteagudo - Camiri', 'monteagudo', 'camiri', 'interno', 6, [1990, 1990]],
  ['OBY', 'Oleoducto Bermejo - Yacuiba', 'bermejo', 'yacuiba', 'interno', 6, [1988, 1988]],
  ['OGEB', 'Oleoducto Guillermo Elder Bell', 'charana', 'oruro', 'exportacion', 10, [1966, 1966]],
  ['OVGC', 'Oleoducto Vuelta Grande - Camiri', 'vuelta_grande', 'camiri', 'interno', 6, [1985, 1985]],
  ['OPSC', 'Oleoducto Palmasola - Santa Cruz', 'palmasola', 'santa_cruz', 'interno', 6, [1992, 1992]],
  ['OKC', 'Oleoducto Kenko - Cochabamba', 'colpa', 'cochabamba', 'interno', 8, [1996, 1996]],
  ['OCK', 'Oleoducto Carrasco - Kenko', 'cochabamba', 'colpa', 'interno', 8, [1996, 1996]],
];

const DEF_POLI = [
  ['PSCC', 'Poliducto Santa Cruz - Cochabamba', 'santa_cruz', 'cochabamba', 'interno', 8, [1979, 1979]],
  ['PCOLP', 'Poliducto Cochabamba - Oruro - La Paz', 'cochabamba', 'la_paz', 'interno', 8, [1979, 1979]],
  ['PSSEA', 'Poliducto Sica Sica - El Alto', 'oruro', 'el_alto', 'interno', 6, [1980, 1980]],
  ['PCS', 'Poliducto Camiri - Sucre', 'camiri', 'sucre', 'interno', 6, [1991, 1991]],
  ['PCSU', 'Poliducto Carrasco - Sucre', 'cochabamba', 'sucre', 'interno', 6, [2002, 2002]],
];

const PRODUCTOS_GAS = ['gas_natural'];
const PRODUCTOS_OLEO_MAP = {
  OSPS: ['crudo'], OSSA: ['crudo', 'reconstituido'], OGEB: ['crudo', 'reconstituido'],
  PRSZ: ['glp'],
};
const PRODUCTOS_POLI = ['gasolina', 'diesel_oil', 'glp', 'jet_fuel'];

const sistemas = [];
let idx = 1;

function operadorPara(tipo) {
  return tipo === 'gasoducto' ? 'YPFB Transporte S.A.' : elegir(rng, ['YPFB Transporte S.A.', 'YPFB Logística S.A.']);
}

for (const [cod, nombre, o, d, mercado, diamBase, anios] of DEF_GAS) {
  const coords = trazar(o, d, entero(rng, 1, 3));
  const longitud = longitudTrazado(coords);
  const capacidad_mmpcd = Number(rango(rng, diamBase * 4, diamBase * 7).toFixed(1));
  sistemas.push({
    id: `SIS-${String(idx++).padStart(3, '0')}`,
    codigo: cod,
    nombre,
    tipo: 'gasoducto',
    mercado,
    operador: operadorPara('gasoducto'),
    tramo: `${CIUDADES[o].nombre} - ${CIUDADES[d].nombre}`,
    longitud_km: longitud,
    diametro_pulg: diamBase,
    capacidad: capacidad_mmpcd,
    unidad: 'MMpcd',
    productos: PRODUCTOS_GAS,
    anio: entero(rng, anios[0], anios[1]),
    estado: 'operativo',
    coords,
  });
}

for (const [cod, nombre, o, d, mercado, diamBase, anios] of DEF_OLEO) {
  const coords = trazar(o, d, entero(rng, 1, 3));
  const longitud = longitudTrazado(coords);
  const capacidad_bpd = Number((diamBase * rango(rng, 900, 1500)).toFixed(0));
  sistemas.push({
    id: `SIS-${String(idx++).padStart(3, '0')}`,
    codigo: cod,
    nombre,
    tipo: 'oleoducto',
    mercado,
    operador: operadorPara('oleoducto'),
    tramo: `${CIUDADES[o].nombre} - ${CIUDADES[d].nombre}`,
    longitud_km: longitud,
    diametro_pulg: diamBase,
    capacidad: capacidad_bpd,
    unidad: 'BPD',
    productos: PRODUCTOS_OLEO_MAP[cod] || ['crudo'],
    anio: entero(rng, anios[0], anios[1]),
    estado: 'operativo',
    coords,
  });
}

for (const [cod, nombre, o, d, mercado, diamBase, anios] of DEF_POLI) {
  const coords = trazar(o, d, entero(rng, 1, 2));
  const longitud = longitudTrazado(coords);
  const capacidad_bpd = Number((diamBase * rango(rng, 700, 1100)).toFixed(0));
  sistemas.push({
    id: `SIS-${String(idx++).padStart(3, '0')}`,
    codigo: cod,
    nombre,
    tipo: 'poliducto',
    mercado,
    operador: operadorPara('poliducto'),
    tramo: `${CIUDADES[o].nombre} - ${CIUDADES[d].nombre}`,
    longitud_km: longitud,
    diametro_pulg: diamBase,
    capacidad: capacidad_bpd,
    unidad: 'BPD',
    productos: PRODUCTOS_POLI,
    anio: entero(rng, anios[0], anios[1]),
    estado: 'operativo',
    coords,
  });
}

// ---------------------------------------------------------------------
// 2) ESTACIONES (55: 17 compresión, 18 bombeo, 20 poliducto)
// ---------------------------------------------------------------------
const PESOS_SCORE = { integridad: 0.3, eficiencia: 0.25, criticidad: 0.25, mantenimiento: 0.2 };

const gasIds = sistemas.filter((s) => s.tipo === 'gasoducto').map((s) => s.id);
const oleoIds = sistemas.filter((s) => s.tipo === 'oleoducto').map((s) => s.id);
const poliIds = sistemas.filter((s) => s.tipo === 'poliducto').map((s) => s.id);

function puntoEnDucto(sistemaId) {
  const s = sistemas.find((x) => x.id === sistemaId);
  const pt = elegir(rng, s.coords.slice(1, -1).length ? s.coords.slice(1, -1) : s.coords);
  return [Number((pt[0] + jitter(0, 0.05)).toFixed(4)), Number((pt[1] + jitter(0, 0.05)).toFixed(4))];
}

function deptoDeCoord(sistemaId) {
  return sistemas.find((x) => x.id === sistemaId).tramo.split(' - ')[0];
}

const estaciones = [];
let eIdx = 1;

const NOMBRES_COMPRESION = [
  'Villamontes', 'Yacuiba', 'Río Grande', 'Camiri', 'Choreti', 'Yapacaní', 'Carrasco',
  'Sábalo', 'Margarita', 'Colpa', 'San Alberto', 'Tacobo', 'Vuelta Grande', 'Monteagudo',
  'Ñancahuazú', 'Ipati', 'Itaú',
];
for (let i = 0; i < 17; i++) {
  const sistemaId = elegir(rng, gasIds);
  estaciones.push({
    id: `EST-${String(eIdx++).padStart(3, '0')}`,
    nombre: `Estación de Compresión ${NOMBRES_COMPRESION[i]}`,
    tipo: 'compresion',
    sistema_id: sistemaId,
    depto: deptoDeCoord(sistemaId),
    coords: puntoEnDucto(sistemaId),
    potencia_hp: entero(rng, 3500, 18000),
    anio: entero(rng, 1990, 2018),
    fuente: 'referencial',
  });
}

const NOMBRES_BOMBEO = [
  'Camiri', 'Palmasola', 'Colpa', 'Monteagudo', 'Bermejo', 'Vuelta Grande', 'Kenko', 'Carrasco',
  'Sica Sica', 'Oruro', 'Charaña', 'Santa Cruz Norte', 'Puerto Suárez', 'Choreti', 'Yacuiba',
  'Villamontes', 'Camargo', 'Padcaya',
];
for (let i = 0; i < 18; i++) {
  const sistemaId = elegir(rng, oleoIds);
  estaciones.push({
    id: `EST-${String(eIdx++).padStart(3, '0')}`,
    nombre: `Estación de Bombeo ${NOMBRES_BOMBEO[i]}`,
    tipo: 'bombeo',
    sistema_id: sistemaId,
    depto: deptoDeCoord(sistemaId),
    coords: puntoEnDucto(sistemaId),
    capacidad_bpd: entero(rng, 8000, 45000),
    anio: entero(rng, 1985, 2015),
    fuente: 'referencial',
  });
}

const NOMBRES_POLI = [
  'Santa Cruz', 'Cochabamba', 'Oruro', 'El Alto', 'Sucre', 'Camiri', 'Sica Sica', 'Senkata',
  'Valle Hermoso', 'Kenko', 'Vinto', 'Challapata', 'Villazón', 'Tarija', 'Yacuiba', 'Trinidad',
  'Guayaramerín', 'Riberalta', 'Potosí', 'Uyuni',
];
for (let i = 0; i < 20; i++) {
  const sistemaId = elegir(rng, poliIds);
  estaciones.push({
    id: `EST-${String(eIdx++).padStart(3, '0')}`,
    nombre: `Planta de Bombeo Poliducto ${NOMBRES_POLI[i]}`,
    tipo: 'poliducto',
    sistema_id: sistemaId,
    depto: deptoDeCoord(sistemaId),
    coords: puntoEnDucto(sistemaId),
    capacidad_bpd: entero(rng, 3000, 20000),
    anio: entero(rng, 1980, 2012),
    fuente: 'referencial',
  });
}

// 12 estaciones con sub_scores curados manualmente
const CURADAS = [0, 3, 6, 9, 12, 18, 22, 27, 33, 38, 44, 50];
const SUBSCORES_MANUAL = [
  [88, 82, 90, 85], [65, 60, 70, 58], [50, 45, 55, 40], [92, 88, 95, 90],
  [70, 72, 68, 65], [45, 40, 50, 35], [78, 75, 80, 77], [60, 58, 62, 55],
  [95, 92, 90, 93], [55, 50, 58, 48], [40, 38, 42, 30], [83, 80, 85, 82],
];
CURADAS.forEach((pos, i) => {
  const [integridad, eficiencia, criticidad, mantenimiento] = SUBSCORES_MANUAL[i];
  const score = Number(
    (
      integridad * PESOS_SCORE.integridad +
      eficiencia * PESOS_SCORE.eficiencia +
      criticidad * PESOS_SCORE.criticidad +
      mantenimiento * PESOS_SCORE.mantenimiento
    ).toFixed(1)
  );
  estaciones[pos].sub_scores = { integridad, eficiencia, criticidad, mantenimiento };
  estaciones[pos].score = score;
  estaciones[pos].score_curado = true;
});

writeFileSync(join(DATA_DIR, 'sistemas.json'), JSON.stringify(sistemas, null, 2));
writeFileSync(
  join(DATA_DIR, 'estaciones.json'),
  JSON.stringify({ pesos_score: PESOS_SCORE, estaciones }, null, 2)
);

// ---------------------------------------------------------------------
// 3) POZOS (40) + 4 corredores
// ---------------------------------------------------------------------
const CATEGORIAS = ['descubrimiento', 'desarrollo', 'perforacion', 'programado', 'estratigrafico', 'negativo'];
const OPERADORES_POZO = ['YPFB Chaco', 'YPFB Andina', 'Petrobras Bolivia', 'Repsol E&P Bolivia', 'Shell Bolivia', 'YPFB Corporación'];
const CORREDORES_DEF = [
  { id: 'COR-01', nombre: 'Corredor Norte', deptos: ['La Paz', 'Beni', 'Pando'] },
  { id: 'COR-02', nombre: 'Corredor Boomerang', deptos: ['Santa Cruz', 'Cochabamba'] },
  { id: 'COR-03', nombre: 'Corredor Chuquisaca', deptos: ['Chuquisaca', 'Potosí'] },
  { id: 'COR-04', nombre: 'Corredor Chaco', deptos: ['Tarija', 'Santa Cruz'] },
];
const CORREDOR_NOMBRES = ['Norte', 'Boomerang', 'Chuquisaca', 'Chaco'];

const NOMBRES_POZOS = [
  'Margarita Sur', 'Itaú Profundo', 'Huacaya', 'Incahuasi Norte', 'Aquio', 'San Alberto Este',
  'Ipati', 'Boyuy-X2', 'Vuelta Grande Este', 'Yarará', 'Sararenda', 'Iñau', 'Carohuaicho',
  'Curichera', 'Timboy', 'Los Suris', 'Dorado Este', 'Junín', 'Yapacaní Norte', 'Río Beni',
  'Cascabel', 'Madidi Sur', 'Chispani', 'Astillero', 'Tacobo Profundo', 'Charagua', 'Ñupuco',
  'Tajibo', 'Sipotindi', 'Caigua Norte', 'Camatindi', 'Ovai', 'Percheles', 'Estancia Vieja',
  'Tundy', 'Vera', 'Yuquimbia', 'Ñacaroca', 'Guairuy', 'Iñiguazu',
];

const HIDROCARBUROS = ['gas', 'condensado', 'gas_liquidos', 'petroleo'];
const TERRENOS = ['llano', 'selva', 'montania'];

const pozos = [];
for (let i = 0; i < 40; i++) {
  const nombre = NOMBRES_POZOS[i];
  const esBoyuy = nombre === 'Boyuy-X2';
  const categoria = esBoyuy ? 'negativo' : elegir(rng, CATEGORIAS.filter((c) => c !== 'negativo'));
  const corredorIdx = entero(rng, 0, 3);
  const corredor = CORREDOR_NOMBRES[corredorIdx];
  // coords aproximadas dentro de Bolivia, sesgadas por corredor
  const base = [
    [-14.5, -67.5], // Norte
    [-17.7, -63.6], // Boomerang
    [-19.6, -64.3], // Chuquisaca
    [-21.6, -63.6], // Chaco
  ][corredorIdx];
  const coords = [Number((base[0] + jitter(0, 1.4)).toFixed(4)), Number((base[1] + jitter(0, 1.4)).toFixed(4))];
  const gas_mmpcd = categoria === 'negativo' ? 0 : Number(rango(rng, 1, 45).toFixed(2));
  const liquidos_bpd = categoria === 'negativo' ? 0 : Number(rango(rng, 50, 3200).toFixed(0));
  const distancia_km_red = Number(rango(rng, 4, 85).toFixed(1));
  const terreno = elegir(rng, TERRENOS);
  const diametro_sugerido_pulg = elegir(rng, [4, 6, 8, 10, 12]);
  const capexUnit = { llano: 0.85, selva: 1.3, montania: 1.6 }[terreno];
  const capex_interconexion_mm_usd = Number((distancia_km_red * diametro_sugerido_pulg * capexUnit * 0.06).toFixed(2));
  pozos.push({
    id: `POZ-${String(i + 1).padStart(3, '0')}`,
    nombre,
    operador: esBoyuy ? 'YPFB Chaco' : elegir(rng, OPERADORES_POZO),
    categoria,
    tipo_hidrocarburo: categoria === 'negativo' ? 'seco' : elegir(rng, HIDROCARBUROS),
    produccion_potencial: { gas_mmpcd, liquidos_bpd },
    coords,
    corredor,
    distancia_km_red,
    diametro_sugerido_pulg,
    terreno,
    capex_interconexion_mm_usd: Math.max(capex_interconexion_mm_usd, 0.5),
    prioridad: esBoyuy ? 3 : entero(rng, 1, 3),
    nota: esBoyuy
      ? 'Caso de riesgo exploratorio (referencia pública del sector: pozo con resultados no comerciales / abandono). Datos de producción y CAPEX no aplicables.'
      : undefined,
  });
}

const corredores = CORREDORES_DEF.map((c, i) => ({
  ...c,
  pozos_ids: pozos.filter((p) => p.corredor === CORREDOR_NOMBRES[i]).map((p) => p.id),
}));

writeFileSync(join(DATA_DIR, 'pozos.json'), JSON.stringify({ pozos, corredores }, null, 2));

// ---------------------------------------------------------------------
// 4) PROYECTOS DE INVERSIÓN
// ---------------------------------------------------------------------
const parametros_globales = {
  tasa_pct: 10,
  vida_anios: 25,
  opex_pct_capex: 3.5,
  capex_unitario_por_pulgada_km: { llano: 55000, selva: 82000, montania: 98000 },
  factor_ruta: 1.25,
  tarifas_referencia: {
    gas_exportacion: 3.8, // USD/MPC
    gas_interno: 2.1, // USD/MPC
    crudo: 62, // USD/bbl
    glp: 58, // USD/bbl equiv.
    refinados: 70, // USD/bbl
  },
};

const MACROPROYECTOS = [
  {
    id: 'PRY-01',
    nombre: 'Ampliación Corredor Boomerang - Gas Norte',
    descripcion:
      'Interconexión de pozos del corredor Boomerang con ampliación de capacidad hacia el mercado interno de Santa Cruz y Cochabamba.',
    fases: [
      { anio: 2026, capex_mm_usd: 45 },
      { anio: 2027, capex_mm_usd: 60 },
      { anio: 2028, capex_mm_usd: 25 },
    ],
  },
  {
    id: 'PRY-02',
    nombre: 'Nuevo Ducto de Exportación GIJA-II',
    descripcion:
      'Segunda línea paralela al corredor de exportación hacia Argentina para sostener compromisos contractuales de gas.',
    fases: [
      { anio: 2027, capex_mm_usd: 90 },
      { anio: 2028, capex_mm_usd: 110 },
    ],
  },
  {
    id: 'PRY-03',
    nombre: 'Interconexión Corredor Chaco - Pozos Profundos',
    descripcion: 'Conexión de clusters de pozos en desarrollo del Chaco tarijeño a la red troncal GASYRG/GIJA.',
    fases: [
      { anio: 2026, capex_mm_usd: 35 },
      { anio: 2027, capex_mm_usd: 20 },
    ],
  },
  {
    id: 'PRY-04',
    nombre: 'Modernización Poliductos del Altiplano',
    descripcion: 'Rehabilitación y ampliación de capacidad de poliductos Cochabamba-Oruro-La Paz y Sica Sica-El Alto.',
    fases: [
      { anio: 2026, capex_mm_usd: 18 },
      { anio: 2027, capex_mm_usd: 22 },
    ],
  },
  {
    id: 'PRY-05',
    nombre: 'Corredor Chuquisaca - Nueva Interconexión Rural',
    descripcion: 'Extensión de red hacia clusters de pozos del corredor Chuquisaca con enfoque en abastecimiento interno.',
    fases: [
      { anio: 2027, capex_mm_usd: 15 },
      { anio: 2028, capex_mm_usd: 12 },
    ],
  },
];

// VAN/TIR aproximado (bisección simple) reutilizando la misma lógica del motor real
function irr(cashflows, lo = -0.5, hi = 1.0, tol = 1e-6) {
  const npvAt = (r) => cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
  let a = lo, b = hi;
  let fa = npvAt(a), fb = npvAt(b);
  if (fa * fb > 0) return null;
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2;
    const fm = npvAt(m);
    if (Math.abs(fm) < tol) return m;
    if (fa * fm < 0) { b = m; fb = fm; } else { a = m; fa = fm; }
  }
  return (a + b) / 2;
}
function npv(rate, cashflows) {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

const proyectos = MACROPROYECTOS.map((p, i) => {
  const capex_total_mm_usd = Number(p.fases.reduce((a, f) => a + f.capex_mm_usd, 0).toFixed(1));
  const vida = parametros_globales.vida_anios;
  const opexAnual = capex_total_mm_usd * (parametros_globales.opex_pct_capex / 100);
  const ingresoBaseAnual = capex_total_mm_usd * rango(rng, 0.22, 0.34); // proxy de ingreso anual simulado
  const escenarios_roi = {};
  for (const [esc, factor] of [['base', 1], ['conservador', 0.75], ['optimista', 1.2]]) {
    const flujo = [];
    // años 0..2 capex por fases, luego ingresos - opex hasta vida_anios
    for (let t = 0; t <= vida; t++) {
      const fase = p.fases[t];
      const capex = fase ? -fase.capex_mm_usd : 0;
      const opera = t >= p.fases.length ? (ingresoBaseAnual * factor - opexAnual) : 0;
      flujo.push(Number((capex + opera).toFixed(2)));
    }
    const tir = irr(flujo);
    const van = Number(npv(parametros_globales.tasa_pct / 100, flujo).toFixed(1));
    let acum = 0, payback = null;
    for (let t = 0; t < flujo.length; t++) {
      acum += flujo[t];
      if (acum >= 0 && payback === null) payback = t;
    }
    escenarios_roi[esc] = {
      van_mm_usd: van,
      tir_pct: tir !== null ? Number((tir * 100).toFixed(1)) : null,
      payback_anios: payback,
    };
  }
  return { ...p, capex_total_mm_usd, escenarios_roi };
});

writeFileSync(
  join(DATA_DIR, 'proyectos_inversion.json'),
  JSON.stringify({ parametros_globales, proyectos }, null, 2)
);

console.log('Datos de referencia generados en server/data/:');
console.log(` - sistemas.json: ${sistemas.length} ductos`);
console.log(` - estaciones.json: ${estaciones.length} estaciones`);
console.log(` - pozos.json: ${pozos.length} pozos, ${corredores.length} corredores`);
console.log(` - proyectos_inversion.json: ${proyectos.length} macroproyectos`);
