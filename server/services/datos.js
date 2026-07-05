import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function cargar(nombre) {
  return JSON.parse(readFileSync(join(DATA_DIR, nombre), 'utf-8'));
}

export const sistemas = cargar('sistemas.json');
export const { pesos_score, estaciones } = cargar('estaciones.json');
export const { pozos, corredores } = cargar('pozos.json');
export const { parametros_globales, proyectos } = cargar('proyectos_inversion.json');

export function sistemaPorId(id) {
  return sistemas.find((s) => s.id === id);
}
export function estacionPorId(id) {
  return estaciones.find((e) => e.id === id);
}
export function proyectoPorId(id) {
  return proyectos.find((p) => p.id === id);
}
