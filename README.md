# DuctoVision Bolivia

Plataforma web demo, en español, para visualización de la red de ductos de YPFB Transporte y subsidiarias, y simulación estructurada de cálculos hidráulicos, de capacidad y financieros para decisiones de transporte, inversión, interconexión de pozos y factibilidad de estaciones.

## ⚠️ Naturaleza de los datos (léase antes de usar)

**Esta versión usa el dataset REAL/referencial** compilado de fuentes públicas sobre YPFB Transporte S.A. y subsidiarias (`server/data/{sistemas,estaciones,pozos,proyectos_inversion}.json`), reemplazando la versión anterior generada por PRNG. Atribución (ver también el campo `_nota` de cada JSON):

- **`sistemas.json`** — Inventario de los 32 ductos de la red (14 gasoductos, 13 oleoductos, 5 poliductos). Compilado de YPFB Transporte, registros ANH, GTB/Transierra y prensa especializada 2024-2026. Trazados geográficos son aproximados.
- **`estaciones.json`** — Catálogo de los 55 sitios operativos (17 compresión, 18 bombeo, 20 poliductos). 12 estaciones tienen score de decisión **curado** (de fuente pública/estimación experta); las 43 restantes completan ubicaciones/atributos con datos referenciales y un score generado determinísticamente por el backend.
- **`pozos.json`** — Cartera de 40 pozos basada en anuncios públicos de YPFB Corporación (PRU 2021-2026, Rendición de Cuentas 2025) y operadoras privadas. Producción potencial, distancias, CAPEX y retornos de la mayoría de los pozos son **simulados** en rangos plausibles; 3 pozos (PZ38 Margarita-Huacaya, PZ39 Incahuasi, PZ40 Boyuy-X2) son referencias de pozos **ya conectados** (Boyuy-X2 se incluye explícitamente como caso de riesgo exploratorio/"lección aprendida", sin producción ni CAPEX aplicable).
- **`proyectos_inversion.json`** — 5 macroproyectos basados en anuncios públicos de YPFB Corporación (2024-2026: Mayaya, SIT/tránsito Argentina-Brasil, reversa OSSA-2, ampliación PCS, programa PRU) con supuestos financieros simulados.

**Esta demo no representa información oficial de YPFB Transporte S.A.**, ni sustituye estudios de ingeniería o factibilidad reales. Un banner fijo con esta advertencia aparece en el footer de todas las vistas.

