# Implementation Plan: Dashboard de Mapa de Calor NFL

## Overview

Se implementa el dashboard en `dashboard/` con TypeScript, de lo más interno a lo más externo: configuración, lógica pura (`lib/`), validación y mocks, Api_Client, estado, componentes y, al final, el cableado en `App.tsx`. Cada paso se integra con el anterior y no queda código huérfano.

Restricciones que aplican a todas las tareas:

- No se instala ninguna dependencia (ni vitest ni fast-check ni otras). No se modifican `dependencies` ni `devDependencies` de `dashboard/package.json`; solo se agrega el script npm `verify`.
- Las propiedades se verifican con el script propio `dashboard/src/verify/properties.ts`, con un generador pseudoaleatorio con semilla (`mulberry32`) y un ayudante `check(n, titulo, fn)` de al menos 100 casos. Se ejecuta con `npm run verify` (Vite empaqueta el script y Node lo ejecuta).
- Reglas de `.kiro/steering/rules.md`: rutas relativas sin diagonal inicial (`fetch('api/...')`), sin `localhost`, `127.0.0.1` ni URLs absolutas en `dashboard/src/`; Tailwind 3 (`@tailwind base/components/utilities`, nunca `@import "tailwindcss"` ni `@theme`); `base: './'` y proxy de `/api` hacia `http://localhost:8000` solo en `vite.config.ts`; no mover `.hackathon/`, `.venv/` ni `.kiro/`; todos los textos visibles en español.
- Las tareas marcadas con `*` (verificación de propiedades y pruebas de ejemplo) son opcionales. Cada propiedad es una función en `properties.ts` con el comentario `Feature: nfl-heatmap-dashboard, Property {n}: {texto}`.
- La implementación termina con `npm run build` sin errores y `npm run dev` iniciando sin errores (tarea 9). El servidor de desarrollo lo ejecuta el usuario manualmente si el agente no puede dejarlo en segundo plano.

## Tasks

- [x] 1. Configuración base y tipos compartidos
  - [x] 1.1 Configurar Vite, scripts y `.gitignore`
    - En `dashboard/vite.config.ts` conservar `base: './'` y agregar `server: { proxy: { '/api': 'http://localhost:8000' } }`
    - En `dashboard/package.json` agregar solo el script `"verify": "vite build --ssr src/verify/properties.ts --outDir .verify && node .verify/properties.js"`, sin tocar dependencias
    - Agregar `.verify/` al `.gitignore` de la raíz (o de `dashboard/`)
    - Confirmar que `tsconfig.json` ya tiene `resolveJsonModule` activo
    - _Requirements: 1.4, 10.1, 10.2, 10.4_

  - [x] 1.2 Crear tipos, textos en español, capas y opciones de filtros
    - Crear `src/types.ts` con el contrato de datos del diseño (`Layer`, `FilterState`, `Meta`, `GridCell`, `TopPlayer`, `HeatmapResponse` con `yards_by_down?`, `ApiResult`, `DataSource`, etc.)
    - Crear `src/i18n/es.ts` con todos los textos visibles (etiquetas, mensajes de error, "Datos simulados", "Sin datos", "N/D", "Reintentar", "Sin jugadores destacados", etc.)
    - Crear `src/lib/layers.ts` con nombre en español y etiqueta de métrica de las 4 capas (etiquetas distintas)
    - Crear `src/lib/filters.ts` con las opciones fijas de Down, Formación, Cobertura y Resultado, el filtro vacío y `EMPTY_FILTERS`
    - _Requirements: 6.1, 6.5, 7.2, 7.3, 7.4, 7.5, 10.5_

  - [x] 1.3 Crear PRNG y base del script de verificación
    - Crear `src/mocks/prng.ts` con `hash32` (FNV-1a de 32 bits) y `mulberry32`
    - Crear `src/verify/properties.ts` con `SEED = 12345` (configurable por variable de entorno), el ayudante `check(n, titulo, fn)` (mínimo 100 casos, informa semilla, caso y entrada, sin reducción de contraejemplos), generadores básicos (`genLayer`, `genFilterState`, `genMeta` con variantes inválidas) y salida con código distinto de 0 si una propiedad falla
    - El script no se importa desde `main.tsx`
    - _Requirements: 10.2_

