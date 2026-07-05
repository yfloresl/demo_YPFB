/**
 * PRNG determinístico mulberry32.
 * Usado para generar datos de referencia reproducibles y para el motor
 * de series históricas / proyecciones (ruido determinístico).
 * Semilla fija del proyecto: 20260704.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEMILLA_PROYECTO = 20260704;

/** Devuelve un número pseudoaleatorio en [min, max) usando un rng mulberry32 */
export function rango(rng, min, max) {
  return min + rng() * (max - min);
}

/** Entero pseudoaleatorio en [min, max] inclusive */
export function entero(rng, min, max) {
  return Math.floor(rango(rng, min, max + 1));
}

export function elegir(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
