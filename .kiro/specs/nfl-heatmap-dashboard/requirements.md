# Requirements Document

## Introduction

Dashboard interactivo de analítica de la NFL (Big Data Bowl) centrado en un campo de fútbol americano de 120 × 53.3 yardas, renderizado como mapa de calor dinámico. El dashboard incluye una capa de datos desacoplada con respaldo de datos simulados (mock), un panel de filtros tácticos, tarjetas KPI, una gráfica Recharts complementaria y tres perspectivas por rol (Coach, Scout y Broadcaster).

Restricciones de stack (de `dashboard/package.json`, `.hackathon/stack.json` y `.kiro/steering/rules.md`): Node 22.23.1, React 18.3.1, Vite 5.4.21, TypeScript 5.7.3, Tailwind CSS 3.4.19 (sintaxis v3) y Recharts 3.10.1. No se agregan dependencias. El campo y las celdas se dibujan con SVG o Canvas nativo.

Conflicto con las reglas del proyecto: la solicitud pide consultar `http://localhost:8000/api/...`, pero `rules.md` prohíbe `localhost` y URLs absolutas en el código del dashboard, y exige `fetch('api/<ruta>')` sin diagonal inicial. La alternativa dentro del stack es usar rutas relativas `api/filters` y `api/heatmap` y configurar en `vite.config.ts` un proxy de `/api` hacia `http://localhost:8000` (conservando `base: './'`). Esta spec adopta esa alternativa.

## Glossary

- **Dashboard**: Aplicación web React del directorio `dashboard/`.
- **Api_Client**: Módulo `dashboard/src/services/api.ts` que obtiene filtros y datos del mapa de calor.
- **Mock_Data**: Archivo `dashboard/src/mocks/heatmapMock.json` con datos simulados realistas que cumplen el contrato de `api/heatmap`.
- **USE_MOCK**: Constante booleana del Api_Client, con valor inicial `true`, que fuerza el uso de Mock_Data.
- **Heatmap_Response**: Respuesta de `api/heatmap` con los campos `meta`, `grid` y `top_players`.
- **Meta**: Objeto con `total_plays`, `avg_yards`, `completion_pct`, `sack_rate` y `avg_time_to_throw`.
- **Grid_Cell**: Celda `{ x_bin, y_bin, intensity, plays_count, success_rate, avg_epa_or_yards }`, con `x_bin` de 0 a 120 y `y_bin` de 0 a 53.3 yardas.
- **Intensity**: Valor numérico normalizado de 0 a 1 de una Grid_Cell.
- **Top_Player**: Elemento `{ nflId, name, position, metric_value, metric_label }`.
- **Field_Heatmap**: Componente `FootballFieldHeatmap.tsx` que dibuja el campo y las celdas.
- **Layer**: Capa de visualización: `targets` (Zonas de Recepción), `routes` (Rutas de Receptores), `pocket_pressure` (Presión al QB) o `separation` (Separación Receptor-Defensor).
- **Filter_Panel**: Panel con los filtros Equipo, Down, Formación, Cobertura Defensiva y Resultado del Pase.
- **Filter_State**: Conjunto de valores seleccionados en el Filter_Panel.
- **KPI_Cards**: Conjunto de tarjetas que muestran los valores de Meta.
- **Complementary_Chart**: Gráfica Recharts de yardas promedio por down o de Hombre vs Zona.
- **Perspective**: Rol seleccionado: Coach, Scout o Broadcaster.
- **Coach_View**: Vista con una recomendación táctica automática según el Filter_State.
- **Scout_View**: Vista con una tabla de Top_Player.
- **Broadcaster_View**: Vista con un resumen ejecutivo de una frase.
- **Tooltip**: Globo flotante junto al cursor sobre una Grid_Cell.
- **Pass_Result**: Código de resultado del pase: C (completo), I (incompleto), S (sack), R (corrida del QB) o IN (intercepción).

## Requirements

### Requirement 1: Cliente de datos desacoplado

**User Story:** Como desarrollador, quiero un cliente de datos desacoplado de la interfaz, para que el dashboard funcione con datos simulados y cambie al backend real sin modificar los componentes.

#### Acceptance Criteria

