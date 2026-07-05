# DuctoVision Bolivia

Plataforma web demo, en español, para visualización de la red de ductos de YPFB Transporte y subsidiarias, y simulación estructurada de cálculos hidráulicos, de capacidad y financieros para decisiones de transporte, inversión, interconexión de pozos y factibilidad de estaciones.

## ⚠️ Naturaleza de los datos (léase antes de usar)

**Ningún archivo de datos reales llegó a este repositorio.** El usuario intentó subir un dataset original pero nunca llegó al filesystem del proyecto. Ante esa ausencia, y con autorización explícita, se generaron datos de **referencia plausibles** con:

- Nombres de sistemas, ciudades y departamentos **reales** de Bolivia (Santa Cruz, Tarija, Chuquisaca, Cochabamba, La Paz, Beni, Pando, Potosí, Oruro) y nombres de sistemas de ductos inspirados en la red pública conocida (GASYRG, GTB, GIJA, OCSA, propanoducto PRSZ, etc.).
- **Números, trazados geográficos, series históricas, proyecciones y resultados financieros totalmente simulados** mediante un PRNG determinístico (mulberry32, semilla `20260704`), generados por `server/scripts/generar_datos.js` y por el motor de cálculo `server/services/engine.js`.
- El pozo "Boyuy-X2" se incluye únicamente como **referencia pública conocida** de un caso de riesgo exploratorio en el sector; sus datos de producción y CAPEX no son reales ni aplicables.

**Esta demo no representa información oficial de YPFB Transporte S.A.** Un banner fijo con esta advertencia aparece en el footer de todas las vistas.

## Stack

- **client/**: React 18 + Vite + Tailwind CSS + React Router + react-leaflet + Recharts.
- **server/**: Node 20 + Express, sirviendo `/api/*` y el build de `client/dist` en producción (un solo Web Service).
- **Sin base de datos**: JSON estático en `server/data/` (generado una vez por el script) + cálculos determinísticos en memoria al arranque (`server/services/estado.js`).
- Idioma UI: español. Formato numérico `Intl.NumberFormat('es-BO')`.

## Estructura

```
/
├── client/
│   └── src/{components,pages,hooks,context,lib}
├── server/
│   ├── routes/        # /api/red, /ductos, /estaciones, /pozos, /corredores, /proyectos, /simulador
│   ├── services/       # engine.js (fórmulas), estado.js (cache derivada), datos.js (loader), prng.js
│   ├── data/            # sistemas.json, estaciones.json, pozos.json, proyectos_inversion.json
│   └── scripts/generar_datos.js
└── package.json         # scripts raíz (dev/build/start)
```

## Fórmulas implementadas (server/services/engine.js)

1. **Capacidad de gasoducto (Weymouth simplificado)**: `Q = 433.5 × (Tb/Pb) × d^(8/3) × √((P1²−P2²)/(G×Tf×L×Z)) × E`
2. **Capacidad de líquidos (Hazen-Williams + viscosidad)**: `Q_bpd = 0.148 × C × d^2.63 × (ΔP)^0.54 × f_visc`
3. **CAPEX de ducto nuevo**: `diámetro × longitud_km × costo_unitario(terreno) × factor_ruta`
4. **Financiero**: VAN, TIR (bisección −50%/+100%, tolerancia 1e-6), payback simple/descontado, LCOT.
5. **Sensibilidad**: matriz 5×5 de TIR (tarifa × utilización, ±20/±10/0%).
6. **Ranking de pozos**: índice ponderado por categoría, USD MM/MMpcd equivalente, TIR por pozo.
7. **Scoring de estaciones**: score ponderado (integridad 30%, eficiencia 25%, criticidad 25%, mantenimiento 20%).
8. **Series históricas** 2018-01 a 2025-12 y **proyecciones** 2026-01 a 2035-12 en 3 escenarios (base/conservador/optimista), determinísticas.

## API REST (prefijo `/api`)

`GET /red/resumen`, `GET|POST /ductos`, `GET /ductos/:id`, `GET /ductos/:id/series`, `GET /estaciones(/:id)`, `GET /pozos`, `GET /corredores`, `GET /proyectos(/:id)`, y los 5 simuladores: `POST /simulador/{gas,liquidos,financiero,nuevo-ducto,estacion-standby}`.

## Supuestos y decisiones (donde la especificación era ambigua)

- **Longitud de trazados de sistemas existentes**: se calcula por Haversine sobre puntos intermedios generados aleatoriamente entre ciudades reales — no representa el trazado físico exacto.
- **Ingresos anualizados del dashboard**: se estiman a partir de la serie histórica mensual multiplicada por 12 (proxy simplificado), no de un cálculo contable real.
- **`volumen_ultimo_mes` en `/red/resumen`**: suma de unidades heterogéneas (MMpcd + BPD) como indicador agregado de actividad, no una magnitud físicamente homogénea — se documenta así para evitar interpretación errónea.
- **Estaciones con score curado (12) vs. determinístico (43 restantes)**: las curadas fijan sub-scores manuales; el resto se genera con una función determinística semilla-por-estación correlacionada con la utilización del ducto asociado (banda [30,95]).
- **Tarifa dominante por pozo** (para TIR de ranking): se usa gas interno o crudo según cuál volumen equivalente (gas_mmpcd vs líquidos_bpd/500) sea mayor.
- **Escenario global (React Context)** afecta Proyecciones, Inversiones y las proyecciones referenciadas desde Dashboard; no re-simula los datos ya materializados en `server/data/`.
- **Mapa de Inversiones**: los 5 trazados propuestos son aproximaciones visuales de corredores reales conocidos, dibujados a mano como polilíneas punteadas ámbar — no georreferenciación de ingeniería.
- **Flechas de flujo**: implementadas 100% con triángulos SVG en `components/FlowArrows.jsx` calculados sobre puntos intermedios de cada polilínea (sin `leaflet-polylinedecorator`).

## Desarrollo local

```bash
npm install
npm run gen:data     # (opcional) regenerar server/data/*.json desde cero
npm run dev          # levanta server (puerto 4000) y client (puerto 5173) con proxy /api
```

## Build y arranque de producción

```bash
npm run build   # instala deps de client/server y construye client/dist
npm start        # levanta Express sirviendo /api/* + client/dist en el mismo puerto (PORT, default 4000)
```

Verificado: `npm run build` + `npm start` + `curl` a los endpoints principales (incluyendo un POST a cada uno de los 5 simuladores) — todos responden `200`. Respuestas confirman 32 ductos, 55 estaciones, 40 pozos y 4 corredores.

## Despliegue en Render (Web Service, plan Free)

1. Crear un nuevo **Web Service** en Render apuntando a este repositorio.
2. **Runtime**: Node **20.x** (definido también en `engines` de `package.json`).
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm start`
5. **Variables de entorno**: ninguna obligatoria (usa `PORT` inyectado por Render automáticamente).
6. El plan Free de Render "duerme" el servicio tras inactividad: la primera solicitud tras el sleep puede tardar **~30-60 segundos** en responder mientras el contenedor arranca — esto es esperado y no es una falla de la app.

Este README documenta los pasos; no se ejecutó ningún despliegue real como parte de esta tarea.
