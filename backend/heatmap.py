"""Logica del heatmap: filtros, meta, grid por capa, top jugadores, yards_by_down.

Funciones puras sobre el Store en memoria, sin I/O.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from backend.schemas import (
    GridItem,
    HeatmapResponse,
    Meta,
    TopPlayer,
    YardsByDownItem,
)
from backend.store import Store

TOP_N = 10
MIN_SEPARATION_PLAYS = 3


def num(v, nd: int = 1) -> float:
    """None, NaN e infinito pasan a 0.0. Si no, se redondea a nd decimales."""
    if v is None:
        return 0.0
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0.0
    if math.isnan(f) or math.isinf(f):
        return 0.0
    return round(f, nd)


def build_mask(plays: pd.DataFrame, team=None, down=None, formation=None,
               coverage=None, pass_result=None) -> np.ndarray:
    """Mascara booleana (AND) con igualdad exacta y sensible a mayusculas."""
    mask = np.ones(len(plays), dtype=bool)
    if team is not None:
        mask &= (plays["possessionTeam"] == team).fillna(False).to_numpy(dtype=bool)
    if down is not None:
        mask &= (plays["down"] == int(down)).fillna(False).to_numpy(dtype=bool)
    if formation is not None:
        mask &= (plays["offenseFormation"] == formation).fillna(False).to_numpy(dtype=bool)
    if coverage is not None:
        mask &= (plays["pff_passCoverage"] == coverage).fillna(False).to_numpy(dtype=bool)
    if pass_result is not None:
        mask &= (plays["passResult"] == pass_result).fillna(False).to_numpy(dtype=bool)
    return mask


def _meta(plays_f: pd.DataFrame) -> Meta:
    n = len(plays_f)
    if n == 0:
        return Meta(total_plays=0, avg_yards=0.0, completion_pct=0.0,
                    sack_rate=0.0, avg_time_to_throw=0.0)
    res = plays_f["passResult"]
    return Meta(
        total_plays=int(n),
        avg_yards=num(plays_f["playResult"].mean(), 1),
        completion_pct=num(100.0 * float((res == "C").sum()) / n, 1),
        sack_rate=num(100.0 * float((res == "S").sum()) / n, 1),
        avg_time_to_throw=num(plays_f["time_to_throw"].mean(), 2),
    )


def yards_by_down(plays_f: pd.DataFrame) -> list[YardsByDownItem]:
    """Siempre 4 items (downs 1 a 4), independiente de la capa."""
    if len(plays_f):
        means = plays_f.groupby(plays_f["down"].astype("float64"))["playResult"].mean()
    else:
        means = pd.Series(dtype="float64")
    return [
        YardsByDownItem(down=d, avg_yards=num(means.get(float(d)), 1))
        for d in (1, 2, 3, 4)
    ]


def _grid(store: Store, layer: str, mask: np.ndarray, plays: pd.DataFrame) -> list[GridItem]:
    g = store.tables[f"grid_{layer}"]
    if len(g) == 0:
        return []
    g = g[mask[g["pidx"].to_numpy()]]
    if len(g) == 0:
        return []
    pidx = g["pidx"].to_numpy()
    df = pd.DataFrame({
        "pidx": pidx,
        "x_bin": g["x_bin"].to_numpy(),
        "y_bin": g["y_bin"].to_numpy(),
        "completed": (plays["passResult"].to_numpy()[pidx] == "C"),
        "yards": plays["playResult"].to_numpy(dtype="float64")[pidx],
    })
    if layer == "pocket_pressure":
        df["value"] = g["pressure"].to_numpy().astype("float64")
        df["success"] = 1.0 - df["value"]
    elif layer == "separation":
        df["value"] = g["min_separation"].to_numpy(dtype="float64")
        df["success"] = df["completed"].astype("float64")
    else:  # targets, routes
        df["value"] = 1.0
        df["success"] = df["completed"].astype("float64")

    keys = ["x_bin", "y_bin"]
    if layer == "routes":
        # varias posiciones de la misma jugada en una celda: valor = conteo,
        # exito y yardas cuentan cada jugada una vez por celda.
        value = df.groupby(keys)["value"].sum()
        dedup = df.drop_duplicates(["pidx", "x_bin", "y_bin"])
    else:
        value = (df.groupby(keys)["value"].mean() if layer == "separation"
                 else df.groupby(keys)["value"].sum())
        dedup = df
    agg = dedup.groupby(keys).agg(
        plays_count=("pidx", "nunique"),
        success_rate=("success", "mean"),
        yards=("yards", "mean"),
    )
    agg["value"] = value
    agg = agg.reset_index().sort_values(keys, kind="stable")

    vmax = float(agg["value"].max())
    intensity = agg["value"] / vmax if vmax > 0 else pd.Series(0.0, index=agg.index)

    items: list[GridItem] = []
    for xb, yb, inten, pc, sr, yd in zip(
        agg["x_bin"].to_numpy(), agg["y_bin"].to_numpy(), intensity.to_numpy(),
        agg["plays_count"].to_numpy(), agg["success_rate"].to_numpy(),
        agg["yards"].to_numpy(),
    ):
        items.append(GridItem(
            x_bin=int(xb), y_bin=int(yb),
            intensity=min(1.0, num(inten, 2)),
            plays_count=int(pc),
            success_rate=min(1.0, max(0.0, num(sr, 2))),
            avg_epa_or_yards=num(yd, 1),
        ))
    return items


def _top_players(store: Store, layer: str, mask: np.ndarray,
                 plays_f: pd.DataFrame) -> list[TopPlayer]:
    if layer in ("targets", "routes"):
        label = "Targets"
        ids = plays_f["target_nflId"].dropna()
        if ids.empty:
            return []
        s = ids.astype("int64").value_counts()
        stats = pd.DataFrame({"nflId": s.index.to_numpy(), "metric": s.to_numpy(dtype="float64")})
    elif layer == "pocket_pressure":
        label = "Presiones generadas"
        r = store.tables["rushers"]
        r = r[mask[r["pidx"].to_numpy()]]
        s = r.groupby("nflId")["pressures"].sum()
        s = s[s > 0]
        stats = pd.DataFrame({"nflId": s.index.to_numpy(), "metric": s.to_numpy(dtype="float64")})
    else:
        label = "Yardas separación prom."
        r = store.tables["receivers"]
        r = r[mask[r["pidx"].to_numpy()]]
        grp = r.groupby("nflId")["dist_to_nearest_def"]
        s = grp.mean()[grp.size() >= MIN_SEPARATION_PLAYS]
        stats = pd.DataFrame({"nflId": s.index.to_numpy(), "metric": s.to_numpy(dtype="float64")})
    if stats.empty:
        return []

    players = store.tables["players"].drop_duplicates("nflId").set_index("nflId")
    names = players["displayName"].reindex(stats["nflId"]).fillna("").to_numpy(dtype=object)
    poss = players["officialPosition"].reindex(stats["nflId"]).fillna("").to_numpy(dtype=object)
    stats["name"] = names
    stats["position"] = poss
    stats = stats.sort_values(["metric", "name", "nflId"], ascending=[False, True, True],
                              kind="stable").head(TOP_N)
    is_count = layer != "separation"
    return [
        TopPlayer(
            nflId=int(row.nflId), name=str(row.name), position=str(row.position),
            metric_value=float(int(row.metric)) if is_count else num(row.metric, 2),
            metric_label=label,
        )
        for row in stats.itertuples(index=False)
    ]


def compute_heatmap(store: Store, layer: str, mask: np.ndarray) -> HeatmapResponse:
    plays = store.tables["plays"]
    plays_f = plays[mask]
    if len(plays_f) == 0:
        return HeatmapResponse(meta=_meta(plays_f), grid=[], top_players=[],
                               yards_by_down=yards_by_down(plays_f))
    return HeatmapResponse(
        meta=_meta(plays_f),
        grid=_grid(store, layer, mask, plays),
        top_players=_top_players(store, layer, mask, plays_f),
        yards_by_down=yards_by_down(plays_f),
    )