1. THE Api_Client SHALL exponer una función que devuelva los filtros disponibles desde `api/filters`.
2. THE Api_Client SHALL exponer una función que devuelva un Heatmap_Response desde `api/heatmap` para un Filter_State y una Layer dados.
3. THE Api_Client SHALL invocar el backend únicamente con rutas relativas sin diagonal inicial (`api/filters`, `api/heatmap`) y sin URLs absolutas (sin esquema `http://` ni `https://`).
4. THE Dashboard SHALL configurar en `vite.config.ts` un proxy de `/api` hacia `http://localhost:8000` y conservar `base: './'`.
5. THE Api_Client SHALL definir la constante USE_MOCK con valor inicial `true`.
6. WHILE USE_MOCK es `true`, THE Api_Client SHALL devolver datos de Mock_Data sin realizar ninguna llamada de red (0 solicitudes).
7. WHILE USE_MOCK es `false`, THE Api_Client SHALL consultar el backend y devolver los datos de la respuesta cuando ésta sea HTTP 2xx y cumpla el contrato de Heatmap_Response o de filtros.
8. IF una llamada al backend falla por error de red, por respuesta HTTP distinta de 2xx o porque no hay respuesta en 10 segundos, THEN THE Api_Client SHALL devolver datos de Mock_Data, informar al Dashboard que se usa el respaldo y conservar el Filter_State y la Layer seleccionados.
9. WHILE el Dashboard muestra datos de Mock_Data, THE Dashboard SHALL mostrar un indicador visible con el texto "Datos simulados".
10. IF una respuesta del backend no cumple el contrato de Heatmap_Response (cuerpo no es JSON válido, falta algún campo requerido o un campo tiene tipo distinto al definido), THEN THE Api_Client SHALL tratarla como fallida, devolver datos de Mock_Data e informar al Dashboard que se usa el respaldo.
11. WHEN una llamada posterior al backend tiene éxito después de un respaldo a Mock_Data, THE Dashboard SHALL ocultar el indicador "Datos simulados" en un máximo de 1 segundo tras renderizar los datos del backend.

### Requirement 2: Datos simulados realistas

**User Story:** Como desarrollador, quiero un archivo de datos simulados realista, para que pueda desarrollar y demostrar el dashboard sin backend.

#### Acceptance Criteria

1. THE Mock_Data SHALL cumplir el contrato de Heatmap_Response con los campos `meta`, `grid` y `top_players`, de modo que una validación contra el contrato de Heatmap_Response no produzca ningún error.
2. THE Mock_Data SHALL incluir, para cada una de las cuatro Layer (targets, routes, pocket_pressure, separation), una Grid_Cell con `x_bin`, `y_bin`, `intensity`, `plays_count`, `success_rate` y `avg_epa_or_yards` por cada celda de la rejilla que cubre el campo de 120 yardas (`x_bin` de 0 a 120) por 53.3 yardas (`y_bin` de 0 a 53.3), sin celdas duplicadas ni celdas faltantes.
3. THE Mock_Data SHALL asignar a cada Grid_Cell un valor de `intensity` numérico entre 0 y 1 inclusive.
4. THE Mock_Data SHALL asignar a cada Grid_Cell un valor de `success_rate` numérico entre 0 y 1 inclusive, un valor de `plays_count` entero mayor o igual a 0 y un valor numérico de `avg_epa_or_yards`.
5. THE Mock_Data SHALL incluir entre 10 y 50 elementos en `top_players`, con al menos un jugador de cada posición QB, WR, TE, RB, CB y S.
6. THE Mock_Data SHALL proveer para cada una de las cuatro Layer un conjunto de Grid_Cell cuya lista de valores de `intensity` sea distinta de la de cualquier otra Layer.
7. FOR ALL Layer de Mock_Data, THE suma de `plays_count` de todas las Grid_Cell de esa Layer SHALL ser menor o igual que `meta.total_plays` (propiedad invariante).
8. IF una Grid_Cell o un elemento de `top_players` de Mock_Data viola alguna restricción de los criterios 1 a 7, THEN THE validación de Mock_Data SHALL fallar e identificar la Layer y la celda o el jugador que incumple la restricción, sin modificar el archivo de Mock_Data.

### Requirement 3: Campo reglamentario

**User Story:** Como analista, quiero ver un campo reglamentario a escala exacta, para que la posición de cada dato sea geométricamente correcta.

#### Acceptance Criteria

