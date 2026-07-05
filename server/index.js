import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import redRouter from './routes/red.js';
import ductosRouter from './routes/ductos.js';
import estacionesRouter from './routes/estaciones.js';
import pozosRouter, { corredoresRouter } from './routes/pozos.js';
import proyectosRouter from './routes/proyectos.js';
import simuladorRouter from './routes/simulador.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(compression());
app.use(express.json());

app.use('/api/red', redRouter);
app.use('/api/ductos', ductosRouter);
app.use('/api/estaciones', estacionesRouter);
app.use('/api/pozos', pozosRouter);
app.use('/api/corredores', corredoresRouter);
app.use('/api/proyectos', proyectosRouter);
app.use('/api/simulador', simuladorRouter);

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Recurso no encontrado' });
  next();
});

// Servir el build de producción del cliente
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`DuctoVision Bolivia API escuchando en puerto ${PORT}`);
});
