"""Inferencia del receptor objetivo (target) de cada jugada.

`plays.csv` no trae el objetivo del pase. Se extrae el nombre abreviado de
`playDescription` (``... pass deep right to C.Godwin.``) y se compara con los
jugadores `Pass Route` de la jugada. Solo se devuelve un `nflId` cuando hay
exactamente una coincidencia. Funcion pura: sin E/S.
"""

from __future__ import annotations

import logging
import re

import pandas as pd

logger = logging.getLogger(__name__)

TARGET_PASS_RESULTS = ("C", "I", "IN")
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}

# Primer "to <Inicial(es)>.<Apellido>" despues de la palabra "pass".
_PASS_RE = re.compile(r"\bpass\b", re.IGNORECASE)
_TARGET_RE = re.compile(
    r"\bto\s+([A-Z][a-z]?)\.\s?([A-Za-z][A-Za-z'\-]*(?:\s(?:Jr|Sr|II|III|IV)\b\.?)?)"
)


def _norm(text: str) -> str:
    return re.sub(r"[^a-z'\-]", "", text.lower())


def _strip_suffix(tokens: list[str]) -> list[str]:
    tokens = [t.strip(".") for t in tokens if t.strip(".")]
    while len(tokens) > 1 and tokens[-1].lower() in SUFFIXES:
        tokens.pop()
    return tokens


def parse_target_name(description) -> tuple[str, str] | None:
    """Devuelve (iniciales, apellido) en minusculas o None si no hay nombre."""
    if not isinstance(description, str):
        return None
    m = _PASS_RE.search(description)
    if m is None:
        return None
    t = _TARGET_RE.search(description, m.end())
    if t is None:
        return None
    surname_tokens = _strip_suffix(t.group(2).split())
    surname = _norm(" ".join(surname_tokens))
    if not surname:
        return None
    return t.group(1).lower(), surname


def _matches(initials: str, surname: str, first: str, last_tokens: list[str]) -> bool:
    first = _norm(first)
    if not first:
        return False
    if len(initials) == 1:
        if first[0] != initials:
            return False
    elif first != initials and not first.startswith(initials):
        return False
    full = _norm("".join(last_tokens))
    candidates = {full, _norm(last_tokens[-1])} if last_tokens else set()
    for tok in list(candidates):
        if "-" in tok:
            candidates.add(tok.split("-")[-1])
    return surname in candidates or surname.replace("-", "") == full


def _split_name(display_name) -> tuple[str, list[str]] | None:
    if not isinstance(display_name, str):
        return None
    tokens = display_name.split()
    if len(tokens) < 2:
        return None
    return tokens[0], _strip_suffix(tokens[1:])


def infer_targets(plays: pd.DataFrame, pff: pd.DataFrame, players: pd.DataFrame) -> pd.Series:
    """Serie Int32 nullable, con el indice de `plays`, con el nflId del objetivo."""
    result = pd.Series(pd.array([pd.NA] * len(plays), dtype="Int32"), index=plays.index, name="target_nflId")
    if len(plays) == 0:
        return result

    route = pff.loc[pff["pff_role"] == "Pass Route", ["gameId", "playId", "nflId"]]
    route = route.dropna(subset=["nflId"]).drop_duplicates()
    names = players[["nflId", "displayName"]].dropna(subset=["nflId"]).drop_duplicates("nflId")
    route = route.merge(names, on="nflId", how="inner")

    roster: dict[tuple[int, int], list[tuple[int, str, list[str]]]] = {}
    for g, p, nid, dn in zip(route["gameId"], route["playId"], route["nflId"], route["displayName"]):
        split = _split_name(dn)
        if split is None:
            continue
        roster.setdefault((int(g), int(p)), []).append((int(nid), split[0], split[1]))

    values: list = []
    eligible = 0
    resolved = 0
    for g, p, pr, desc in zip(plays["gameId"], plays["playId"], plays["passResult"], plays["playDescription"]):
        if pr not in TARGET_PASS_RESULTS:
            values.append(pd.NA)
            continue
        eligible += 1
        parsed = parse_target_name(desc)
        if parsed is None:
            values.append(pd.NA)
            continue
        initials, surname = parsed
        ids = {
            nid
            for nid, first, last in roster.get((int(g), int(p)), [])
            if _matches(initials, surname, first, last)
        }
        if len(ids) == 1:
            values.append(next(iter(ids)))
            resolved += 1
        else:
            values.append(pd.NA)

    result = pd.Series(pd.array(values, dtype="Int32"), index=plays.index, name="target_nflId")
    ratio = resolved / eligible if eligible else 0.0
    logger.info("targets: resolved %d of %d eligible plays (%.1f%%)", resolved, eligible, 100 * ratio)
    return result