1. THE Field_Heatmap SHALL dibujar un campo horizontal de 120 yardas de ancho por 53.3 yardas de alto, con proporción ancho : alto de 120 : 53.3 (≈ 2.2514) y una tolerancia máxima de ±0.5 % en el cociente renderizado.
2. THE Field_Heatmap SHALL dibujar dos End Zones de 10 yardas de ancho cada una, ocupando los rangos 0–10 y 110–120 del eje horizontal y la altura completa del campo, con un color de relleno distinto al del campo de juego (yardas 10–110).
3. THE Field_Heatmap SHALL dibujar una línea vertical de altura completa en cada múltiplo de 5 yardas entre las yardas 10 y 110, ambas incluidas (21 líneas en total).
4. THE Field_Heatmap SHALL dibujar los números 10, 20, 30, 40, 50, 40, 30, 20 y 10 centrados sobre las líneas de las yardas 20, 30, 40, 50, 60, 70, 80, 90 y 100 respectivamente, en ese orden de izquierda a derecha.
5. THE Field_Heatmap SHALL dibujar hash marks centrales como marcas cortas en cada yarda entera entre las yardas 10 y 110, alineadas en dos filas horizontales situadas a 23.58 yardas y 29.72 yardas medidas desde el borde superior del campo (una distancia de 6.18 yardas entre filas).
6. THE Field_Heatmap SHALL dibujar una flecha dentro del área del campo, orientada hacia la derecha (hacia la yarda 120), que indique la dirección de ataque.
7. WHEN cambia el ancho del contenedor, THE Field_Heatmap SHALL redimensionar el campo en un máximo de 100 ms, de modo que su ancho renderizado sea igual al ancho del contenedor, su alto sea ancho × 53.3 / 120 y se conserve la proporción 120 : 53.3 con la misma tolerancia del criterio 1.
8. IF el ancho del contenedor es menor que 320 px, THEN THE Field_Heatmap SHALL mantener el ancho en 320 px, conservar la proporción 120 : 53.3 y permitir desplazamiento horizontal del contenedor.

### Requirement 4: Superposición de mapa de calor

**User Story:** Como analista, quiero celdas de color sobre el campo según su intensidad, para que identifique las zonas de mayor actividad de un vistazo.

#### Acceptance Criteria

1. WHEN el Field_Heatmap recibe un conjunto de Grid_Cell, THE Field_Heatmap SHALL dibujar cada Grid_Cell con su esquina en la posición del campo definida por `x_bin` y `y_bin`, con ancho y alto idénticos para todas las celdas y sin solapamiento entre celdas adyacentes.
2. THE Field_Heatmap SHALL colorear cada Grid_Cell con una escala continua que va de traslúcido (Intensity 0) a amarillo (Intensity 0.33), a naranja (Intensity 0.66) y a rojo intenso (Intensity 1), interpolando linealmente entre esos puntos de referencia para valores intermedios.
3. WHEN Intensity de una Grid_Cell es 0, THE Field_Heatmap SHALL dibujar esa celda con opacidad 0, de modo que el campo bajo ella permanezca visible sin color añadido.
4. IF Intensity de una Grid_Cell es menor que 0 o mayor que 1, THEN THE Field_Heatmap SHALL limitar el valor al rango de 0 a 1 antes de calcular el color y SHALL mantener la celda dibujada.
5. WHEN el Field_Heatmap se muestra, THE Field_Heatmap SHALL mostrar una leyenda de la escala de color con la etiqueta "0" en el extremo mínimo y la etiqueta "1" en el extremo máximo, con la misma escala de color que usan las celdas.
6. THE Field_Heatmap SHALL dibujar las celdas con SVG o HTML5 Canvas nativos, sin librerías externas de mapas.
7. FOR ALL pares de Grid_Cell con Intensity a ≤ b, THE función de color SHALL asignar una opacidad de a menor o igual que la de b (propiedad de monotonía).

### Requirement 5: Tooltip de celda

**User Story:** Como analista, quiero un tooltip al pasar el cursor sobre una celda, para que consulte los datos exactos de esa zona.

#### Acceptance Criteria

