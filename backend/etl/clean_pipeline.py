"""Cleaning_Pipeline: construye el Processed_Store en memoria (sin escribir a disco)."""
from __future__ import annotations

import logging
import time
from pathlib import Path

import numpy as np
import pandas as pd

from backend.etl.constants import (
    DATA_DIR,
    GRID_SIZE,
    NA_VALUES,
    PROCESSED_DIR,
    TRACKING_COLS,
    TRACKING_DTYPES,
    X_BIN_MAX,
    Y_BIN_MAX,
)
from backend.etl.metrics import pressure_counts, qb_position, separation_at_frame
from backend.etl.normalize import normalize_frame
from backend.etl.phases import event_bounds
from backend.etl.targets import infer_targets
from backend.store import Store

log = logging.getLogger(__name__)

_KEYS = ["gameId", "playId"]

PLAYS_SRC_COLS = [
    "gameId", "playId", "playDescription", "possessionTeam", "defensiveTeam",
    "offenseFormation", "pff_passCoverage", "pff_passCoverageType", "passResult",
    "down", "quarter", "yardsToGo", "playResult",
]
PFF_COLS = ["gameId", "playId", "nflId", "pff_role", "pff_hit", "pff_hurry", "pff_sack"]
PLAYER_COLS = ["nflId", "displayName", "officialPosition"]
BALL_COLS = ["gameId", "playId", "frameId", "x_norm", "y_norm", "s", "event"]
PER_PLAY_COLS = [
    "gameId", "playId", "snap_frame", "pass_forward_frame", "pass_arrived_frame",
    "last_frame", "arrival_frame", "arrival_source", "ball_x", "ball_y",
]


class NoTrackingDataError(Exception):
    """No se pudo procesar ningun archivo de tracking (o una tabla quedo vacia)."""


# ---------------------------------------------------------------- utilidades

def _bin(values, max_bin: int) -> np.ndarray:
    v = np.asarray(values, dtype="float64")
    return np.clip(np.floor(v / GRID_SIZE) * GRID_SIZE, 0, max_bin).astype("int16")


def _cat(frames: list[pd.DataFrame], columns: list[str]) -> pd.DataFrame:
    frames = [f for f in frames if len(f)]
    if not frames:
        return pd.DataFrame({c: pd.Series(dtype="float64") for c in columns})
    return pd.concat(frames, ignore_index=True)[columns]


def _event_object(s: pd.Series) -> pd.Series:
    out = s.astype(object)
    return out.where(out.notna(), None)


# ------------------------------------------------------- reduccion por archivo

