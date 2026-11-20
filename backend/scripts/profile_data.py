"""Perfilado de los datos crudos. Genera DATA_REPORT.md en la raíz del proyecto.

Uso (desde la raíz):  .venv/bin/python -m backend.scripts.profile_data

Los archivos de tracking se leen de uno en uno; solo se conservan contadores y
conjuntos de llaves. Los datos de `data/` se abren únicamente en modo lectura.
"""
from __future__ import annotations

import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
REPORT_NAME = "DATA_REPORT.md"

NULL_LITERALS = {"", "NA", "None"}
NULL_LABEL = "(nulo)"
TABLES = ("games", "plays", "players", "pffScoutingData")
VALUE_COUNT_SPECS = (
    ("passResult", "plays"),
    ("offenseFormation", "plays"),
    ("pff_passCoverage", "plays"),
    ("pff_passCoverageType", "plays"),
    ("pff_role", "pffScoutingData"),
    ("event", "tracking"),
    ("officialPosition", "players"),
)


class ProfileError(Exception):
    """Error de entrada con la ruta afectada."""

    def __init__(self, path: Path, description: str):
        super().__init__(f"{path}: {description}")
        self.path = path
        self.description = description


def _read_str(path: Path) -> pd.DataFrame:
    """Lee un CSV completo como texto, sin convertir literales a nulos."""
    try:
        return pd.read_csv(path, dtype=str, keep_default_na=False, na_filter=False)
    except Exception as exc:  # archivo ausente, ilegible o mal formado
        raise ProfileError(path, f"{type(exc).__name__}: {exc}") from exc


def _null_mask(s: pd.Series) -> pd.Series:
    return s.isin(NULL_LITERALS)


def _pct(part: int, total: int) -> float:
    return round(100.0 * part / total, 2) if total else 0.0


def _value_counts(s: pd.Series) -> Counter:
    vals = s.where(~_null_mask(s), NULL_LABEL)
    return Counter(vals.value_counts(dropna=False).to_dict())


class TrackingStats:
    """Acumulador con contadores y conjuntos de llaves del tracking."""

    def __init__(self) -> None:
        self.files = 0
        self.rows = 0
        self.columns: list[str] | None = None
        self.null_counts: Counter = Counter()
        self.game_ids: set[str] = set()
        self.play_keys: set[str] = set()
        self.nfl_ids: set[str] = set()
        self.events: Counter = Counter()
        self.tracks = 0
        self.tracks_discontinuous = 0

    def add(self, df: pd.DataFrame, path: Path) -> None:
        cols = list(df.columns)
        if self.columns is None:
            self.columns = cols
        elif cols != self.columns:
            raise ProfileError(path, "encabezado distinto al de los demás archivos de tracking")
        required = {"gameId", "playId", "nflId", "frameId", "event"}
        missing = required - set(cols)
        if missing:
            raise ProfileError(path, f"faltan columnas: {sorted(missing)}")

        self.files += 1
        self.rows += len(df)
        for c in cols:
            self.null_counts[c] += int(_null_mask(df[c]).sum())

        self.game_ids.update(df["gameId"].unique())
        self.play_keys.update((df["gameId"] + "_" + df["playId"]).unique())
        nfl = df["nflId"]
        self.nfl_ids.update(nfl[~_null_mask(nfl)].unique())
        self.events.update(_value_counts(df["event"]))

        # Continuidad de frameId por track (gameId, playId, nflId). El balón
        # (nflId nulo) forma un track propio por jugada.
        frame = pd.to_numeric(df["frameId"], errors="coerce")
        keys = pd.DataFrame(
            {
                "g": df["gameId"],
                "p": df["playId"],
                "n": nfl.where(~_null_mask(nfl), "ball"),
                "f": frame,
            }
        )
        grp = keys.groupby(["g", "p", "n"], sort=False)["f"]
        agg = grp.agg(["min", "max", "count", "nunique", "size"])
        ok = (
            (agg["min"] == 1)
            & (agg["max"] == agg["nunique"])
            & (agg["size"] == agg["nunique"])
            & (agg["count"] == agg["size"])
        )
        self.tracks += len(agg)
        self.tracks_discontinuous += int((~ok).sum())


def _orphans(a: set, b: set) -> tuple[int, float]:
    n = len(a - b)
    return n, _pct(n, len(a))


def _md_table(headers: list[str], rows: list[list]) -> str:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("|", "\\|") for c in r) + " |")
    return "\n".join(out)