1. WHEN el cursor entra en una Grid_Cell, THE Field_Heatmap SHALL mostrar un Tooltip a un desplazamiento de 12 px a la derecha y 12 px debajo de la posición del cursor, en un plazo máximo de 100 ms desde la entrada del cursor.
2. WHEN el Tooltip se muestra para una Grid_Cell con al menos 1 jugada, THE Tooltip SHALL mostrar el número de jugadas como entero, el porcentaje de éxito con 1 decimal en el rango de 0.0% a 100.0%, y las yardas promedio con 1 decimal en el rango de -99.9 a 99.9.
3. IF la Grid_Cell tiene 0 jugadas, THEN THE Tooltip SHALL mostrar el número de jugadas igual a 0 y un indicador de "sin datos" en lugar del porcentaje de éxito y las yardas promedio.
4. WHEN el cursor se mueve dentro del campo mientras el Tooltip está visible, THE Tooltip SHALL actualizar su posición para mantener el desplazamiento definido en el criterio 1, en un plazo máximo de 50 ms desde el movimiento del cursor.
5. WHEN el cursor se mueve de una Grid_Cell a otra Grid_Cell, THE Tooltip SHALL actualizar su contenido con los datos de la nueva Grid_Cell en un plazo máximo de 100 ms.
6. WHEN el cursor sale de la Grid_Cell hacia un área fuera del campo, THE Field_Heatmap SHALL ocultar el Tooltip en un plazo máximo de 100 ms.
7. IF el Tooltip excede el borde derecho, inferior, izquierdo o superior del contenedor, THEN THE Field_Heatmap SHALL reposicionar el Tooltip de modo que sus cuatro bordes queden dentro del contenedor, con un margen mínimo de 4 px respecto de cada borde del contenedor.

### Requirement 6: Capas alternables

**User Story:** Como analista, quiero alternar entre capas de análisis, para que vea distintos aspectos del juego sobre el mismo campo.

#### Acceptance Criteria

1. THE Dashboard SHALL ofrecer un selector con exactamente cuatro opciones de Layer: Zonas de Recepción (`targets`), Rutas de Receptores (`routes`), Presión al QB (`pocket_pressure`) y Separación Receptor-Defensor (`separation`).
2. WHEN el usuario selecciona una Layer distinta de la activa, THE Dashboard SHALL solicitar al Api_Client el Heatmap_Response de esa Layer y, al recibirlo, actualizar el Field_Heatmap con sus datos en un máximo de 500 ms desde la recepción.
3. WHEN el Dashboard se carga por primera vez, THE Dashboard SHALL marcar `targets` como la Layer activa.
4. THE Dashboard SHALL mostrar exactamente una Layer como activa en todo momento, indicada visualmente en el selector.
5. WHEN la Layer activa cambia, THE Tooltip SHALL reemplazar su etiqueta de yardas promedio por la etiqueta correspondiente al significado de la nueva Layer activa, sin conservar la etiqueta de la Layer anterior.
6. WHILE el Dashboard espera un Heatmap_Response, THE Dashboard SHALL mostrar un indicador de carga sobre el Field_Heatmap y ocultarlo cuando la respuesta se reciba o falle.
7. IF el Api_Client no devuelve un Heatmap_Response válido en 10 segundos o devuelve un error, THEN THE Dashboard SHALL mostrar un mensaje de error que indique que la Layer no pudo cargarse, conservar como activa la Layer anterior con su Field_Heatmap sin cambios y permitir al usuario reintentar la selección.

### Requirement 7: Panel de filtros tácticos

**User Story:** Como entrenador, quiero filtrar por contexto de juego, para que el análisis refleje la situación que me interesa.

#### Acceptance Criteria

