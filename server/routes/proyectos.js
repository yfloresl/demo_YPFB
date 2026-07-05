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

  // Utilización de referencia: la del escenario "base" precargado en
  // escenarios_roi si existe, si no 80% por defecto.
  const utilizacionRef = p.escenarios_roi?.base?.utilizacion_pct ?? 80;
  const base = {
    fases: p.fases,
    volumen_valor: p.volumen_diseno_normalizado.valor,
    volumen_unidad: p.volumen_diseno_normalizado.unidad,
    utilizacion_pct: utilizacionRef,
    tarifa_usd: p.tarifa_usd_estimada,
    tasa_pct: parametros_globales.tasa_pct,
    horizonte: parametros_globales.vida_anios,
    opex_pct_capex: parametros_globales.opex_pct_capex,
  };
  const financiero = evaluarFinanciero(base);
  const sensibilidad = matrizSensibilidad(base);

  // Diferencia vs. el escenario "base" precargado en proyectos_inversion.json
  // (valores de referencia de YPFB/estudios, no siempre reproducibles con el
  // motor simplificado — ver README § Supuestos).
  const roiBasePrecargado = p.escenarios_roi?.base ?? null;
  const comparacion_vs_precargado = roiBasePrecargado
    ? {
        van_mm_usd_precargado: roiBasePrecargado.van_mm_usd,
        van_mm_usd_recalculado: financiero.van_mm_usd,
        tir_pct_precargado: roiBasePrecargado.tir_pct,
        tir_pct_recalculado: financiero.tir_pct,
      }
    : null;

  res.json({ ...p, financiero_detallado: financiero, sensibilidad, parametros_usados: base, comparacion_vs_precargado });
});

export default router;