def _null_section(name: str, columns: list[str], nulls: Counter, total: int) -> str:
    rows = [[c, _pct(nulls[c], total)] for c in columns]
    return f"### {name}\n\nFilas: {total}\n\n" + _md_table(["Columna", "% nulos"], rows) + "\n"


def profile(data_dir: Path) -> tuple[str, dict]:
    """Lee todo y devuelve (texto del reporte, resumen). No escribe nada."""
    data_dir = Path(data_dir)
    frames: dict[str, pd.DataFrame] = {}
    for t in TABLES:
        frames[t] = _read_str(data_dir / f"{t}.csv")

    tracking_dir = data_dir / "tracking"
    files = sorted(tracking_dir.glob("tracking_*.csv")) if tracking_dir.is_dir() else []
    if not files:
        raise ProfileError(tracking_dir, "no se encontró ningún Tracking_File (tracking_*.csv)")

    tr = TrackingStats()
    for f in files:
        df = _read_str(f)
        tr.add(df, f)
        del df

    games, plays, players, pff = (frames[t] for t in TABLES)
    for t, cols in (("games", {"gameId", "week", "gameDate", "homeTeamAbbr", "visitorTeamAbbr"}),
                    ("plays", {"gameId", "playId"}),
                    ("players", {"nflId"}),
                    ("pffScoutingData", {"gameId", "playId", "nflId"})):
        missing = cols - set(frames[t].columns)
        if missing:
            raise ProfileError(data_dir / f"{t}.csv", f"faltan columnas: {sorted(missing)}")

    # Llaves
    g_games, g_plays, g_pff = set(games["gameId"]), set(plays["gameId"]), set(pff["gameId"])
    g_track = tr.game_ids
    all_games = g_games | g_plays | g_pff | g_track
    p_plays = set(plays["gameId"] + "_" + plays["playId"])
    p_pff = set(pff["gameId"] + "_" + pff["playId"])
    p_track = tr.play_keys
    n_players = set(players["nflId"][~_null_mask(players["nflId"])])
    n_pff = set(pff["nflId"][~_null_mask(pff["nflId"])])
    n_track = tr.nfl_ids

    # Semanas y fechas
    weeks = sorted({int(w) for w in games["week"] if w not in NULL_LITERALS and w.lstrip("-").isdigit()})
    dates = []
    for d in games["gameDate"]:
        if d in NULL_LITERALS:
            continue
        try:
            dates.append(datetime.strptime(d, "%m/%d/%Y").date())
        except ValueError:
            continue
    teams = sorted({t for t in pd.concat([games["homeTeamAbbr"], games["visitorTeamAbbr"]]) if t not in NULL_LITERALS})

    L: list[str] = []
    L.append("# DATA_REPORT\n")
    L.append("Reporte generado por `backend/scripts/profile_data.py`. Los literales vacío, `NA` y `None` cuentan como nulos.\n")
    L.append("## Resumen general\n")
    L.append(_md_table(["Métrica", "Valor"], [
        ["Archivos de tracking leídos", tr.files],
        ["Filas de tracking (suma de todos los archivos)", tr.rows],
        ["gameId distintos (unión de todas las fuentes)", len(all_games)],
        ["gameId distintos en games.csv", len(g_games)],
        ["gameId distintos en plays.csv", len(g_plays)],
        ["gameId distintos en tracking", len(g_track)],
        ["Jugadas distintas (gameId+playId) en plays.csv", len(p_plays)],
        ["Jugadas distintas (gameId+playId) en tracking", len(p_track)],
        ["Jugadas distintas (gameId+playId) en pffScoutingData", len(p_pff)],
        ["Jugadas distintas (unión de las tres fuentes)", len(p_plays | p_pff | p_track)],
    ]) + "\n")
    L.append("## Cobertura temporal y equipos\n")
    L.append(f"- Semana mínima: {weeks[0] if weeks else 'n/d'}")
    L.append(f"- Semana máxima: {weeks[-1] if weeks else 'n/d'}")
    L.append(f"- Semanas presentes: {', '.join(map(str, weeks)) if weeks else 'n/d'}")
    L.append(f"- Fecha de juego más temprana: {min(dates).isoformat() if dates else 'n/d'}")
    L.append(f"- Fecha de juego más tardía: {max(dates).isoformat() if dates else 'n/d'}")
    L.append(f"- Equipos ({len(teams)}): {', '.join(teams)}\n")

    L.append("## Columnas y porcentaje de nulos\n")
    for t in TABLES:
        df = frames[t]
        nulls = Counter({c: int(_null_mask(df[c]).sum()) for c in df.columns})
        L.append(_null_section(f"{t}.csv", list(df.columns), nulls, len(df)))
    L.append(_null_section(f"tracking/*.csv ({tr.files} archivos)", tr.columns or [], tr.null_counts, tr.rows))

    L.append("## Llaves huérfanas\n")
    L.append("Huérfanas de A respecto a B = llaves de A que no existen en B; el porcentaje es sobre las llaves distintas de A.\n")
    relations = [
        ("gameId", "games", g_games, "plays", g_plays),
        ("gameId", "games", g_games, "tracking", g_track),
        ("gameId", "plays", g_plays, "tracking", g_track),
        ("gameId+playId", "plays", p_plays, "pffScoutingData", p_pff),
        ("gameId+playId", "plays", p_plays, "tracking", p_track),
        ("gameId+playId", "pffScoutingData", p_pff, "tracking", p_track),
        ("nflId", "players", n_players, "pffScoutingData", n_pff),
        ("nflId", "players", n_players, "tracking", n_track),
        ("nflId", "pffScoutingData", n_pff, "tracking", n_track),
    ]
    rows = []
    for key, na, a, nb, b in relations:
        c1, p1 = _orphans(a, b)
        c2, p2 = _orphans(b, a)
        rows.append([key, f"{na} → {nb}", len(a), c1, p1, f"{nb} → {na}", len(b), c2, p2])
    L.append(_md_table(
        ["Llave", "Dirección A→B", "Llaves en A", "Huérfanas", "% huérfanas",
         "Dirección B→A", "Llaves en B", "Huérfanas", "% huérfanas"], rows) + "\n")
    L.append("`nflId` de tracking excluye las filas del balón (nflId nulo).\n")

    L.append("## Continuidad de frameId\n")
    L.append(f"Un track es una combinación gameId+playId+nflId (el balón, con nflId nulo, es un track por jugada). "
             f"Es continuo si sus frameId son enteros consecutivos desde 1, sin repetidos.\n")
    L.append(_md_table(["Tracks", "No continuos", "% no continuos"],
                       [[tr.tracks, tr.tracks_discontinuous, _pct(tr.tracks_discontinuous, tr.tracks)]]) + "\n")

    L.append("## Valores únicos por columna\n")
    sources = {"plays": plays, "pffScoutingData": pff, "players": players}
    # pff_passCoverage* viven en plays.csv en estos datos; se busca en cualquier tabla que las tenga.
    for col, preferred in VALUE_COUNT_SPECS:
        if col == "event":
            counts = tr.events
            src = "tracking"
        else:
            df = sources.get(preferred)
            if df is None or col not in df.columns:
                df, src = next(((d, n) for n, d in sources.items() if col in d.columns), (None, preferred))
            else:
                src = preferred
            counts = _value_counts(df[col]) if df is not None else Counter()
        ordered = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        L.append(f"### {col} ({src})\n")
        if not ordered:
            L.append(f"Columna `{col}` no encontrada.\n")
            continue
        L.append(_md_table(["Valor", "Conteo"], [[k, v] for k, v in ordered]) + "\n")

    summary = {
        "files": tr.files,
        "tracking_rows": tr.rows,
        "games": len(all_games),
        "plays": len(p_plays | p_pff | p_track),
    }
    return "\n".join(L), summary


def main(data_dir: Path | None = None, report_path: Path | None = None) -> int:
    data_dir = Path(data_dir) if data_dir else DATA_DIR
    report_path = Path(report_path) if report_path else ROOT / REPORT_NAME
    try:
        text, s = profile(data_dir)
    except ProfileError as exc:
        print(f"ERROR: {exc.path}: {exc.description}", file=sys.stderr)
        return 1
    except Exception as exc:  # cualquier otro fallo de lectura
        print(f"ERROR: {data_dir}: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1

    try:
        report_path.write_text(text, encoding="utf-8")
    except OSError as exc:
        print(f"ERROR: {report_path}: {exc}", file=sys.stderr)
        return 1

    print(f"Archivos de tracking leídos: {s['files']}")
    print(f"Filas de tracking totales: {s['tracking_rows']}")
    print(f"gameId distintos: {s['games']}")
    print(f"Jugadas distintas: {s['plays']}")
    print(f"Reporte: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
