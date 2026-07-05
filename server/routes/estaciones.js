import { Router } from 'express';
import { estacionesConScore, estacionesPorId } from '../services/estado.js';
import { pesos_score, sistemaPorId } from '../services/datos.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ pesos_score, estaciones: estacionesConScore });
});

router.get('/:id', (req, res) => {
  const e = estacionesPorId.get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Estación no encontrada' });
  const sistema = sistemaPorId(e.sistema_id);
  const mismasDelSistema = estacionesConScore.filter((x) => x.sistema_id === e.sistema_id && x.id !== e.id);
  res.json({ ...e, sistema, estaciones_mismo_sistema: mismasDelSistema, pesos_score });
});

export default router;