`server/scripts/generar_datos.js` (el generador PRNG anterior) se conserva únicamente como **referencia histórica**; ya no produce los datos que usa la app (ver cabecera del archivo). La técnica de generación determinística de sub-scores de estaciones sin score curado sigue viva en `server/services/engine.js` (`subScoresDeterministicos`), ahora con los 5 criterios y pesos **reales** de `estaciones.json`.

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
│   ├── services/       # engine.js (fórmulas), estado.js (cache derivada), datos.js (loader + normalizador del dataset real), prng.js
│   ├── data/            # sistemas.json, estaciones.json, pozos.json, proyectos_inversion.json (dataset REAL, fuentes públicas)
│   └── scripts/generar_datos.js   # histórico, ya no genera server/data/*.json
├── docs/                # PROMPT_CLAUDE_CODE.md y docx de origen del proyecto
└── package.json         # scripts raíz (dev/build/start)
```

## Fórmulas implementadas (server/services/engine.js)

1. **Capacidad de gasoducto (Weymouth simplificado)**: `Q = 433.5 × (Tb/Pb) × d^(8/3) × √((P1²−P2²)/(G×Tf×L×Z)) × E`
2. **Capacidad de líquidos (Hazen-Williams + viscosidad)**: `Q_bpd = 0.148 × C × d^2.63 × (ΔP)^0.54 × f_visc`
3. **CAPEX de ducto nuevo**: `diámetro × longitud_km × costo_unitario(terreno) × factor_ruta`
4. **Financiero**: VAN, TIR (bisección −50%/+100%, tolerancia 1e-6), payback simple/descontado, LCOT.
5. **Sensibilidad**: matriz 5×5 de TIR (tarifa × utilización, ±20/±10/0%).
6. **Ranking de pozos**: índice ponderado por categoría, USD MM/MMpcd equivalente, TIR por pozo.
7. **Scoring de estaciones**: score ponderado con los pesos reales de `estaciones.json` (criticidad 30%, utilización 25%, costo de mantenimiento 15%, integridad 15%, demanda futura 15%). Para las 12 estaciones con score curado, el score final se toma tal cual del dataset (no se recalcula desde sub-scores).
8. **Series históricas** 2018-01 a 2025-12 y **proyecciones** 2026-01 a 2035-12 en 3 escenarios (base/conservador/optimista), determinísticas.

## API REST (prefijo `/api`)

`GET /red/resumen`, `GET|POST /ductos`, `GET /ductos/:id`, `GET /ductos/:id/series`, `GET /estaciones(/:id)`, `GET /pozos`, `GET /corredores`, `GET /proyectos(/:id)`, y los 5 simuladores: `POST /simulador/{gas,liquidos,financiero,nuevo-ducto,estacion-standby}`.

## Supuestos y decisiones (donde el mapeo del dataset real era ambiguo)

Estos son los mapeos aplicados en `server/services/datos.js` para normalizar el esquema real a la forma que ya esperaba el backend/frontend (ver también los comentarios de ese archivo):

- **Diámetro representativo**: los ductos reales traen un ARRAY de uno o más diámetros por reducciones de tramo (ej. GAA: `[10, 6]`). Se usa el **mayor** como diámetro representativo para capacidad teórica y grosor de línea en el mapa; el array completo se conserva en `diametros_pulg`.
- **Clasificación de mercado**: el string libre real (`"Interno Occidente"`, `"Exportación / SIT"`, etc.) se clasifica por substring de "Exportación" → `exportacion`/`interno`; el texto original se conserva en `mercado_detalle`.
- **Gas en tránsito SIT**: GSCY, GASYRG y GTB se marcan `transito_sit:true` y usan la tarifa `gas_transito_sit_usd_mpc` (distinta de la de exportación general que usa p.ej. GIJA); reciben además la rampa histórica 1,5→4,5 MMm3/d (abr-oct 2025) y la consolidación a 8 MMm3/d hacia 2030 en las proyecciones. GAA recibe por separado la rampa del macroproyecto Mayaya (2→10 MMm3/d en 3 años desde 2028, variable por escenario).
- **Productos → factor de viscosidad/tarifa**: los productos reales son texto libre en español ("crudo reconstituido", "diésel", "jet fuel", "GLP", "propano", "kerosene"); se normalizan por coincidencia de substring a las claves del motor de Hazen-Williams.
- **Estaciones — `sistema` múltiple**: cuando el campo trae varios códigos separados por "/" (ej. "GCY/GCC") se usa el primero como `sistema_id` principal para correlacionar utilización.
- **Scoring de estaciones curadas**: para las 12 con score curado, el score y la recomendación final se toman tal cual de `scores_curados`; los 5 sub-scores igual se generan determinísticamente (banda [30,95], correlacionados con la utilización real curada) solo para poder mostrar el radar de la ficha — el score ponderado de esos sub-scores generados **no** es el que se reporta como final.
- **Pozos ya conectados (capex = 0)**: PZ38, PZ39 y PZ40 se marcan `ya_conectado:true` y **no se rankean numéricamente** (`indice: null`, sin división por cero) pero sí se incluyen en `/api/pozos` con su `nota` — Boyuy-X2 (PZ40) es explícitamente un caso de riesgo exploratorio, sin producción ni TIR aplicable.
- **Corredor de un pozo**: se normaliza al *nombre* del corredor (no al id) para poder cruzarlo directamente con `corredores[].nombre`, que es como el frontend ya filtraba.
- **CAPEX total de corredor**: troncal (`capex_troncal_usd_mm`) + suma de interconexión de sus pozos, **excluyendo** los ya conectados (no requieren nuevo CAPEX).
- **Proyectos sin desglose de fases** (INV-SIT, INV-REVERSA-OSSA2, INV-PCS-AMPL, INV-INTERCONEXION-PRU): se sintetiza una única fase en año 0 con el CAPEX total, para que el frontend (que siempre itera `detalle.fases`) no requiera cambios. INV-MAYAYA sí trae 3 fases reales, mapeadas a años 0/1/2.
- **Km de red y potencia instalada en `/red/resumen`**: se reportan los totales OFICIALES de `sistemas.json.resumen_red` (8.645 km, 65.412 HP), que **no coinciden exactamente** con la suma de los 32 ductos itemizados (~7.325 km) ni con la suma de las 17 estaciones de compresión (~82.400 HP) — es una inconsistencia propia del dataset real (el resumen agregado probablemente incluye ramales/equipos no desglosados individualmente). Ambas cifras se exponen: `km`/`potencia_hp` (oficiales) y `km_itemizado`/`potencia_hp_itemizado` (suma de los registros individuales).
- **VAN/TIR recalculado vs. `escenarios_roi` precargados**: el motor financiero (`evaluarFinanciero`) modela **un solo** volumen/tarifa por proyecto; los proyectos reales con múltiples flujos de ingreso (p.ej. INV-MAYAYA: gas + condensado) no capturan toda la economía del proyecto real, así que el recálculo diverge del `escenarios_roi` precargado (que sí viene de estimaciones más completas de YPFB/expertos). El endpoint `/api/proyectos/:id` expone ambos valores en `comparacion_vs_precargado` para que quede visible la brecha. En la verificación de esta tarea: INV-MAYAYA recalculado dio VAN ≈ -US$214MM / TIR ≈1,2% vs. precargado +US$112,4MM / 13,6% (probablemente por no incluir el ingreso de condensado); INV-SIT dio VAN ≈ +US$179MM / TIR ≈67% vs. precargado +US$48,9MM / 21,6% (el recálculo asume ingreso pleno desde el año 1, sin la rampa física que sí refleja el precargado).
- **Corrección de unidades**: se detectó y corrigió un bug preexistente en `volumenAnual`/`factorMensualIngreso` (`server/services/engine.js`): la conversión de `MMm3/d` a MPC/año omitía un factor ×1000, subvaluando 1000x los ingresos de cualquier sistema o proyecto denominado en MMm3/d (crítico para GTB, INV-MAYAYA e INV-SIT, que son justamente los del dataset real). Corregido antes de comparar VAN/TIR recalculado vs. precargado.
- **Terreno (CAPEX)**: costos unitarios y claves de terreno se alinearon a los reales de `proyectos_inversion.json` (`llano`/`pie_de_monte`/`montana_selva`: 45.000/62.000/85.000 USD por pulgada-km), reemplazando las claves inventadas (`llano`/`selva`/`montania`) de la versión generada.
- **Tarifa GLP**: el dataset real no trae una tarifa de líquidos separada para GLP; se reutiliza `liquidos_usd_bbl` también para `glp` (documentado en el propio JSON de origen, sección `nota_tarifas`).
- **Ingresos anualizados del dashboard**: se estiman a partir de la serie histórica mensual multiplicada por 12 (proxy simplificado), no de un cálculo contable real.
- **`volumen_ultimo_mes` en `/red/resumen`**: suma de unidades heterogéneas (MMpcd + BPD) como indicador agregado de actividad, no una magnitud físicamente homogénea.
- **Tarifa dominante por pozo** (para TIR de ranking): se usa gas interno o crudo según cuál volumen equivalente (gas_mmpcd vs líquidos_bpd/500) sea mayor.
- **Escenario global (React Context)** afecta Proyecciones, Inversiones y las proyecciones referenciadas desde Dashboard.
- **Mapa de Inversiones**: los 5 trazados propuestos son aproximaciones visuales, dibujados a mano como polilíneas punteadas ámbar — no georreferenciación de ingeniería.
- **Flechas de flujo**: implementadas con triángulos SVG en `components/FlowArrows.jsx` (sin `leaflet-polylinedecorator`).
- **Documentación de origen**: `docs/PROMPT_CLAUDE_CODE.md` y `docs/Demo_YPFB_Transporte_DuctoVision_v2.docx` se movieron de la raíz a `docs/` por prolijidad; los 4 JSON reales viven únicamente en `server/data/` (no se duplican en la raíz del repo).

## Desarrollo local

```bash
npm install
npm run dev          # levanta server (puerto 4000) y client (puerto 5173) con proxy /api
# npm run gen:data:historico  # NO ejecutar: sobrescribiría server/data/*.json (reales) con datos simulados de referencia histórica
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