- [x] 2. Lógica pura de presentación
  - [x] 2.1 Implementar la escala de color (`src/lib/color.ts`)
    - `COLOR_STOPS` (traslúcido 0, amarillo 0.33, naranja 0.66, rojo 1), `clamp01` (NaN a 0), `intensityToRgba`, `intensityToCss`, `legendGradientStops`
    - Intensidad 0 produce alfa exactamente 0
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.7_

  - [ ]* 2.2 Verificar Propiedad 6 en `properties.ts`
    - **Property 6: Escala de color monótona en opacidad**
    - **Validates: Requirements 4.7**

  - [ ]* 2.3 Verificar Propiedad 7 en `properties.ts`
    - **Property 7: Interpolación, recorte y valor cero del color**
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [x] 2.4 Implementar la geometría del campo (`src/lib/fieldGeometry.ts`)
    - Constantes `FIELD_W`, `FIELD_H`, `CELL_W`, `CELL_H`, `yardLineXs` (21 líneas), `yardNumbers`, `hashMarks()` (filas a 23.58 y 29.72), `cellRect`, `fieldSize(containerWidth)` (ancho mínimo 320, alto = ancho × 53.3 / 120)
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.7, 3.8, 4.1_

  - [ ]* 2.5 Verificar Propiedad 8 en `properties.ts`
    - **Property 8: Las celdas embaldosan el campo sin solaparse**
    - **Validates: Requirements 4.1**

  - [ ]* 2.6 Verificar Propiedad 9 en `properties.ts`
    - **Property 9: Tamaño del campo conserva la proporción**
    - **Validates: Requirements 3.1, 3.7, 3.8**

  - [x] 2.7 Implementar tooltip y formato (`src/lib/tooltip.ts`, `src/lib/format.ts`)
    - `tooltipPosition(cursor, tip, box, offset = 12, margin = 4)` con acotamiento por eje
    - `formatCellTooltip(cell, layer)` con 1 decimal y "Sin datos" para 0 jugadas
    - `formatKpis(meta)` con cinco tarjetas (entero, 1 decimal, 2 decimales, "N/D" por campo inválido)
    - `toBarData(yards_by_down?)` con máximo 4 downs ordenados, sin duplicados
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 6.5, 8.1, 8.3, 8.4, 8.6_

  - [ ]* 2.8 Verificar Propiedad 10 en `properties.ts`
    - **Property 10: Posición del tooltip**
    - **Validates: Requirements 5.1, 5.4, 5.7**

  - [ ]* 2.9 Verificar Propiedad 11 en `properties.ts`
    - **Property 11: Contenido del tooltip**
    - **Validates: Requirements 5.2, 5.3, 6.5**

  - [ ]* 2.10 Verificar Propiedad 12 en `properties.ts`
    - **Property 12: Formato de KPIs**
    - **Validates: Requirements 8.1, 8.3**

  - [ ]* 2.11 Verificar Propiedad 13 en `properties.ts`
    - **Property 13: Datos de la gráfica por down**
    - **Validates: Requirements 8.4, 8.6**

  - [x] 2.12 Implementar perspectivas (`src/lib/insights.ts`, `src/lib/players.ts`)
    - `coachRecommendation(filters, meta)` determinista, 1 a 3 frases, máximo 300 caracteres, `null` si `meta` es inválido
    - `broadcastSummary(meta)` de una frase, máximo 200 caracteres, con `total_plays` entero, `avg_yards` y `completion_pct` con 1 decimal
    - `visiblePlayers` (máximo 20) y `sortPlayers(players, dir)` que devuelve una copia ordenada
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.9_

  - [ ]* 2.13 Verificar Propiedad 14 en `properties.ts`
    - **Property 14: Recomendación del Coach**
    - **Validates: Requirements 9.2, 9.3, 9.9**

  - [ ]* 2.14 Verificar Propiedad 15 en `properties.ts`
    - **Property 15: Resumen del Broadcaster**
    - **Validates: Requirements 9.6**

  - [ ]* 2.15 Verificar Propiedad 16 en `properties.ts`
    - **Property 16: Tabla del Scout**
    - **Validates: Requirements 9.4, 9.5**