def _reduce_file(df: pd.DataFrame, play_keys: pd.DataFrame, roles: pd.DataFrame,
                 fallback: bool) -> tuple[dict, int]:
    """Reduce un archivo de tracking a fragmentos pequenos. Devuelve (frags, excluidas)."""
    is_ball = (df["team"].astype(object) == "football") | df["nflId"].isna()
    ball, players = df[is_ball], df[~is_ball]  # el split ocurre antes de descartar filas
    ball, ex_b = normalize_frame(ball)
    players, ex_p = normalize_frame(players)

    ball = ball.merge(play_keys, on=_KEYS, how="inner")
    players = players.merge(play_keys, on=_KEYS, how="inner")
    players = players.merge(roles, on=_KEYS + ["nflId"], how="left")

    # Frontera de eventos y ultimo frame, sobre todas las filas de las jugadas.
    both = pd.concat([ball[_KEYS + ["frameId", "event"]], players[_KEYS + ["frameId", "event"]]],
                     ignore_index=True)
    both["event"] = both["event"].astype(object)
    frags: dict = {}
    if both.empty:
        return {"ball": pd.DataFrame(columns=BALL_COLS),
                "per_play": pd.DataFrame(columns=PER_PLAY_COLS),
                "receivers": pd.DataFrame(), "sep": pd.DataFrame(), "qb": pd.DataFrame()}, ex_b + ex_p
    bounds = event_bounds(both).reset_index()
    last = both.groupby(_KEYS, sort=True)["frameId"].max().rename("last_frame").reset_index()
    pp = bounds.merge(last, on=_KEYS, how="left")
    pp = pp.rename(columns={"snap": "snap_frame", "forward": "pass_forward_frame",
                            "arrived": "pass_arrived_frame"})
    arrived = pp["pass_arrived_frame"].astype("Int16")
    fb = pp["last_frame"].astype("Int16").where(pp["pass_forward_frame"].notna()) if fallback \
        else pd.Series(pd.array([pd.NA] * len(pp), dtype="Int16"), index=pp.index)
    pp["arrival_frame"] = arrived.fillna(fb).astype("Int16")
    src = np.where(arrived.notna(), "pass_arrived", np.where(fb.notna(), "last_frame", None))
    pp["arrival_source"] = pd.Series(src, index=pp.index, dtype=object)

    # Fragmento de balon (un registro por (gameId, playId, frameId), primero gana).
    ball_f = ball.drop_duplicates(_KEYS + ["frameId"], keep="first")[BALL_COLS].copy()
    ball_f["event"] = _event_object(ball_f["event"])

    # Frame de analisis.
    arr = pp.loc[pp["arrival_frame"].notna(), _KEYS + ["arrival_frame"]].copy()
    arr["frameId"] = arr["arrival_frame"].astype("int16")
    arr = arr[_KEYS + ["frameId"]]
    ball_at = ball_f.merge(arr, on=_KEYS + ["frameId"], how="inner")[_KEYS + ["x_norm", "y_norm"]]
    ball_at = ball_at.rename(columns={"x_norm": "ball_x", "y_norm": "ball_y"})
    pp = pp.merge(ball_at, on=_KEYS, how="left")

    pos = players.merge(arr, on=_KEYS + ["frameId"], how="inner")
    pos = pos[pos["role"].isin(["Pass Route", "Coverage"])][_KEYS + ["nflId", "role", "x_norm", "y_norm"]]
    per_receiver, per_play_sep = separation_at_frame(pos)

    qb_rows = players[players["role"] == "Pass"]
    qb_rows = qb_rows.merge(
        pp[_KEYS + ["snap_frame", "pass_forward_frame"]].rename(
            columns={"snap_frame": "snap", "pass_forward_frame": "forward"}),
        on=_KEYS, how="inner")
    qb = qb_position(qb_rows[_KEYS + ["nflId", "frameId", "role", "x_norm", "y_norm", "snap", "forward"]])

    frags["ball"] = ball_f
    frags["per_play"] = pp[PER_PLAY_COLS]
    frags["receivers"] = per_receiver
    frags["sep"] = per_play_sep
    frags["qb"] = qb
    return frags, ex_b + ex_p


# ------------------------------------------------------------------ build_store

