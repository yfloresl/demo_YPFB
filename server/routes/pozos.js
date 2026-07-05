import { Router } from 'express';
import { pozosRankeados, pozosPorId } from '../services/estado.js';
import { corredores } from '../services/datos.js';

const router = Router();

router.get('/', (req, res) => {
  let lista = pozosRankeados;
  if (req.query.corredor) lista = lista.filter((p) => p.corredor === req.query.corredor);
  if (req.query.categoria) lista = lista.filter((p) => p.categoria === req.query.categoria);
  res.json(lista);
});

router.get('/:id', (req, res) => {
  const p = pozosPorId.get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Pozo no encontrado' });
  res.json(p);
});

export default router;

export const corredoresRouter = Router();
corredoresRouter.get('/', (req, res) => {
  const agregados = corredores.map((c) => {
    const pozosDelCorredor = pozosRankeados.filter((p) => c.pozos_ids.includes(p.id));
    // CAPEX total del corredor = troncal + interconexión de sus pozos
    // (excluyendo los ya conectados, que no requieren nuevo CAPEX).
    const capexInterconexion = pozosDelCorredor
      .filter((p) => !p.ya_conectado)
      .reduce((a, p) => a + p.capex_interconexion_mm_usd, 0);
    return {
      ...c,
      n_pozos: pozosDelCorredor.length,
      gas_mmpcd_total: Number(pozosDelCorredor.reduce((a, p) => a + p.produccion_potencial.gas_mmpcd, 0).toFixed(2)),
      liquidos_bpd_total: pozosDelCorredor.reduce((a, p) => a + p.produccion_potencial.liquidos_bpd, 0),
      capex_troncal_usd_mm: c.capex_troncal_usd_mm,
      capex_interconexion_mm_usd: Number(capexInterconexion.toFixed(2)),
      capex_total_mm_usd: Number(((c.capex_troncal_usd_mm || 0) + capexInterconexion).toFixed(2)),
    };
  });
  res.json(agregados);
});