- [x] 3. Validación del contrato y datos simulados
  - [x] 3.1 Implementar el validador (`src/lib/validate.ts`)
    - `validateHeatmapResponse(x, layerLabel?)` y `validateMockFile(m)` que devuelven `ContractError[]` con `path` que identifica capa y celda o jugador
    - Comprobar tipos de `meta`, 240 celdas únicas en la rejilla esperada, rangos de `intensity` y `success_rate`, `plays_count` entero ≥ 0, 10 a 50 jugadores con las seis posiciones, Σ `plays_count` ≤ `total_plays` e intensidades distintas entre capas; sin modificar la entrada
    - _Requirements: 1.10, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 3.2 Verificar Propiedad 1 en `properties.ts`
    - Agregar `genGridCell`, `genTopPlayers`, `genHeatmapResponse` (válida) y `genMutation` (una mutación por caso)
    - **Property 1: Validador del contrato identifica violaciones**
    - **Validates: Requirements 1.10, 2.1, 2.8**

  - [x] 3.3 Crear `src/mocks/heatmapMock.json`
    - Generar con un script temporal (que se elimina al terminar) un `MockFile` con `filters.teams` y cuatro capas de 240 celdas con forma espacial distinta, 10 a 50 jugadores con QB, WR, TE, RB, CB y S, `yards_by_down` y `total_plays` con margen suficiente sobre la suma de cada capa
    - Comprobar el resultado con `validateMockFile` sin errores
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.10_

  - [x] 3.4 Implementar el motor de mocks (`src/mocks/mockEngine.ts`)
    - `normalizeFilters` (dimensión completa equivale a vacía, sin duplicados en equipos con orden de primera aparición), `buildMockResponse(f, layer)` determinista según el algoritmo del diseño, y `getMockFilters()`
    - Con filtros vacíos devuelve la base de la capa sin cambios
    - Si hay colisiones de hash que dejen KPIs o celdas sin cambio, agregar sal por dimensión
    - _Requirements: 2.7, 7.1, 7.8, 7.9, 7.10, 7.11_

  - [ ]* 3.5 Verificar Propiedad 2 en `properties.ts`
    - **Property 2: La salida del motor de mocks cumple el contrato e invariantes**
    - **Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.7**

  - [ ]* 3.6 Verificar Propiedad 3 en `properties.ts`
    - **Property 3: La rejilla de cada capa es completa y sin duplicados**
    - **Validates: Requirements 2.2**

  - [ ]* 3.7 Verificar Propiedad 4 en `properties.ts`
    - **Property 4: El mock es determinista y depende de cada filtro**
    - **Validates: Requirements 7.11**

  - [ ]* 3.8 Verificar Propiedad 5 en `properties.ts`
    - **Property 5: Normalización de filtros**
    - **Validates: Requirements 7.1, 7.8, 7.9**

- [x] 4. Cliente de datos (Api_Client)
  - [x] 4.1 Implementar `src/services/api.ts`
    - `USE_MOCK = true`, `getFilters()`, `getHeatmap(f, layer)`, `buildHeatmapUrl`, `parseHeatmapUrl`
    - Con `USE_MOCK = true` no llama a `fetch`; con `false` usa `fetch` con `AbortController` (10 s heatmap, 5 s filtros), valida con `validateHeatmapResponse` y ante cualquier fallo devuelve el mock con `source = 'mock'` sin lanzar excepciones
    - Rutas relativas `api/filters` y `api/heatmap` sin diagonal inicial, sin `localhost` ni `://`; `fetch` y plazo inyectables para pruebas
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 1.10, 7.10_

  - [ ]* 4.2 Verificar Propiedad 17 en `properties.ts`
    - Usar un `fetch` simulado inyectable y un plazo reducido, sin dependencias
    - **Property 17: Api_Client con respaldo**
    - **Validates: Requirements 1.6, 1.7, 1.8, 1.10**

  - [ ]* 4.3 Verificar Propiedad 18 en `properties.ts`
    - **Property 18: URL de la API relativa y reversible**
    - **Validates: Requirements 1.2, 1.3**

