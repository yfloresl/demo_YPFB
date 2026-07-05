# PROMPT PARA CLAUDE CODE — "DuctoVision Bolivia" v2 (YPFB Transporte)
# Demo-simulador de transporte de hidrocarburos por ductos para toma de decisiones

> USO: crea una carpeta vacía, copia dentro la carpeta `data/` (sistemas.json, estaciones.json, pozos.json, proyectos_inversion.json), abre Claude Code y pega TODO este archivo como primer mensaje. Trabaja por etapas en el orden de la sección 12 y compacta contexto entre etapas para optimizar tokens.

---

## 1. ROL, OBJETIVO Y REFERENTE DE DISEÑO

Actúa como un equipo full-stack senior (arquitecto, frontend, backend, analista energético). Construye **DuctoVision Bolivia**: una plataforma web demo, en español, que es a la vez (a) un visualizador de la red completa de ductos de YPFB Transporte y subsidiarias, y (b) un **simulador estructurado de cálculos** hidráulicos, de capacidad y financieros para decisiones de transporte, inversión, interconexión de pozos y factibilidad de estaciones.

**Referente de diseño:** el patrón de plataforma integrada tipo "MineOps 360" (https://360-integrated-minin-t43c.bolt.host/): sidebar lateral izquierdo oscuro con módulos e íconos, barra superior con título del módulo y KPIs, área de contenido con tarjetas, mapa operativo central y simulación de escenarios. Replica ese patrón de navegación y densidad de información, no su contenido.

**Naturaleza de los datos (obligatorio comunicar):** infraestructura de fuentes públicas y referencial; trazados aproximados; series, finanzas y proyecciones simuladas determinísticamente. Banner fijo en el footer: "Demo con datos referenciales y simulados — no representa información oficial de YPFB Transporte S.A."

## 2. STACK (no negociable)

- Monorepo: `client/` (React 18 + Vite + Tailwind CSS + React Router + react-leaflet + Recharts) y `server/` (Node 20 + Express).
- Express sirve `/api/*` y el build de `client/dist` en producción (un solo Web Service para Render free).
- Sin base de datos: JSON en `server/data/` + generación determinística en memoria al arranque (PRNG mulberry32, semilla 20260704).
- Idioma UI: español. Números formato es-BO (miles con punto, decimales con coma) mediante `Intl.NumberFormat('es-BO')`.

## 3. DATOS DE ENTRADA (copiar a server/data/ — fuente de verdad, NO inventar entidades)

- `sistemas.json`: 32 ductos individuales (14 gasoductos incl. GTB/GASYRG y derivadas, 13 oleoductos del registro ANH incl. propanoducto PRSZ, 5 poliductos) con id, tipo, mercado, operador, tramo, longitud, diámetros, capacidad+unidad, productos, año, estado y polilínea de coords.
- `estaciones.json`: catálogo de 55 estaciones (17 compresión, 18 bombeo, 20 poliductos) con tipo, sistema asociado, depto, coords, potencia HP o capacidad BPD, año, fuente (publica|referencial); criterios de scoring con pesos; 12 scores curados; regla para generar los demás.
- `pozos.json`: 40 pozos/clusters del PRU y operadoras privadas con categoría (descubrimiento|desarrollo|perforacion|programado|estratigrafico|negativo), tipo de hidrocarburo, producción potencial, coords, corredor, distancia a red, diámetro sugerido, terreno, CAPEX de interconexión y prioridad; más 4 corredores de interconexión (Norte, Boomerang, Chuquisaca, Chaco).
- `proyectos_inversion.json`: parámetros financieros globales (tasa 10%, vida 25 años, OPEX 3,5% CAPEX, CAPEX unitario por pulgada-km por terreno, factor de ruta 1,25, tarifas de referencia) y 5 macroproyectos con fases, CAPEX y escenarios ROI precargados.

## 4. MOTOR DE CÁLCULO (server/services/engine.js) — implementar EXACTAMENTE estas fórmulas

Documenta cada fórmula en JSDoc y expórtalas puras (testeables).

**4.1 Capacidad de gasoducto — Weymouth simplificado (unidades de campo):**
`Q = 433.5 * (Tb/Pb) * d^(8/3) * sqrt((P1^2 - P2^2) / (G * Tf * L * Z)) * E`
Q en pcd; Tb=520 °R; Pb=14.7 psia; d=diámetro interno pulg (usar nominal - 0.5"); P1,P2 presiones psia (defaults 1200/600); G=0.65; Tf=530 °R; L=millas (km*0.621371); Z=0.88; E=eficiencia 0.92. Devolver en MMpcd y MMm³/d (1 m³ = 35.3147 pc).

**4.2 Capacidad de líquidos — Hazen-Williams (agua eq.) con corrección por viscosidad:**
`Q_bpd = 0.148 * C * d^2.63 * (ΔP_psi_por_milla)^0.54` con C=120 (acero), luego `Q_producto = Q_bpd * f_visc` donde f_visc: crudo liviano 0.85, crudo reconstituido 0.75, refinados 0.95, GLP 1.0. Default ΔP=25 psi/milla.

**4.3 CAPEX de ducto nuevo:** `CAPEX = diámetro_pulg × longitud_km × costo_unitario(terreno) × factor_ruta(1.25 si la longitud viene de distancia geodésica; 1.0 si el usuario da longitud real)`. Distancia geodésica con Haversine.

**4.4 Financiero:** flujo anual `F_t = Ingresos_t − OPEX_t` con `Ingresos = volumen_diseño × utilización × tarifa × factor_conversión_anual` (MMpcd→MPC/año ×365×1000; MMm³/d→MPC/año ×365×35.3147×1000/1000; BPD→bbl/año ×365). CAPEX en año 0 (o por fases en años 0-2 si hay fases). Calcular: **VAN** (tasa parametrizable, default 10%), **TIR** (bisección entre −50% y 100%, tolerancia 1e-6), **payback simple y descontado**, **LCOT** (costo nivelado de transporte = (CAPEX anualizado + OPEX) / volumen anual, en US$/MPC o US$/bbl).
**4.5 Sensibilidad:** matriz 5×5 de TIR variando tarifa {−20,−10,0,+10,+20}% × utilización {−20,−10,0,+10,+20}%.
**4.6 Ranking de pozos:** `indice = (gas_mmpcd + liquidos_bpd/500) / capex_interconexion` × factor de categoría (descubrimiento 1.0, desarrollo 1.0, perforacion 0.8, programado 0.55, estratigrafico 0.35, negativo 0) ; ordenar descendente; exponer USD MM por MMpcd equivalente y TIR por pozo (usar 4.4 con tarifa del producto dominante).
**4.7 Scoring de estaciones:** score = Σ(sub_score_i × peso_i). Sub-scores de los 12 curados vienen del JSON; para el resto generarlos determinísticamente en [30,95] correlacionados con la utilización del ducto asociado. Recomendación: ≥70 mantener, 55-69 optimizar, <55 evaluar standby.
**4.8 Series históricas 2018-01→2025-12 por ducto:** volumen = capacidad × utilización_base × (1+tendencia)^años × estacionalidad × (1+ruido±6%). Utilización base/tendencia: gas exportación 55%/−4% anual; gas interno 68%/0% con +8% mayo-agosto; oleoductos 52%/−3%; poliductos 84%/+2%. Desde 2025-04, GSCY, GASYRG y GTB suman gas en tránsito: rampa 1,5→4,5 MMm³/d en 6 meses. Ingresos = volumen × tarifa del mercado del ducto.
**4.9 Proyecciones 2026-01→2035-12, 3 escenarios:** base = tendencia + Mayaya entra 2028 con rampa 2→10 MMm³/d en 3 años (suma al GAA y al corredor Norte) + SIT consolidado en 8 MMm³/d hacia 2030; conservador = base ×0.75 sin Mayaya hasta 2031; optimista = base ×1.20 con Mayaya desde 2027. Marcar por ducto el primer año con utilización >90% ("requiere expansión").

## 5. API REST (server/routes/, prefijo /api) — contratos

GET `/red/resumen` → `{ km:{total,gas,oleo,poli}, ductos:n, estaciones:{compresion,bombeo,poliducto}, potencia_hp, utilizacion_promedio_pct, ingresos_anualizados_usd_mm, volumen_ultimo_mes }`
GET `/ductos` → lista resumida; GET `/ductos/:id` → ficha + serie histórica + proyecciones (3 escenarios) + capacidad Weymouth/HW teórica vs declarada.
GET `/ductos/:id/series?metrica=volumen|ingresos&escenario=base|conservador|optimista`
GET `/estaciones` → catálogo completo con score y recomendación; GET `/estaciones/:id` → ficha + sub-scores + estaciones del mismo sistema.
GET `/pozos?corredor=&categoria=` → cartera con ranking, índice, USD/MMpcd y TIR; GET `/corredores` → 4 corredores con agregados (CAPEX total, volumen incorporable, TIR agregada).
GET `/proyectos` y `/proyectos/:id` → ficha + flujo de caja 25 años por escenario + sensibilidad 5×5 + LCOT.
POST `/simulador/gas` body `{diametro_pulg, longitud_km, p1_psia?, p2_psia?, eficiencia?}` → capacidad MMpcd/MMm³d + supuestos usados.
POST `/simulador/liquidos` body `{diametro_pulg, dp_psi_milla?, producto}` → BPD.
POST `/simulador/financiero` body `{capex_usd_mm | (diametro,longitud,terreno), volumen:{tipo:'gas'|'liquidos', valor, unidad}, utilizacion_pct, tarifa, tasa_pct?, horizonte?, opex_pct?}` → `{van, tir, payback, payback_desc, lcot, flujo:[{anio, ingreso, opex, neto, acumulado}], sensibilidad}`.
POST `/simulador/nuevo-ducto` body `{origen:{lat,lng}|nodo_id, destino:{...}, tipo, volumen_objetivo, terreno}` → longitud (Haversine×1.25), diámetro sugerido (menor diámetro comercial de {4,6,8,10,12,16,20,24,32} cuya capacidad 4.1/4.2 ≥ volumen objetivo), CAPEX, financiero completo (usa tarifa según tipo).
POST `/simulador/estacion-standby` body `{estacion_id, reduccion_capacidad_pct?}` → impacto en capacidad del sistema, ahorro OPEX anual estimado (2,2% del CAPEX equivalente de la estación, simulado), nuevo score y advertencias.
Errores uniformes `{error}`, validación de body con mensajes claros, CORS, compression.

## 6. FRONTEND — LAYOUT (patrón MineOps 360)

- **Sidebar izquierdo fijo** (w-64, colapsable a íconos w-16; en móvil se oculta y se abre como drawer con hamburguesa): fondo `#0b1220`, texto slate-300, ítem activo con barra de acento y fondo `#12203a`. Módulos con íconos lucide-react: Dashboard (LayoutDashboard), Mapa (Map), Simulador (Calculator), Proyecciones (TrendingUp), Inversiones (Landmark), Pozos (Fuel/Drill), Estaciones (Factory).
- **Topbar**: título del módulo, chips de contexto (fecha simulada, escenario activo global), botón de escenario (conservador/base/optimista) persistente en un React Context que afecta a todas las vistas.
- Contenido claro: fondo `#f8fafc`, tarjetas blancas `rounded-2xl shadow-sm border border-slate-200`.
- Colores de dominio: gasoductos `#dc2626`, oleoductos `#16a34a`, poliductos `#2563eb`, propuestas/inversión `#d97706` (dash), acento UI `#0e7490`. Tipografía Inter.
- Footer con disclaimer en todas las vistas.

## 7. ESPECIFICACIÓN CARTOGRÁFICA (aplica a Mapa, Inversiones y Simulador de nuevo ducto)

- Leaflet, tiles OSM estándar + selector de fondo "Claro | Oscuro" (CartoDB positron / dark_matter). Centro (−17.0, −64.5), zoom 6, `maxBounds` Bolivia ampliado.
- **Simbología de ductos:** polilíneas color por tipo; **grosor = 1.5 + diámetro_pulg × 0.18 px**; opacidad 0.85; propuestas en dash "8 6" ámbar. **Modo de color alternativo "Utilización"** (toggle en la leyenda): degradado verde `<60%`, amarillo `60-85%`, rojo `>85%` sobre la utilización del último mes.
- **Sentido de flujo:** triángulos SVG decorativos cada ~80 px a lo largo de la línea (implementa un componente propio con `L.polylineDecorator` de leaflet-polylinedecorator, o triángulos calculados en puntos intermedios si prefieres no añadir la dependencia — decide y documenta).
- **Estaciones:** circleMarker; compresión ▲ (triángulo divIcon), bombeo ● , poliducto ■ ; tamaño 8-12 px; color del sistema; tooltip nombre+tipo.
- **Pozos:** divIcon 🛢 con halo por categoría (verde descubrimiento/desarrollo, azul perforación, gris programado/estratigráfico, rojo negativo).
- **Control de capas propio** (panel flotante): checkboxes Gasoductos/Oleoductos/Poliductos/Estaciones (por subtipo)/Pozos (por categoría)/Corredores/Proyectos. **Leyenda flotante** siempre visible con simbología y modo de color. **Buscador** con autocompletado de ducto/estación/pozo que hace flyTo y abre su ficha.
- **Interacción:** hover=tooltip; click en ducto → resalta (grosor+2, resto opacidad 0.25) y abre panel lateral derecho (drawer inferior 60vh en móvil) con ficha completa: tramo, longitud, diámetros, capacidad declarada vs teórica (Weymouth/HW), barra de utilización, productos, estaciones del ducto (lista clickeable), sparkline 12 meses, botones "Proyecciones" y "Simular expansión" (lleva al Simulador con datos precargados).
- Controles: zoom, escala métrica, botón fullscreen, botón "recentrar Bolivia".

## 8. MÓDULOS (7 vistas React Router)

**/ Dashboard**: 8 KPIs (km total, km por tipo ×3, nº estaciones, volumen gas último mes, volumen líquidos último mes, ingresos anualizados); área apilada de volumen por sistema 2022-2025; barras top-8 ductos por ingresos; tarjeta SIT con mini-serie del gas en tránsito; tabla "Alertas de decisión" (estaciones score<55, ductos util<35% o >85%, pozos prioridad 1 sin conectar) con links a los módulos.

**/mapa**: sección 7 a pantalla completa del área de contenido.

**/simulador** (corazón del demo; tabs):
1. *Capacidad de gas*: formulario (diámetro select comercial, longitud, presiones, eficiencia) → resultado grande MMpcd/MMm³d + tabla de supuestos + comparación con ductos reales similares.
2. *Capacidad de líquidos*: formulario análogo (producto, ΔP) → BPD.
3. *Evaluación financiera*: formulario completo (CAPEX manual o calculado por diámetro/longitud/terreno; volumen; utilización slider; tarifa select con las 5 de referencia o personalizada; tasa; horizonte) → tarjetas VAN/TIR/payback/LCOT + gráfico de flujo acumulado + matriz de sensibilidad 5×5 con semáforo (TIR ≥12% verde, 8-12% amarillo, <8% rojo).
4. *Nuevo ducto en el mapa*: mapa donde el usuario hace click en origen y destino (o elige nodos de la red en dropdowns) → línea propuesta dibujada, longitud, diámetro sugerido, CAPEX y KPIs financieros; botón "Guardar escenario" (estado en memoria) y tabla comparativa de escenarios guardados (nombre editable, longitud, Ø, CAPEX, TIR, VAN, LCOT) exportable a CSV (client-side).
5. *Standby de estación*: selector de estación → impacto (capacidad del sistema afectado, ahorro OPEX, score recalculado, advertencia si la estación es crítica).
Cada tab muestra las fórmulas usadas en un `<details>` "Ver metodología".

**/proyecciones**: selector ducto/red + métrica + escenarios; línea histórica sólida + 3 proyecciones (base sólida, otras punteadas), banda entre conservador y optimista, línea vertical "hoy"; tarjetas CAGR histórico/proyectado y año de expansión requerida; tabla de supuestos del escenario.

**/inversiones**: mapa con trazados propuestos + tarjetas de los 5 macroproyectos; al seleccionar: justificación, fases/CAPEX, flujo 25 años por escenario, TIR/VAN/payback/LCOT, sensibilidad 5×5. Botón "Abrir en simulador" precargando parámetros.

**/pozos**: mapa de la cartera + filtros (corredor, categoría, operador); tabla ordenable: pozo, operador, depto, categoría (chip de color), producción potencial, km a red, Ø, CAPEX, USD MM/MMpcd, TIR, prioridad; tarjetas de los 4 corredores con agregados; ficha de pozo con detalle e "interconexión sugerida" dibujada en el mapa (línea punteada al nodo de empalme). Incluir el caso Boyuy-X2 como recordatorio de riesgo exploratorio.

**/estaciones**: tabla completa de las 55 (filtros por tipo/sistema/recomendación; búsqueda); score con barra coloreada; chips mantener/optimizar/standby; al seleccionar: radar de 5 criterios, ficha (potencia/capacidad, año, sistema, fuente publica|referencial), botón "Simular standby". Panel de metodología con los pesos.

## 9. RESPONSIVE

Sidebar→drawer; KPIs 2 col; gráficos altura 220px; tablas overflow-x; mapa detalles como bottom-drawer; formularios del simulador en 1 columna; probar 375px y 1440px.

## 10. CALIDAD

Estructura `client/src/{components,pages,hooks,context,lib}` y `server/{routes,services,data}`. Componentes: KpiCard, ChartCard, ScenarioContext, MapBase, DuctoDrawer, SensitivityMatrix, FormulaDetails, DataTable (ordenable+filtrable reutilizable). README es en español con supuestos, fórmulas y capturas de estructura. Scripts raíz: `dev` (concurrently), `build`, `start`. `.gitignore` correcto. **Verificación obligatoria:** `npm run build` + `npm start` + curl a los 12 endpoints (incluye 1 POST por simulador) + revisar consola sin warnings + confirmar 32 ductos y 55 estaciones renderizados.

## 11. GIT Y DESPLIEGUE

Al final: `git init` + commit; instrucciones exactas para crear repo público en GitHub (gh CLI y manual) y push; despliegue en Render Web Service free (build `npm install && npm run build`, start `npm start`, Node 20) con recordatorio del sleep del plan free (~30-60 s el primer acceso).

## 12. PLAN DE ETAPAS (compactar contexto al cerrar cada una)

1) Estructura del monorepo + deps + datos copiados. 2) engine.js con las 9 familias de cálculo + tests rápidos por consola. 3) Rutas API + seriesGenerator. 4) Layout (sidebar/topbar/context de escenario) + Dashboard. 5) Mapa completo (sección 7). 6) Simulador (5 tabs). 7) Proyecciones + Inversiones. 8) Pozos + Estaciones. 9) Responsive + pulido visual. 10) Verificación, README, git, instrucciones de deploy.

## 13. CRITERIOS DE ACEPTACIÓN

- [ ] 7 módulos navegables desktop/móvil con patrón sidebar tipo MineOps 360.
- [ ] Mapa: 32 ductos, 55 estaciones, 40 pozos, 4 corredores, capas, leyenda, buscador, modo utilización, flechas de flujo, selección con ficha.
- [ ] Simulador: los 5 tabs calculan en backend con las fórmulas 4.1-4.7 y muestran metodología.
- [ ] Escenario global (context) afecta proyecciones, inversiones y dashboard.
- [ ] Series determinísticas; TIR/VAN del backend ≈ precargados del JSON (loguear diferencias).
- [ ] Comparador de escenarios de nuevo ducto con export CSV.
- [ ] Disclaimer permanente; build de producción OK; un solo servicio Express; README completo; repo listo.

Si algo queda ambiguo, decide con criterio profesional y documéntalo en README bajo "Supuestos". No pidas confirmaciones intermedias salvo bloqueo real.
