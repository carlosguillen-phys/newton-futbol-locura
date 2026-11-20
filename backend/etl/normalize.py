"""Normalización espacial: todas las jugadas atacan de izquierda a derecha."""
from __future__ import annotations

import numpy as np
import pandas as pd

FIELD_LENGTH = 120.0
FIELD_WIDTH = 53.3
_ANGLE_COLS = ("o", "dir")


def normalize_frame(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Devuelve (copia normalizada, filas excluidas por playDirection inválido).

    Agrega ``x_norm`` y ``y_norm``. Si existen ``o`` y ``dir`` se reescriben.
    Los nulos siguen nulos y no excluyen la fila.
    """
    direction = df["playDirection"].astype(object)
    left = (direction == "left").to_numpy()
    valid = left | (direction == "right").to_numpy()
    excluded = int((~valid).sum())

    out = df.loc[valid].copy()
    left = left[valid]

    x = out["x"].to_numpy(dtype="float64", na_value=np.nan)
    y = out["y"].to_numpy(dtype="float64", na_value=np.nan)
    out["x_norm"] = np.where(left, FIELD_LENGTH - x, x)
    out["y_norm"] = np.where(left, FIELD_WIDTH - y, y)

    for col in _ANGLE_COLS:
        if col in out.columns:
            v = out[col].to_numpy(dtype="float64", na_value=np.nan)
            out[col] = np.where(left, (v + 180.0) % 360.0, v)

    return out, excluded
