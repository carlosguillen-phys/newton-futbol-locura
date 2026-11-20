"""Escritores de CSV sintéticos para las pruebas."""
from pathlib import Path

import pandas as pd


def write_games(data_dir: Path, rows=None) -> Path:
    rows = rows or [
        {"gameId": 1, "season": 2021, "week": 1, "gameDate": "09/09/2021",
         "gameTimeEastern": "20:20:00", "homeTeamAbbr": "TB", "visitorTeamAbbr": "DAL"},
    ]
    p = Path(data_dir) / "games.csv"
    p.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(p, index=False)
    return p


def write_plays(data_dir: Path, rows=None) -> Path:
    rows = rows or [
        {"gameId": 1, "playId": 10, "playDescription": "(1:00) A.Qb pass short left to B.Rec.",
         "quarter": 1, "down": 1, "yardsToGo": 10, "possessionTeam": "TB",
         "defensiveTeam": "DAL", "passResult": "C", "playResult": 5,
         "offenseFormation": "SHOTGUN", "pff_passCoverage": "Cover-3",
         "pff_passCoverageType": "Zone"},
    ]
    p = Path(data_dir) / "plays.csv"
    p.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(p, index=False, na_rep="NA")
    return p


def write_players(data_dir: Path, rows=None) -> Path:
    rows = rows or [
        {"nflId": 1, "officialPosition": "QB", "displayName": "Al Qb"},
        {"nflId": 2, "officialPosition": "WR", "displayName": "Bob Rec"},
        {"nflId": 3, "officialPosition": "CB", "displayName": "Cy Def"},
        {"nflId": 4, "officialPosition": "DE", "displayName": "Di Rush"},
    ]
    p = Path(data_dir) / "players.csv"
    p.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(p, index=False, na_rep="NA")
    return p


def write_pff(data_dir: Path, rows=None) -> Path:
    rows = rows or [
        {"gameId": 1, "playId": 10, "nflId": 1, "pff_role": "Pass"},
        {"gameId": 1, "playId": 10, "nflId": 2, "pff_role": "Pass Route"},
        {"gameId": 1, "playId": 10, "nflId": 3, "pff_role": "Coverage"},
        {"gameId": 1, "playId": 10, "nflId": 4, "pff_role": "Pass Rush",
         "pff_hurry": 1},
    ]
    p = Path(data_dir) / "pffScoutingData.csv"
    p.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)
    for c in ("pff_hit", "pff_hurry", "pff_sack"):
        if c not in df:
            df[c] = pd.NA
    df.to_csv(p, index=False, na_rep="NA")
    return p


def write_tracking(data_dir: Path, game_id: int = 1, rows=None) -> Path:
    """Escribe tracking/tracking_<gameId>.csv. `rows` es lista de dicts con
    columnas de tracking; `event` ausente se escribe como 'None'."""
    cols = ["gameId", "playId", "nflId", "frameId", "time", "jerseyNumber", "team",
            "playDirection", "x", "y", "s", "a", "dis", "o", "dir", "event"]
    if rows is None:
        rows = []
        ents = [(1, "TB", 20.0, 25.0), (2, "TB", 25.0, 20.0),
                (3, "DAL", 26.0, 21.0), (4, "DAL", 18.0, 25.0),
                (None, "football", 20.0, 25.0)]
        events = {1: "ball_snap", 3: "pass_forward"}
        for f in range(1, 6):
            for nfl, team, x, y in ents:
                rows.append({"gameId": game_id, "playId": 10, "nflId": nfl,
                             "frameId": f, "team": team, "playDirection": "right",
                             "x": x + f * 0.1, "y": y, "s": 1.0,
                             "event": events.get(f, "None")})
    df = pd.DataFrame(rows)
    for c in cols:
        if c not in df:
            df[c] = "None" if c == "event" else 0
    df["event"] = df["event"].fillna("None")
    p = Path(data_dir) / "tracking" / f"tracking_{game_id}.csv"
    p.parent.mkdir(parents=True, exist_ok=True)
    df[cols].to_csv(p, index=False, na_rep="NA")
    return p


def write_all(data_dir: Path) -> Path:
    write_games(data_dir)
    write_plays(data_dir)
    write_players(data_dir)
    write_pff(data_dir)
    write_tracking(data_dir)
    return Path(data_dir)