- [x] 5. Estado del dashboard
  - [x] 5.1 Implementar el reductor (`src/state/dashboardReducer.ts`)
    - Estado inicial (`layer: 'targets'`, `perspective: 'coach'`), acciones `SET_FILTERS`, `RESET_FILTERS`, `SELECT_LAYER`, `SELECT_PERSPECTIVE`, `REQUEST`, `SUCCESS`, `FAILURE`, `RETRY`
    - La capa solicitada solo pasa a activa tras `SUCCESS`; las respuestas con `id` obsoleto se ignoran; `FAILURE` conserva `data`, `layer` y `filters`; `SELECT_PERSPECTIVE` no toca los filtros
    - _Requirements: 6.2, 6.3, 6.4, 6.7, 7.6, 7.7, 7.9, 9.1, 9.8, 10.8, 10.9_

  - [ ]* 5.2 Verificar Propiedad 19 en `properties.ts`
    - **Property 19: Reductor del dashboard**
    - **Validates: Requirements 6.2, 6.4, 6.7, 7.6, 7.7, 9.8**

  - [x] 5.3 Implementar el hook `src/state/useDashboard.ts`
    - Carga inicial de filtros y datos, efectos que llaman al Api_Client con contador de solicitudes, `filterNotice` ante opciones de respaldo, `retry`
    - _Requirements: 1.9, 1.11, 6.2, 6.6, 7.6, 7.10, 10.8, 10.9_

- [x] 6. Checkpoint - Verificar lógica y datos
  - Ejecutar `npm run typecheck` y, si se hicieron las tareas opcionales de propiedades, `npm run verify`. Ensure all tests pass, ask the user if questions arise.

- [x] 7. Componentes de interfaz
  - [x] 7.1 Crear `FieldMarkings`, `ColorLegend` y `HeatCells`
    - `FieldMarkings`: fondo, dos end zones de 10 yardas con color distinto, 21 líneas, números 10 a 50 a 10, hash marks y flecha hacia la derecha, en SVG con coordenadas en yardas
    - `HeatCells`: un `<rect>` por celda con `cellRect` y `intensityToCss`
    - `ColorLegend`: gradiente SVG con `legendGradientStops` y etiquetas "0" y "1"
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 7.2 Crear `CellTooltip` y `FootballFieldHeatmap`
    - SVG con `viewBox="0 0 120 53.3"`, `width="100%"`, contenedor con `overflow-x-auto` y ancho mínimo 320 px
    - Tooltip con `onMouseMove`, `mouseenter` y `mouseleave`, medido con `ref` y posicionado con `tooltipPosition`; indicador de carga sobre el campo
    - _Requirements: 3.1, 3.7, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.5, 6.6_

  - [x] 7.3 Crear `FilterPanel` y `LayerSelector`
    - Cinco filtros de selección múltiple (sin selección equivale a todas las opciones), botón "Restablecer", aviso de opciones de respaldo
    - Selector de exactamente 4 capas con `aria-pressed` en la activa
    - _Requirements: 6.1, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.8, 7.9, 7.10_

  - [x] 7.4 Crear `KpiCards` y `DownYardsChart`
    - Cinco tarjetas con etiqueta y unidad desde `formatKpis`
    - Gráfica Recharts (`ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`) con contenedor de altura explícita, ejes rotulados "Down" y "Yardas promedio", y mensaje "Sin datos" con título y ejes cuando no hay datos
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 7.5 Crear `CoachView`, `ScoutView`, `BroadcasterView` y `PerspectiveTabs`
    - Coach con mensaje de no disponible cuando la recomendación es `null`
    - Scout con tabla ordenable por `metric_value` (descendente la primera vez) y mensaje "Sin jugadores destacados" sin encabezados cuando la lista está vacía
    - Broadcaster con el resumen de una frase
    - Selector con Coach activa por defecto y solo la vista activa visible
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 7.6 Crear `MockBadge`, `ErrorBanner` y `LoadingOverlay`
    - `MockBadge` con el texto "Datos simulados" cuando `source = 'mock'`
    - `ErrorBanner` con mensaje en español y botón "Reintentar"
    - _Requirements: 1.9, 1.11, 6.6, 6.7, 7.7, 10.5, 10.8, 10.9_

