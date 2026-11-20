"""Constantes compartidas del ETL y la API."""
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "data"
PROCESSED_DIR = DATA_DIR / "processed"

# Columnas de tracking que se leen (no hay displayName en tracking).
TRACKING_COLS = [
    "gameId", "playId", "nflId", "frameId", "team",
    "playDirection", "x", "y", "s", "event",
]
TRACKING_DTYPES = {
    "gameId": "int64",
    "playId": "int32",
    "nflId": "float64",
    "frameId": "int16",
    "team": "category",
    "playDirection": "category",
    "x": "float64",
    "y": "float64",
    "s": "float64",
    "event": "category",
}

NA_VALUES = ["NA", "None"]

# Evento canónico -> nombres de evento aceptados (el manual tiene prioridad).
EVENT_ALIASES = {
    "snap": ("ball_snap", "autoevent_ballsnap"),
    "forward": ("pass_forward", "autoevent_passforward"),
    "arrived": ("pass_arrived",),
}
USE_AUTOEVENTS = True

LAYERS = ("targets", "routes", "pocket_pressure", "separation")
PASS_RESULTS = ["C", "I", "S", "R", "IN"]

GRID_SIZE = 5
X_BIN_MAX = 115
Y_BIN_MAX = 50

TABLE_NAMES = (
    "plays", "ball", "receivers", "rushers", "players",
    "grid_targets", "grid_routes", "grid_pocket_pressure", "grid_separation",
)
