"""Processed_Store: container, holder, persistence (script mode) and loading."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import pandas as pd

from backend.etl.constants import TABLE_NAMES

log = logging.getLogger(__name__)

GRID_TABLES = tuple(t for t in TABLE_NAMES if t.startswith("grid_"))


class PersistError(Exception):
    """Raised when a table cannot be written during a Persist_Run."""


@dataclass(frozen=True)
class Store:
    tables: dict[str, pd.DataFrame]


class StoreHolder:
    """Written once by the worker thread, then only read."""

    def __init__(self) -> None:
        self.status: Literal["loading", "ready", "failed"] = "loading"
        self.store: Store | None = None
        self.error: str | None = None


def _final_path(directory: Path, table: str) -> Path:
    return directory / f"{table}.pkl.gz"


def save_store(store: Store, out_dir: Path) -> None:
    """Persist_Run only. Atomic write per table: temp file then os.replace."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for table in TABLE_NAMES:
        final = _final_path(out_dir, table)
        tmp = out_dir / f"{table}.pkl.gz.tmp"
        try:
            store.tables[table].to_pickle(tmp, compression="gzip")
            os.replace(tmp, final)
        except Exception as exc:
            try:
                tmp.unlink()
            except FileNotFoundError:
                pass
            except OSError:
                pass
            log.error("No se pudo escribir la tabla %s: %s", table, exc)
            raise PersistError(f"{table}: {exc}") from exc


def load_store(in_dir: Path) -> Store:
    """Read the nine final files. Raises on any missing or unreadable file."""
    in_dir = Path(in_dir)
    tables: dict[str, pd.DataFrame] = {}
    for table in TABLE_NAMES:
        path = _final_path(in_dir, table)
        if not path.is_file():
            raise FileNotFoundError(f"Falta {path}")
        tables[table] = pd.read_pickle(path, compression="gzip")
    n_plays = len(tables["plays"])
    for table in GRID_TABLES:
        grid = tables[table]
        if "pidx" not in grid.columns:
            raise ValueError(f"{table} no tiene columna pidx")
        if len(grid) and int(grid["pidx"].max()) >= n_plays:
            raise ValueError(f"{table} tiene pidx fuera de rango")
        if len(grid) and int(grid["pidx"].min()) < 0:
            raise ValueError(f"{table} tiene pidx negativo")
    return Store(tables=tables)


def load_or_build(processed_dir: Path, data_dir: Path) -> Store:
    """Load persisted tables when complete and readable, else build in memory.

    Never writes, modifies or deletes anything under processed_dir.
    """
    try:
        return load_store(processed_dir)
    except Exception as exc:
        log.warning(
            "No se pudo cargar %s (%s). Se construye el store en memoria.",
            processed_dir, exc,
        )
    from backend.etl.clean_pipeline import build_store

    return build_store(data_dir)
