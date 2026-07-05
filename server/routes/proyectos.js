import { Router } from 'express';
import { proyectos, proyectoPorId, parametros_globales } from '../services/datos.js';
import { evaluarFinanciero, matrizSensibilidad } from '../services/engine.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(proyectos.map(({ id, nombre, descripcion, capex_total_mm_usd, escenarios_roi }) => ({ id, nombre, descripcion, capex_total_mm_usd, escenarios_roi })));
});

router.get('/:id', (req, res) => {
  const p = proyectoPorId(req.params.id);
  if (!p) return res.status(404).json({ error: 'Proyecto no encontrado' });

  const tarifa = parametros_globales.tarifas_referencia.gas_interno;
  const base = {
    fases: p.fases,
    volumen_valor: 8, // MMm3/d de referencia para flujo detallado
    volumen_unidad: 'MMm3/d',
    utilizacion_pct: 80,
    tarifa_usd: tarifa,
    tasa_pct: parametros_globales.tasa_pct,
    horizonte: parametros_globales.vida_anios,
    opex_pct_capex: parametros_globales.opex_pct_capex,
  };
  const financiero = evaluarFinanciero(base);
  const sensibilidad = matrizSensibilidad(base);

  res.json({ ...p, financiero_detallado: financiero, sensibilidad, parametros_usados: base });
});

export default router;