1. WHEN el Filter_Panel se carga y `api/filters` responde correctamente en un máximo de 5 segundos, THE Filter_Panel SHALL ofrecer el filtro Equipo con las opciones devueltas por `api/filters`, sin duplicados y en el orden recibido.
2. THE Filter_Panel SHALL ofrecer el filtro Down con exactamente 4 opciones: 1st, 2nd, 3rd y 4th.
3. THE Filter_Panel SHALL ofrecer el filtro Formación con exactamente 4 opciones: SHOTGUN, EMPTY, SINGLEBACK e I_FORM.
4. THE Filter_Panel SHALL ofrecer el filtro Cobertura Defensiva con exactamente 5 opciones: Cover-1, Cover-2, Cover-3, Quarters y Man vs Zone.
5. THE Filter_Panel SHALL ofrecer el filtro Resultado del Pase con exactamente 5 opciones: C, I, S, R e IN.
6. WHEN el usuario cambia la selección de un filtro, THE Dashboard SHALL solicitar un nuevo Heatmap_Response con el Filter_State actualizado y SHALL refrescar el Field_Heatmap, las KPI_Cards, el Complementary_Chart y la Perspective activa en un máximo de 2 segundos tras recibir la respuesta.
7. IF la solicitud del Heatmap_Response falla o excede 10 segundos, THEN THE Dashboard SHALL conservar los datos mostrados antes del cambio, SHALL mantener el Filter_State actualizado en el Filter_Panel y SHALL mostrar un mensaje de error que indique que no se pudieron actualizar los datos.
8. THE Filter_Panel SHALL permitir dejar cada filtro sin selección o con varias opciones seleccionadas, y un filtro sin selección SHALL equivaler a incluir todas sus opciones.
9. WHEN el usuario activa la acción de restablecer, THE Filter_Panel SHALL dejar los 5 filtros sin selección y THE Dashboard SHALL solicitar un nuevo Heatmap_Response con el Filter_State vacío.
10. IF `api/filters` devuelve un error o no responde en 5 segundos, THEN THE Filter_Panel SHALL usar las opciones de respaldo definidas en Mock_Data para el filtro Equipo y SHALL mostrar un aviso indicando que se usan opciones de respaldo.
11. WHILE USE_MOCK es `true`, THE Api_Client SHALL devolver una Heatmap_Response de Mock_Data que dependa del Filter_State, de modo que cambiar la selección de cualquier filtro modifique al menos un valor de las KPI_Cards y al menos una zona del Field_Heatmap.

### Requirement 8: Tarjetas KPI y gráfica complementaria

**User Story:** Como analista, quiero KPIs y una gráfica complementaria, para que compare las métricas agregadas con el mapa.

#### Acceptance Criteria

1. WHEN se recibe un Heatmap_Response válido, THE KPI_Cards SHALL mostrar exactamente cinco tarjetas, una por cada campo de Meta: `total_plays` (unidad: jugadas, entero), `avg_yards` (unidad: yardas, 1 decimal), `completion_pct` (unidad: %, 1 decimal, rango 0 a 100), `sack_rate` (unidad: %, 1 decimal, rango 0 a 100) y `avg_time_to_throw` (unidad: segundos, 2 decimales), cada una con su etiqueta y su unidad visibles.
2. WHEN se recibe un nuevo Heatmap_Response, THE KPI_Cards SHALL actualizar los cinco valores en un máximo de 500 ms desde la recepción de la respuesta.
3. IF un campo de Meta es nulo, está ausente o no es numérico, THEN THE KPI_Cards SHALL mostrar el texto "N/D" en la tarjeta de ese campo, conservar la etiqueta y la unidad, y mantener los valores de las demás tarjetas sin cambios.
4. THE Complementary_Chart SHALL dibujarse con Recharts 3.10.1 como gráfica de barras con un máximo de cuatro barras (downs 1, 2, 3 y 4), donde el eje X muestra el down y el eje Y muestra las yardas promedio por down en yardas, con etiquetas de eje visibles.
5. WHEN cambia el Filter_State y se recibe el Heatmap_Response correspondiente, THE Complementary_Chart SHALL actualizar sus barras con los datos de ese Filter_State en un máximo de 500 ms desde la recepción de la respuesta.
6. IF el Heatmap_Response no contiene datos para la gráfica (colección de downs ausente o vacía), THEN THE Complementary_Chart SHALL mostrar el mensaje "Sin datos" en lugar de las barras y conservar el título y las etiquetas de eje.

### Requirement 9: Perspectivas por rol

**User Story:** Como usuario con distintos roles, quiero cambiar de perspectiva, para que el dashboard presente la información adecuada para mi trabajo.

#### Acceptance Criteria

