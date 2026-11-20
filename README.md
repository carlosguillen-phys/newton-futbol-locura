# NFL Big Data Bowl - Mapa de Calor Tactico (newton-futbol-locura)

Plataforma interactiva de analisis espacial y tactico de jugadas de pase de la NFL (8.3+ millones de registros de tracking y 8,557 jugadas procesadas), disenada para evaluacion de zonas de recepcion, rutas de receptores, presion al QB y separacion receptor-defensor.

## Arquitectura del Proyecto

* **Pipeline ETL & Backend (`backend/`)**: Procesamiento y limpieza de tracking data en Python (`NumPy`, `Pandas`, `FastAPI`). Endpoints principales: `GET /health`, `GET /api/filters` y `GET /api/heatmap`.
* **Dashboard Interactivo (`dashboard/`)**: Interfaz construida con React, TypeScript y Vite. Visualizacion de cancha NFL a escala con 4 capas tacticas y filtrado multicriterio en tiempo real.

## Como ejecutar el proyecto localmente

1. **Backend (FastAPI)**: Desde la raiz del proyecto ejecutar `.venv/bin/uvicorn backend.main:app --port 8000 --reload`
2. **Frontend (React)**: Entrar a `dashboard/`, ejecutar `npm install` y `npm run dev`, y abrir `http://localhost:5173`.

## Equipo
* **Carlos Daniel Guillen Melendez** (`carlosguillen-phys`) - Ingenieria de Datos, Pipeline ETL y Backend FastAPI.
* **Angelica Cerqueda** (`AnG1e-25`) - Arquitectura Frontend, Diseno de Cancha Interactiva y Visualizacion de Datos.