- [x] 8. Integración y cableado
  - [x] 8.1 Cablear `App.tsx`, `main.tsx`, `index.css` y Tailwind
    - `App` usa `useDashboard` y compone filtros, selector de capas, campo, KPIs, gráfica, perspectivas, insignia de mock y banner de error con rejilla responsiva de 768 a 2560 px sin desplazamiento horizontal de la página
    - `index.css` solo con `@tailwind base; @tailwind components; @tailwind utilities;`; revisar que `tailwind.config.js` incluya `./index.html` y `./src/**/*.{ts,tsx}`
    - Paleta oscura con contraste mínimo de 4,5 : 1 (3 : 1 para texto grande); recursos con rutas relativas sin `/` inicial
    - _Requirements: 6.2, 7.6, 9.8, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 8.2 Agregar pruebas de ejemplo y estáticas al script de verificación
    - Importar desde `properties.ts` un `src/verify/examples.ts` que compruebe: `validateMockFile(heatmapMock)` sin errores, estado inicial (`targets`, `coach`, `USE_MOCK = true`), `RESET_FILTERS`, líneas de yarda y números exactos, 101 hash marks por fila, contraste de la paleta con `contrastRatio`, y ausencia de `fetch('/api`, `localhost` y `@import "tailwindcss"` en `src/`
    - _Requirements: 1.3, 1.5, 2.6, 3.3, 3.4, 3.5, 6.3, 7.9, 9.1, 10.3, 10.7_

- [x] 9. Checkpoint final - Build y desarrollo sin errores
  - Ejecutar `npm run build` dentro de `dashboard/` y confirmar código de salida 0 y 0 errores de TypeScript
  - Confirmar que `package.json` no cambió en `dependencies` ni `devDependencies`
  - Confirmar que `npm run dev` inicia sin errores (si no se puede dejar en segundo plano, indicar al usuario que lo ejecute manualmente)
  - Si se hicieron las tareas opcionales, ejecutar `npm run verify`. Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 10.1, 10.2_

## Notes

- Las tareas marcadas con `*` son opcionales y se pueden omitir para un MVP más rápido; el código de producción no depende de ellas.
- Cada tarea referencia requisitos concretos para trazabilidad.
- Los checkpoints validan de forma incremental.
- No se instala ninguna dependencia; las propiedades se verifican con `src/verify/properties.ts` y `npm run verify`.
- Las tareas de propiedades escriben en el mismo archivo, por eso van en oleadas distintas.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.4", "2.7"] },
    { "id": 2, "tasks": ["2.2", "2.12", "3.1"] },
    { "id": 3, "tasks": ["2.3", "3.3"] },
    { "id": 4, "tasks": ["2.5", "3.4"] },
    { "id": 5, "tasks": ["2.6", "4.1"] },
    { "id": 6, "tasks": ["2.8", "5.1"] },
    { "id": 7, "tasks": ["2.9", "5.3"] },
    { "id": 8, "tasks": ["2.10"] },
    { "id": 9, "tasks": ["2.11"] },
    { "id": 10, "tasks": ["2.13"] },
    { "id": 11, "tasks": ["2.14"] },
    { "id": 12, "tasks": ["2.15"] },
    { "id": 13, "tasks": ["3.2"] },
    { "id": 14, "tasks": ["3.5"] },
    { "id": 15, "tasks": ["3.6"] },
    { "id": 16, "tasks": ["3.7"] },
    { "id": 17, "tasks": ["3.8"] },
    { "id": 18, "tasks": ["4.2"] },
    { "id": 19, "tasks": ["4.3"] },
    { "id": 20, "tasks": ["5.2"] },
    { "id": 21, "tasks": ["6"] },
    { "id": 22, "tasks": ["7.1", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 23, "tasks": ["7.2"] },
    { "id": 24, "tasks": ["8.1"] },
    { "id": 25, "tasks": ["8.2"] },
    { "id": 26, "tasks": ["9"] }
  ]
}
```
