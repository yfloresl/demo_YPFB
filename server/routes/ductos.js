import { Router } from 'express';
import { sistemas } from '../services/datos.js';
import { seriesPorSistema, proyeccionesPorSistema, capacidadTeoricaPorSistema, estacionesConScore, utilizacionUltimoMes } from '../services/estado.js';

const router = Router();

router.get('/', (req, res) => {
  const lista = sistemas.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    nombre: s.nombre,
    tipo: s.tipo,
    mercado: s.mercado,
    tramo: s.tramo,
    longitud_km: s.longitud_km,
    diametro_pulg: s.diametro_pulg,
    capacidad: s.capacidad,
    unidad: s.unidad,
    coords: s.coords,
    utilizacion_pct: utilizacionUltimoMes(s.id),
  }));
  res.json(lista);
});

router.get('/:id', (req, res) => {
  const s = sistemas.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Ducto no encontrado' });
  const serie = seriesPorSistema.get(s.id);
  const proyecciones = proyeccionesPorSistema.get(s.id);
  const capacidadTeorica = capacidadTeoricaPorSistema.get(s.id);
  const estacionesDelSistema = estacionesConScore.filter((e) => e.sistema_id === s.id);
  res.json({
    ...s,
    utilizacion_pct: utilizacionUltimoMes(s.id),
    serie_historica: serie,
    proyecciones,
    capacidad_teorica: capacidadTeorica,
    estaciones: estacionesDelSistema,
  });
});

router.get('/:id/series', (req, res) => {
  const s = sistemas.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Ducto no encontrado' });
  const metrica = req.query.metrica === 'ingresos' ? 'ingresos_usd' : 'volumen';
  const escenario = req.query.escenario || 'base';

  const historica = seriesPorSistema.get(s.id).map((p) => ({ periodo: p.periodo, valor: p[metrica] }));
  const proyecciones = proyeccionesPorSistema.get(s.id);
  if (!proyecciones[escenario]) return res.status(400).json({ error: 'Escenario inválido' });
  const proyeccion = proyecciones[escenario].serie.map((p) => ({ periodo: p.periodo, valor: p[metrica] }));

  res.json({
    id: s.id,
    metrica: req.query.metrica || 'volumen',
    escenario,
    historica,
    proyeccion,
    requiere_expansion_anio: proyecciones[escenario].requiere_expansion_anio,
  });
});

export default router;
