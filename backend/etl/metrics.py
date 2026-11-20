"""Métricas por jugada: presión, separación receptor-defensa y posición del QB."""
import numpy as np
import pandas as pd

_KEYS = ["gameId", "playId"]
_PER_RECEIVER_COLS = _KEYS + ["nflId", "x_norm", "y_norm", "dist_to_nearest_def"]
_PER_PLAY_COLS = _KEYS + ["min_separation", "min_sep_nflId", "min_sep_x", "min_sep_y"]
_QB_COLS = _KEYS + ["qb_nflId", "qb_x", "qb_y", "qb_frame"]


def pressure_counts(pff: pd.DataFrame) -> pd.DataFrame:
    """Por jugada: n_hurry, n_hit, n_sack (filas con valor == 1; NaN cuenta 0) y pressure."""
    cols = ["pff_hurry", "pff_hit", "pff_sack"]
    flags = pd.DataFrame(
        {c: (pd.to_numeric(pff[c], errors="coerce") == 1).astype("int64") for c in cols}
    )
    flags["gameId"] = pff["gameId"].to_numpy()
    flags["playId"] = pff["playId"].to_numpy()
    out = flags.groupby(_KEYS, sort=True)[cols].sum().reset_index()
    out = out.rename(columns={"pff_hurry": "n_hurry", "pff_hit": "n_hit", "pff_sack": "n_sack"})
    out["pressure"] = (out[["n_hurry", "n_hit", "n_sack"]] > 0).any(axis=1)
    return out[_KEYS + ["n_hurry", "n_hit", "n_sack", "pressure"]]


def separation_at_frame(pos: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Separación en un frame por jugada.

    `pos` trae las filas de UN frame por jugada con gameId, playId, nflId, role,
    x_norm, y_norm. role 'Pass Route' = receptor, 'Coverage' = defensor.
    Devuelve (per_receiver, per_play). Jugadas sin receptores o sin defensores
    no producen filas.
    """
    rec_rows, play_rows = [], []
    for (gid, pid), g in pos.groupby(_KEYS, sort=True):
        rec = g[g["role"] == "Pass Route"].dropna(subset=["x_norm", "y_norm"])
        dfn = g[g["role"] == "Coverage"].dropna(subset=["x_norm", "y_norm"])
        if rec.empty or dfn.empty:
            continue
        rec = rec.sort_values("nflId", kind="stable")
        rxy = rec[["x_norm", "y_norm"]].to_numpy(dtype="float64")
        dxy = dfn[["x_norm", "y_norm"]].to_numpy(dtype="float64")
        diff = rxy[:, None, :] - dxy[None, :, :]
        dist = np.sqrt((diff ** 2).sum(axis=2)).min(axis=1)
        ids = rec["nflId"].to_numpy()
        for i in range(len(rec)):
            rec_rows.append((gid, pid, ids[i], rxy[i, 0], rxy[i, 1], dist[i]))
        j = int(np.argmin(dist))  # argmin devuelve el primero; ordenado por nflId
        play_rows.append((gid, pid, dist[j], ids[j], rxy[j, 0], rxy[j, 1]))
    per_receiver = pd.DataFrame(rec_rows, columns=_PER_RECEIVER_COLS)
    per_play = pd.DataFrame(play_rows, columns=_PER_PLAY_COLS)
    return per_receiver, per_play


def qb_position(rows: pd.DataFrame) -> pd.DataFrame:
    """Posición del QB (pff_role 'Pass') en pass_forward, o en ball_snap si falta.

    `rows` trae filas de jugadores con gameId, playId, nflId, frameId, role,
    x_norm, y_norm y las columnas por jugada `forward` y `snap` (frameId del evento,
    nulos si faltan). Devuelve una fila por jugada con qb_nflId, qb_x, qb_y, qb_frame.
    """
    qb = rows[rows["role"] == "Pass"]
    chosen = []
    for (gid, pid), g in qb.groupby(_KEYS, sort=True):
        for col in ("forward", "snap"):
            frame = g[col].iloc[0]
            if pd.isna(frame):
                continue
            hit = g[(g["frameId"] == frame) & g["x_norm"].notna() & g["y_norm"].notna()]
            if not hit.empty:
                r = hit.sort_values("nflId", kind="stable").iloc[0]
                chosen.append((gid, pid, r["nflId"], r["x_norm"], r["y_norm"], r["frameId"]))
                break
    return pd.DataFrame(chosen, columns=_QB_COLS)
