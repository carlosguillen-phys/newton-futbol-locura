"""Fronteras de eventos, etiquetas de fase y Time_To_Throw (funciones puras)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from backend.etl.constants import EVENT_ALIASES, USE_AUTOEVENTS

PHASES = ("pre_snap", "pocket_phase", "ball_in_air", "yac_phase")


def _is_missing(v) -> bool:
    if v is None or v is pd.NA:
        return True
    try:
        return bool(np.isnan(v))
    except (TypeError, ValueError):
        return False


def event_bounds(frames: pd.DataFrame, use_autoevents: bool | None = None) -> pd.DataFrame:
    """Frame mínimo por evento canónico y jugada.

    ``frames`` necesita ``gameId``, ``playId``, ``frameId`` y ``event``.
    Devuelve un DataFrame indexado por (gameId, playId) con columnas
    ``snap``, ``forward`` y ``arrived`` (Int16, <NA> si falta el evento).
    El nombre manual tiene prioridad sobre su alias ``autoevent_``.
    """
    if use_autoevents is None:
        use_autoevents = USE_AUTOEVENTS
    keys = ["gameId", "playId"]
    ev = frames.loc[frames["event"].notna(), keys + ["frameId", "event"]].copy()
    ev["event"] = ev["event"].astype(object)
    first = ev.groupby(keys + ["event"], sort=True)["frameId"].min()

    all_keys = frames[keys].drop_duplicates().sort_values(keys)
    index = pd.MultiIndex.from_frame(all_keys)
    out = pd.DataFrame(index=index)
    for canon, names in EVENT_ALIASES.items():
        if not use_autoevents:
            names = names[:1]
        col = pd.Series(pd.NA, index=index, dtype="Int16")
        # Se recorre del alias menos prioritario al más prioritario.
        for name in reversed(names):
            if name in first.index.get_level_values("event"):
                sub = first.xs(name, level="event")
                sub = sub.reindex(index)
                mask = sub.notna()
                col = col.where(~mask, sub.astype("Int16"))
        out[canon] = col.astype("Int16")
    return out


def label_phases(frame_ids, snap, forward, arrived) -> np.ndarray:
    """Etiqueta cada frame con su fase; ``None`` si falta una frontera necesaria.

    Si dos fronteras presentes están en orden inverso, todo es ``None``.
    """
    fr = np.asarray(frame_ids)
    labels = np.full(fr.shape, None, dtype=object)
    s = None if _is_missing(snap) else float(snap)
    f = None if _is_missing(forward) else float(forward)
    a = None if _is_missing(arrived) else float(arrived)

    present = [v for v in (s, f, a) if v is not None]
    if any(present[i] > present[i + 1] for i in range(len(present) - 1)):
        return labels

    if s is not None:
        labels[fr < s] = "pre_snap"
    if s is not None and f is not None:
        labels[(fr >= s) & (fr < f)] = "pocket_phase"
    if f is not None and a is not None:
        labels[(fr >= f) & (fr < a)] = "ball_in_air"
    if a is not None:
        labels[fr >= a] = "yac_phase"
    return labels


def time_to_throw(snap, forward) -> float | None:
    """(forward - snap) / 10.0; ``None`` si falta un frame o forward < snap."""
    if _is_missing(snap) or _is_missing(forward):
        return None
    if forward < snap:
        return None
    return (float(forward) - float(snap)) / 10.0
