import { Router } from 'express';
import {
  capacidadGasWeymouth,
  capacidadLiquidosHazenWilliams,
  capexDuctoNuevo,
  haversineKm,
  evaluarFinanciero,
  matrizSensibilidad,
  scoreEstacion,
  recomendacionScore,
} from '../services/engine.js';
import { parametros_globales, sistemaPorId } from '../services/datos.js';
import { estacionesPorId } from '../services/estado.js';

const router = Router();

function numero(v, nombre) {
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Parámetro inválido: ${nombre}`);
  return n;
}

router.post('/gas', (req, res) => {
  try {
    const { diametro_pulg, longitud_km, p1_psia, p2_psia, eficiencia } = req.body || {};
    if (diametro_pulg == null || longitud_km == null) {
      return res.status(400).json({ error: 'Se requiere diametro_pulg y longitud_km' });
    }
    const resultado = capacidadGasWeymouth(numero(diametro_pulg, 'diametro_pulg'), numero(longitud_km, 'longitud_km'), {
      p1_psia: p1_psia != null ? numero(p1_psia, 'p1_psia') : undefined,
      p2_psia: p2_psia != null ? numero(p2_psia, 'p2_psia') : undefined,
      eficiencia: eficiencia != null ? numero(eficiencia, 'eficiencia') : undefined,
    });
    res.json(resultado);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/liquidos', (req, res) => {
  try {
    const { diametro_pulg, dp_psi_milla, producto } = req.body || {};
    if (diametro_pulg == null) return res.status(400).json({ error: 'Se requiere diametro_pulg' });
    const resultado = capacidadLiquidosHazenWilliams(numero(diametro_pulg, 'diametro_pulg'), producto || 'crudo', {
      dp_psi_milla: dp_psi_milla != null ? numero(dp_psi_milla, 'dp_psi_milla') : undefined,
    });
    res.json(resultado);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/financiero', (req, res) => {
  try {
    const body = req.body || {};
    let capex_usd = body.capex_usd_mm != null ? numero(body.capex_usd_mm, 'capex_usd_mm') * 1e6 : null;
    let detalleCapex = null;
    if (capex_usd == null) {
      const { diametro, longitud, terreno } = body;
      if (diametro == null || longitud == null) {
        return res.status(400).json({ error: 'Se requiere capex_usd_mm o (diametro, longitud, terreno)' });
      }
      const c = capexDuctoNuevo(numero(diametro, 'diametro'), numero(longitud, 'longitud'), terreno || 'llano', { esHaversine: false });
      capex_usd = c.capex_usd;
      detalleCapex = c;
    }
    const { volumen, utilizacion_pct, tarifa, tasa_pct, horizonte, opex_pct } = body;
    if (!volumen || volumen.valor == null || !volumen.unidad) {
      return res.status(400).json({ error: 'Se requiere volumen: {tipo, valor, unidad}' });
    }
    if (utilizacion_pct == null || tarifa == null) return res.status(400).json({ error: 'Se requiere utilizacion_pct y tarifa' });

    const params = {
      capex_usd,
      volumen_valor: numero(volumen.valor, 'volumen.valor'),
      volumen_unidad: volumen.unidad,
      utilizacion_pct: numero(utilizacion_pct, 'utilizacion_pct'),
      tarifa_usd: numero(tarifa, 'tarifa'),
      tasa_pct: tasa_pct != null ? numero(tasa_pct, 'tasa_pct') : parametros_globales.tasa_pct,
      horizonte: horizonte != null ? numero(horizonte, 'horizonte') : parametros_globales.vida_anios,
      opex_pct_capex: opex_pct != null ? numero(opex_pct, 'opex_pct') : parametros_globales.opex_pct_capex,
    };
    const financiero = evaluarFinanciero(params);
    const sensibilidad = matrizSensibilidad(params);
    res.json({ ...financiero, sensibilidad, capex_detalle: detalleCapex });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const DIAMETROS_DISPONIBLES = [4, 6, 8, 10, 12, 16, 20, 24, 32];

router.post('/nuevo-ducto', (req, res) => {
  try {
    const { origen, destino, tipo, volumen_objetivo, terreno, tarifa, utilizacion_pct } = req.body || {};
    if (!origen || !destino || !tipo || volumen_objetivo == null) {
      return res.status(400).json({ error: 'Se requiere origen, destino, tipo y volumen_objetivo' });
    }
    const o = origen.nodo_id ? sistemaPorId(origen.nodo_id)?.coords?.[0] : [origen.lat, origen.lng];
    const d = destino.nodo_id ? sistemaPorId(destino.nodo_id)?.coords?.[0] : [destino.lat, destino.lng];
    if (!o || !d) return res.status(400).json({ error: 'Coordenadas de origen/destino inválidas' });

    const longitud_km = Number((haversineKm(o, d) * 1.25).toFixed(1));

    let diametroSugerido = null;
    let capacidadCalc = null;
    for (const d_pulg of DIAMETROS_DISPONIBLES) {
      const cap = tipo === 'gasoducto' ? capacidadGasWeymouth(d_pulg, longitud_km) : capacidadLiquidosHazenWilliams(d_pulg, 'crudo');
      const valorCap = tipo === 'gasoducto' ? cap.mmpcd : cap.bpd;
      if (valorCap >= volumen_objetivo) {
        diametroSugerido = d_pulg;
        capacidadCalc = cap;
        break;
      }
    }
    if (!diametroSugerido) {
      diametroSugerido = DIAMETROS_DISPONIBLES[DIAMETROS_DISPONIBLES.length - 1];
      capacidadCalc = tipo === 'gasoducto' ? capacidadGasWeymouth(diametroSugerido, longitud_km) : capacidadLiquidosHazenWilliams(diametroSugerido, 'crudo');
    }

    const capex = capexDuctoNuevo(diametroSugerido, longitud_km, terreno || 'llano', { esHaversine: true });

    const params = {
      capex_usd: capex.capex_usd,
      volumen_valor: volumen_objetivo,
      volumen_unidad: tipo === 'gasoducto' ? 'MMpcd' : 'BPD',
      utilizacion_pct: utilizacion_pct ?? 75,
      tarifa_usd: tarifa ?? (tipo === 'gasoducto' ? parametros_globales.tarifas_referencia.gas_interno : parametros_globales.tarifas_referencia.crudo),
      tasa_pct: parametros_globales.tasa_pct,
      horizonte: parametros_globales.vida_anios,
      opex_pct_capex: parametros_globales.opex_pct_capex,
    };
    const financiero = evaluarFinanciero(params);

    res.json({
      longitud_km,
      diametro_sugerido_pulg: diametroSugerido,
      capacidad_calculada: capacidadCalc,
      capex,
      financiero,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/estacion-standby', (req, res) => {
  try {
    const { estacion_id, reduccion_capacidad_pct } = req.body || {};
    if (!estacion_id) return res.status(400).json({ error: 'Se requiere estacion_id' });
    const e = estacionesPorId.get(estacion_id);
    if (!e) return res.status(404).json({ error: 'Estación no encontrada' });

    const reduccion = reduccion_capacidad_pct ?? 30;
    const capexEquivalente = (e.potencia_hp ? e.potencia_hp * 900 : (e.capacidad_bpd || 0) * 40);
    const ahorro_opex_usd = capexEquivalente * 0.022;

    const nuevoSubScores = { ...e.sub_scores, criticidad: Math.max(0, e.sub_scores.criticidad - reduccion * 0.4) };
    const nuevoScore = scoreEstacion(nuevoSubScores, req.pesos_score || { integridad: 0.3, eficiencia: 0.25, criticidad: 0.25, mantenimiento: 0.2 });

    res.json({
      estacion_id,
      reduccion_capacidad_pct: reduccion,
      capacidad_equivalente_usd: Number(capexEquivalente.toFixed(0)),
      ahorro_opex_usd: Number(ahorro_opex_usd.toFixed(0)),
      score_anterior: e.score,
      score_nuevo: Number(nuevoScore.toFixed(1)),
      recomendacion_nueva: recomendacionScore(nuevoScore),
      advertencias:
        reduccion > 50
          ? ['Reducción significativa: revisar impacto en capacidad firme comprometida del sistema.']
          : [],
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
