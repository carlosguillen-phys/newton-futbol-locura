"""API NFL Big Data Bowl. Ejecuta: .venv/bin/uvicorn backend.main:app --port 8000"""
import os
from pathlib import Path


def cargar_env():
    f = Path(__file__).resolve().parent.parent / ".env"
    if f.exists():
        for linea in f.read_text(encoding="utf-8-sig").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


cargar_env()

import json  # noqa: E402
import logging  # noqa: E402
import threading  # noqa: E402
import time  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

import pandas as pd  # noqa: E402
from fastapi import Depends, FastAPI, Query, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse, Response  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from backend.etl.constants import DATA_DIR, LAYERS, PASS_RESULTS, PROCESSED_DIR, ROOT_DIR  # noqa: E402
from backend.heatmap import build_mask, compute_heatmap  # noqa: E402
from backend.schemas import HeatmapResponse  # noqa: E402
from backend.store import Store, StoreHolder, load_or_build  # noqa: E402

log = logging.getLogger(__name__)


def _distinct(series: pd.Series) -> set[str]:
    vals = series.dropna().astype(str)
    return {v for v in vals if v != ""}


def build_filters_json(store: Store) -> bytes:
    plays = store.tables["plays"]
    body = {
        "teams": sorted(_distinct(plays["possessionTeam"]) | _distinct(plays["defensiveTeam"])),
        "downs": [1, 2, 3, 4],
        "formations": sorted(_distinct(plays["offenseFormation"])),
        "coverages": sorted(_distinct(plays["pff_passCoverage"])),
        "pass_results": list(PASS_RESULTS),
    }
    return json.dumps(body, ensure_ascii=False).encode("utf-8")


def _load_worker(holder: StoreHolder) -> None:
    t0 = time.perf_counter()
    try:
        store = load_or_build(PROCESSED_DIR, DATA_DIR)
        holder.filters_json = build_filters_json(store)
        holder.store = store
        holder.status = "ready"
        log.info("Store listo en %.2f s", time.perf_counter() - t0)
    except Exception as exc:  # noqa: BLE001
        log.exception("No se pudo cargar el store")
        holder.error = str(exc) or exc.__class__.__name__
        holder.status = "failed"


@asynccontextmanager
async def lifespan(app: FastAPI):
    holder = StoreHolder()
    app.state.holder = holder
    threading.Thread(target=_load_worker, args=(holder,), daemon=True).start()
    yield


app = FastAPI(title="Hackathon NFL UNAM", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def get_holder(request: Request) -> StoreHolder:
    return request.app.state.holder


def _ready_store(holder: StoreHolder) -> Store | None:
    if holder.status == "ready" and holder.store is not None:
        return holder.store
    return None


def _unavailable(holder: StoreHolder) -> JSONResponse:
    if holder.status == "failed":
        detail = f"Data is not available: {(holder.error or 'unknown error')[:200]}"
    else:
        detail = "Data is not available yet: store is loading"
    return JSONResponse(status_code=503, content={"detail": detail})


def _422(detail: str) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": detail})


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/filters")
def filters(holder: StoreHolder = Depends(get_holder)):
    store = _ready_store(holder)
    if store is None:
        return _unavailable(holder)
    cached = getattr(holder, "filters_json", None)
    if cached is None:
        cached = holder.filters_json = build_filters_json(store)
    return Response(content=cached, media_type="application/json")


@app.get("/api/heatmap", response_model=HeatmapResponse)
def heatmap(
    team: str | None = Query(None),
    down: str | None = Query(None),
    formation: str | None = Query(None),
    coverage: str | None = Query(None),
    pass_result: str | None = Query(None),
    layer: str = Query("targets"),
    holder: StoreHolder = Depends(get_holder),
):
    if layer not in LAYERS:
        return _422("layer must be one of: " + ", ".join(LAYERS))
    down_i = None
    if down is not None:
        if down not in ("1", "2", "3", "4"):
            return _422("down must be an integer from 1 to 4")
        down_i = int(down)
    if pass_result is not None and pass_result not in PASS_RESULTS:
        return _422("pass_result must be one of: " + ", ".join(PASS_RESULTS))
    store = _ready_store(holder)
    if store is None:
        return _unavailable(holder)
    mask = build_mask(store.tables["plays"], team, down_i, formation, coverage, pass_result)
    return compute_heatmap(store, layer, mask)


# Frontend: las reglas del proyecto piden servir dashboard/dist en la misma URL.
# Se monta al final para que /health y /api/* tengan prioridad.
_DIST = ROOT_DIR / "dashboard" / "dist"
if _DIST.is_dir():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="dashboard")