def build_store(data_dir: Path = DATA_DIR, *, allow_last_frame_fallback: bool = True) -> Store:
    """Construye las nueve tablas del Processed_Store. No escribe nada a disco."""
    data_dir = Path(data_dir)
    t0 = time.perf_counter()

    plays = pd.read_csv(data_dir / "plays.csv", usecols=PLAYS_SRC_COLS, na_values=NA_VALUES)
    players_raw = pd.read_csv(data_dir / "players.csv", usecols=PLAYER_COLS, na_values=NA_VALUES)
    pff = pd.read_csv(data_dir / "pffScoutingData.csv", usecols=PFF_COLS, na_values=NA_VALUES)

    plays = plays[plays["passResult"].notna()].sort_values(_KEYS, kind="stable").reset_index(drop=True)
    plays["pidx"] = np.arange(len(plays), dtype="int32")
    play_keys = plays[_KEYS + ["pidx"]].astype({"gameId": "int64", "playId": "int32"})

    pff["nflId"] = pff["nflId"].astype("float64")
    roles = (pff.dropna(subset=["nflId"])
             .drop_duplicates(_KEYS + ["nflId"], keep="first")[_KEYS + ["nflId", "pff_role"]]
             .rename(columns={"pff_role": "role"})
             .astype({"gameId": "int64", "playId": "int32"}))

    files = sorted((data_dir / "tracking").glob("tracking_*.csv"))
    ball_f, pp_f, rec_f, sep_f, qb_f = [], [], [], [], []
    processed = skipped = excluded = 0
    for path in files:
        try:
            df = pd.read_csv(path, usecols=TRACKING_COLS, dtype=TRACKING_DTYPES, na_values=NA_VALUES)
            frags, ex = _reduce_file(df, play_keys, roles, allow_last_frame_fallback)
        except Exception as exc:  # archivo corrupto: se descartan sus fragmentos
            log.error("Archivo de tracking omitido %s: %s", path.name, exc)
            skipped += 1
            continue
        finally:
            df = None
        ball_f.append(frags["ball"]); pp_f.append(frags["per_play"])
        rec_f.append(frags["receivers"]); sep_f.append(frags["sep"]); qb_f.append(frags["qb"])
        excluded += ex
        processed += 1
    log.info("Tracking: %d archivos procesados, %d omitidos (de %d)", processed, skipped, len(files))
    log.info("Filas excluidas por playDirection invalido: %d", excluded)
    if processed == 0:
        log.error("Ningun archivo de tracking pudo procesarse")
        raise NoTrackingDataError("No se proceso ningun archivo de tracking")
    log.info("Lectura y reduccion de tracking: %.2f s", time.perf_counter() - t0)

    tables: dict[str, pd.DataFrame] = {}

    def timed(name: str, fn) -> None:
        t = time.perf_counter()
        tbl = fn()
        if len(tbl) < 1:
            raise NoTrackingDataError(f"La tabla {name} quedo vacia")
        tables[name] = tbl
        log.info("Tabla %s: %.2f s, %d filas", name, time.perf_counter() - t, len(tbl))

    # --- plays
    def make_plays() -> pd.DataFrame:
        p = plays.copy()
        target = infer_targets(p, pff, players_raw)
        pp = _cat(pp_f, PER_PLAY_COLS)
        pp = pp.drop_duplicates(_KEYS, keep="first")
        p = p.merge(pp.astype({"gameId": "int64", "playId": "int32"}), on=_KEYS, how="left")
        sep = _cat(sep_f, ["gameId", "playId", "min_separation", "min_sep_nflId", "min_sep_x", "min_sep_y"])
        p = p.merge(sep[_KEYS + ["min_separation"]].astype({"gameId": "int64", "playId": "int32"}),
                    on=_KEYS, how="left")
        qb = _cat(qb_f, ["gameId", "playId", "qb_nflId", "qb_x", "qb_y", "qb_frame"])
        p = p.merge(qb[_KEYS + ["qb_x", "qb_y"]].astype({"gameId": "int64", "playId": "int32"}),
                    on=_KEYS, how="left")
        pc = pressure_counts(pff).astype({"gameId": "int64", "playId": "int32"})
        p = p.merge(pc, on=_KEYS, how="left")
        for c in ("n_hurry", "n_hit", "n_sack"):
            p[c] = p[c].fillna(0).astype("int16")
        p["pressure"] = p["pressure"].fillna(False).astype(bool)

        snap = p["snap_frame"].astype("Int16")
        fwd = p["pass_forward_frame"].astype("Int16")
        arr = p["pass_arrived_frame"].astype("Int16")
        ttt = (fwd.astype("float64") - snap.astype("float64")) / 10.0
        p["time_to_throw"] = ttt.where(snap.notna() & fwd.notna() & (fwd >= snap)).astype("float64")
        missing = snap.isna() | fwd.isna() | arr.isna()
        s, f, a = (x.astype("float64") for x in (snap, fwd, arr))
        disorder = (s > f) | (f > a) | (s > a)  # comparaciones con NaN dan False
        p["lacks_phase_data"] = (missing | disorder).astype(bool)
        p["target_nflId"] = target.astype("Int32")

        out = pd.DataFrame({
            "gameId": p["gameId"].astype("int64"),
            "playId": p["playId"].astype("int32"),
            "pidx": p["pidx"].astype("int32"),
            "possessionTeam": p["possessionTeam"].astype(object),
            "defensiveTeam": p["defensiveTeam"].astype(object),
            "offenseFormation": p["offenseFormation"].astype(object),
            "pff_passCoverage": p["pff_passCoverage"].astype(object),
            "pff_passCoverageType": p["pff_passCoverageType"].astype(object),
            "passResult": p["passResult"].astype(object),
            "down": p["down"].astype("Int8"),
            "quarter": p["quarter"].astype("Int8"),
            "yardsToGo": p["yardsToGo"].astype("Int16"),
            "playResult": p["playResult"].astype("float64"),
            "snap_frame": snap,
            "pass_forward_frame": fwd,
            "pass_arrived_frame": arr,
            "last_frame": p["last_frame"].astype("Int16"),
            "arrival_frame": p["arrival_frame"].astype("Int16"),
            "arrival_source": pd.Categorical(p["arrival_source"], categories=["pass_arrived", "last_frame"]),
            "time_to_throw": p["time_to_throw"],
            "n_hurry": p["n_hurry"], "n_hit": p["n_hit"], "n_sack": p["n_sack"],
            "pressure": p["pressure"],
            "lacks_phase_data": p["lacks_phase_data"],
            "min_separation": p["min_separation"].astype("float64"),
            "target_nflId": p["target_nflId"],
            "ball_x": p["ball_x"].astype("float64"), "ball_y": p["ball_y"].astype("float64"),
            "qb_x": p["qb_x"].astype("float64"), "qb_y": p["qb_y"].astype("float64"),
        })
        return out.sort_values(_KEYS, kind="stable").reset_index(drop=True)

    timed("plays", make_plays)
    pl = tables["plays"]
    pidx_of = pl[_KEYS + ["pidx"]]

    # --- ball
    def make_ball() -> pd.DataFrame:
        b = _cat(ball_f, BALL_COLS)
        b = b.astype({"gameId": "int64", "playId": "int32", "frameId": "int16",
                      "x_norm": "float64", "y_norm": "float64", "s": "float64"})
        b["event"] = _event_object(b["event"])
        return b.sort_values(_KEYS + ["frameId"], kind="stable").reset_index(drop=True)

    timed("ball", make_ball)

    # --- receivers
    def make_receivers() -> pd.DataFrame:
        r = _cat(rec_f, ["gameId", "playId", "nflId", "x_norm", "y_norm", "dist_to_nearest_def"])
        r = r.astype({"gameId": "int64", "playId": "int32"}).merge(pidx_of, on=_KEYS, how="inner")
        r = r.merge(pl[["pidx", "target_nflId"]], on="pidx", how="left")
        r["nflId"] = r["nflId"].astype("int64")
        r["is_target"] = (r["target_nflId"].notna() & (r["nflId"] == r["target_nflId"].astype("float64"))).astype(bool)
        r = r[["gameId", "playId", "pidx", "nflId", "x_norm", "y_norm", "dist_to_nearest_def", "is_target"]]
        r = r.astype({"pidx": "int32", "x_norm": "float64", "y_norm": "float64",
                      "dist_to_nearest_def": "float64"})
        return r.sort_values(["gameId", "playId", "nflId"], kind="stable").reset_index(drop=True)

    timed("receivers", make_receivers)
    rec = tables["receivers"]

    # --- rushers
    def make_rushers() -> pd.DataFrame:
        r = pff[pff["pff_role"] == "Pass Rush"].dropna(subset=["nflId"]).copy()
        r = r.merge(pidx_of.astype({"gameId": "int64", "playId": "int32"}),
                    on=_KEYS, how="inner")
        press = sum(pd.to_numeric(r[c], errors="coerce").fillna(0) for c in ("pff_hurry", "pff_hit", "pff_sack"))
        out = pd.DataFrame({
            "gameId": r["gameId"].astype("int64"), "playId": r["playId"].astype("int32"),
            "pidx": r["pidx"].astype("int32"), "nflId": r["nflId"].astype("int64"),
            "pressures": press.astype("int16"),
        })
        out = out.drop_duplicates(_KEYS + ["nflId"], keep="first")
        return out.sort_values(["gameId", "playId", "nflId"], kind="stable").reset_index(drop=True)

    timed("rushers", make_rushers)

    # --- players
    def make_players() -> pd.DataFrame:
        p = players_raw.dropna(subset=["nflId"]).drop_duplicates("nflId", keep="first").copy()
        p["nflId"] = p["nflId"].astype("int64")
        p["displayName"] = p["displayName"].astype(object)
        p["officialPosition"] = p["officialPosition"].astype(object)
        return p[PLAYER_COLS].sort_values("nflId", kind="stable").reset_index(drop=True)

    timed("players", make_players)

    def grid_base(df: pd.DataFrame, x: str, y: str) -> pd.DataFrame:
        df = df[df[x].notna() & df[y].notna()]
        out = pd.DataFrame({
            "gameId": df["gameId"].astype("int64").to_numpy(),
            "playId": df["playId"].astype("int32").to_numpy(),
            "pidx": df["pidx"].astype("int32").to_numpy(),
            "x_bin": _bin(df[x], X_BIN_MAX), "y_bin": _bin(df[y], Y_BIN_MAX),
        })
        return out

    # --- grid_targets
    def make_grid_targets() -> pd.DataFrame:
        base = pl.loc[pl["arrival_frame"].notna(), _KEYS + ["pidx", "arrival_source", "target_nflId",
                                                            "ball_x", "ball_y"]].copy()
        base["x"], base["y"] = base["ball_x"], base["ball_y"]
        base["pos_source"] = "ball"
        tg = base[(base["arrival_source"] == "last_frame") & base["target_nflId"].notna()]
        if len(tg):
            m = tg[["pidx", "target_nflId"]].assign(nflId=lambda d: d["target_nflId"].astype("int64"))
            m = m.merge(rec[["pidx", "nflId", "x_norm", "y_norm"]], on=["pidx", "nflId"], how="inner")
            m = m.drop_duplicates("pidx").set_index("pidx")
            hit = base["pidx"].isin(m.index) & (base["arrival_source"] == "last_frame")
            base.loc[hit, "x"] = base.loc[hit, "pidx"].map(m["x_norm"]).to_numpy()
            base.loc[hit, "y"] = base.loc[hit, "pidx"].map(m["y_norm"]).to_numpy()
            base.loc[hit, "pos_source"] = "receiver"
        g = grid_base(base, "x", "y")
        g["pos_source"] = base.loc[base["x"].notna() & base["y"].notna(), "pos_source"].to_numpy()
        return g.sort_values(["pidx"], kind="stable").reset_index(drop=True)

    timed("grid_targets", make_grid_targets)

    # --- grid_routes
    def make_grid_routes() -> pd.DataFrame:
        g = grid_base(rec, "x_norm", "y_norm")
        sub = rec[rec["x_norm"].notna() & rec["y_norm"].notna()]
        g["nflId"] = sub["nflId"].astype("int64").to_numpy()
        return g.sort_values(["pidx", "nflId"], kind="stable").reset_index(drop=True)

    timed("grid_routes", make_grid_routes)

    # --- grid_pocket_pressure
    def make_grid_pressure() -> pd.DataFrame:
        base = pl[pl["qb_x"].notna() & pl["qb_y"].notna()]
        g = grid_base(base, "qb_x", "qb_y")
        g["pressure"] = base["pressure"].astype(bool).to_numpy()
        return g.sort_values(["pidx"], kind="stable").reset_index(drop=True)

    timed("grid_pocket_pressure", make_grid_pressure)

    # --- grid_separation
    def make_grid_separation() -> pd.DataFrame:
        sep = _cat(sep_f, ["gameId", "playId", "min_separation", "min_sep_nflId", "min_sep_x", "min_sep_y"])
        sep = sep.astype({"gameId": "int64", "playId": "int32"}).merge(pidx_of, on=_KEYS, how="inner")
        g = grid_base(sep, "min_sep_x", "min_sep_y")
        sub = sep[sep["min_sep_x"].notna() & sep["min_sep_y"].notna()]
        g["min_separation"] = sub["min_separation"].astype("float64").to_numpy()
        g["nflId"] = sub["min_sep_nflId"].astype("int64").to_numpy()
        return g.sort_values(["pidx"], kind="stable").reset_index(drop=True)

    timed("grid_separation", make_grid_separation)

    log.info("Store completo en %.2f s", time.perf_counter() - t0)
    return Store(tables=tables)


# ------------------------------------------------------------------ Persist_Run

def main(data_dir: Path = DATA_DIR, out_dir: Path = PROCESSED_DIR) -> int:
    """Persist_Run: construye el store y lo escribe en out_dir. Devuelve el codigo de salida."""
    from backend.store import PersistError, save_store

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        store = build_store(data_dir)
        save_store(store, out_dir)
    except NoTrackingDataError as exc:
        log.error("Persist_Run fallo: %s", exc)
        return 1
    except PersistError as exc:
        log.error("Persist_Run fallo al escribir: %s", exc)
        return 1
    log.info("Persist_Run completo: %d tablas en %s", len(store.tables), out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