## Despliegue en Coolify (Dockerfile)

El repo incluye un `Dockerfile` multi-stage en la raíz (build de `client/` con Vite en un stage separado, luego runtime Node 20-alpine con Express sirviendo `/api/*` + `client/dist`). Coolify lo detecta automáticamente al apuntar a este repositorio.

1. En Coolify, crear una nueva **Application** → **Public/Private Repository** (o GitHub App) apuntando a `yfloresl/demo_YPFB`, rama a desplegar (`main` o la rama de trabajo).
2. **Build Pack**: `Dockerfile` (Coolify lo detecta al encontrar `Dockerfile` en la raíz; no usar Nixpacks para evitar ambigüedad con el monorepo `client/`+`server/`).
3. **Puerto expuesto**: `4000` (definido en el `Dockerfile` con `EXPOSE 4000`; Coolify lo mapea automáticamente a su proxy/dominio).
4. **Variables de entorno**: ninguna obligatoria. Opcionalmente fijar `PORT=4000` si Coolify no lo inyecta por defecto (el server ya usa `process.env.PORT || 4000`).
5. Deploy. El build corre ambos `npm install` (client y server) dentro de la imagen — no requiere ejecutar `npm run build` manualmente antes.
6. Sin base de datos ni volúmenes persistentes requeridos (dataset estático en `server/data/*.json`, incluido en la imagen).