1. WHEN el Dashboard se carga por primera vez en una sesión, THE Dashboard SHALL mostrar un selector de Perspective con exactamente tres opciones (Coach, Scout y Broadcaster), con Coach seleccionada y su vista activa.
2. WHEN el usuario selecciona la Perspective Coach, THE Coach_View SHALL mostrar, en un máximo de 500 ms desde la selección, una recomendación táctica de entre 1 y 3 frases (máximo 300 caracteres) generada automáticamente a partir del Filter_State y de Meta.
3. WHILE la Perspective Coach está activa, WHEN el Filter_State o Meta cambian, THE Coach_View SHALL reemplazar la recomendación anterior por una regenerada con los valores actuales, en un máximo de 500 ms desde el cambio.
4. WHEN el usuario selecciona la Perspective Scout, THE Scout_View SHALL mostrar una tabla con una fila por cada Top_Player (máximo 20 filas) y con las columnas nombre, posición, `metric_label` y `metric_value`.
5. WHEN el usuario activa el encabezado de la columna `metric_value` en la Scout_View, THE Scout_View SHALL ordenar las filas por `metric_value` en orden descendente la primera vez, y alternar entre descendente y ascendente en cada activación posterior, en un máximo de 300 ms.
6. WHEN el usuario selecciona la Perspective Broadcaster, THE Broadcaster_View SHALL mostrar un resumen ejecutivo de una sola frase (máximo 200 caracteres) que incluya los valores actuales de `total_plays` (entero), `avg_yards` (con 1 decimal) y `completion_pct` (con 1 decimal, en porcentaje).
7. IF `top_players` está vacío, THEN THE Scout_View SHALL mostrar el mensaje "Sin jugadores destacados" en lugar de la tabla, sin mostrar filas ni encabezados de datos.
8. WHEN el usuario cambia de Perspective, THE Dashboard SHALL mantener visibles el Field_Heatmap y el Filter_Panel, conservar el Filter_State sin modificaciones y ocultar las vistas de las Perspectives no seleccionadas.
9. IF la generación de la recomendación de la Coach_View falla o Meta no está disponible, THEN THE Coach_View SHALL mostrar un mensaje indicando que la recomendación no está disponible, conservar el Filter_State y mantener operativos el resto de los componentes del Dashboard.

### Requirement 10: Presentación y ejecución

**User Story:** Como usuario, quiero una interfaz clara y utilizable, para que pueda operar el dashboard en cualquier pantalla de escritorio o tableta.

#### Acceptance Criteria

1. WHEN el usuario ejecuta `npm run dev` dentro de `dashboard/`, THE Dashboard SHALL iniciar el servidor de desarrollo sin errores y sin requerir dependencias que no estén declaradas en `package.json`.
2. WHEN el usuario ejecuta `npm run build` dentro de `dashboard/`, THE Dashboard SHALL finalizar con código de salida 0 y con 0 errores de TypeScript.
3. THE Dashboard SHALL usar Tailwind CSS versión 3.4.19 con las directivas `@tailwind base`, `@tailwind components` y `@tailwind utilities`, y SHALL NOT usar `@import "tailwindcss"`, `@theme` ni otra sintaxis exclusiva de Tailwind 4.
4. THE Dashboard SHALL referenciar todos los recursos propios (scripts, hojas de estilo, imágenes y archivos de datos) con rutas relativas que no comiencen con `/`.
5. THE Dashboard SHALL mostrar en español el 100 % de los textos visibles de la interfaz, incluidos etiquetas, botones, títulos, mensajes de error y textos alternativos de imágenes. Los nombres propios de equipos, jugadores y competiciones provenientes de los datos quedan exentos.
6. WHILE el ancho de la ventana está entre 768 px y 2560 px, THE Dashboard SHALL mostrar el Filter_Panel, el Field_Heatmap y los KPI_Cards completos, sin barra de desplazamiento horizontal en la página y sin elementos recortados.
7. THE Dashboard SHALL mantener una relación de contraste de al menos 4,5 : 1 entre el color del texto y el color de su fondo para todo texto de tamaño normal, y de al menos 3 : 1 para texto de 24 px o más (o de 18,66 px o más en negrita).
8. IF ocurre un error no recuperable al cargar datos, THEN THE Dashboard SHALL mostrar, en un plazo máximo de 1 segundo tras detectar el error, un mensaje de error en español que indique que los datos no se pudieron cargar, junto con un botón "Reintentar", y SHALL conservar visibles los filtros ya seleccionados.
9. WHEN el usuario activa el botón de reintentar, THE Dashboard SHALL volver a solicitar los datos y SHALL ocultar el mensaje de error si la carga finaliza correctamente. Si la carga falla de nuevo, SHALL mostrar otra vez el mensaje de error y el botón de reintentar.
