#!/usr/bin/env python
"""
Build the puzzle subset shipped with the app (backlog R2) from the Lichess puzzle database
(CC0, https://database.lichess.org/#puzzles).

Usage (from the repo root; the dump is ~300 MB and is NOT committed):
    curl -L -o /path/lichess_db_puzzle.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst
    python scripts/build-puzzles.py /path/lichess_db_puzzle.csv.zst

Output: public/puzzles/puzzles.json — {"source", "licence", "built", "bands": [...],
"puzzles": [[id, fen, moves, rating, themes], ...]}. Deterministic for a given dump.

Selection (docs/phase-10-plan.md):
  - four in-app bands: 400-999, 1000-1399, 1400-1799, 1800-2300 (rating);
  - per band the PER_BAND most played puzzles that pass: RatingDeviation <= 90,
    Popularity >= 85, NbPlays >= MIN_PLAYS[band], solution <= 8 plies (the first move is
    the opponent's), no promotion/underpromotion oddities are filtered by chess.js at
    runtime, not here;
  - themes trimmed to the first four so the file stays small; GameUrl/OpeningTags dropped.
"""
from __future__ import annotations

import csv
import io
import json
import sys
from datetime import date
from pathlib import Path

import zstandard

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/puzzles/puzzles.json"

BANDS = [
    {"id": "zacatecnik", "label": "začátečník", "min": 400, "max": 999},
    {"id": "lehke", "label": "lehké", "min": 1000, "max": 1399},
    {"id": "stredni", "label": "střední", "min": 1400, "max": 1799},
    {"id": "tezsi", "label": "těžší", "min": 1800, "max": 2300},
]
PER_BAND = 800
MIN_PLAYS = {"zacatecnik": 300, "lehke": 1500, "stredni": 2000, "tezsi": 2000}
MAX_PLIES = 8
MAX_THEMES = 4


def band_of(rating: int) -> dict | None:
    for b in BANDS:
        if b["min"] <= rating <= b["max"]:
            return b
    return None


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("usage: build-puzzles.py <lichess_db_puzzle.csv.zst>")
    src = Path(sys.argv[1])
    candidates: dict[str, list[tuple[int, str, list]]] = {b["id"]: [] for b in BANDS}
    total = 0
    with open(src, "rb") as fh:
        reader = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(fh), encoding="utf-8")
        rd = csv.reader(reader)
        next(rd)  # header
        for row in rd:
            total += 1
            pid, fen, moves, rating, rdev, pop, plays, themes = row[0], row[1], row[2], int(row[3]), int(row[4]), int(row[5]), int(row[6]), row[7]
            b = band_of(rating)
            if b is None or rdev > 90 or pop < 85 or plays < MIN_PLAYS[b["id"]]:
                continue
            if len(moves.split()) > MAX_PLIES:
                continue
            candidates[b["id"]].append((plays, pid, [pid, fen, moves, rating, " ".join(themes.split()[:MAX_THEMES])]))
    puzzles = []
    counts = {}
    for b in BANDS:
        rows = sorted(candidates[b["id"]], key=lambda t: (-t[0], t[1]))[:PER_BAND]
        counts[b["id"]] = len(rows)
        puzzles.extend(r[2] for r in sorted(rows, key=lambda t: t[1]))  # stable order by id
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": "Lichess puzzle database (CC0), https://database.lichess.org/#puzzles",
        "licence": "CC0-1.0",
        "built": date.today().isoformat(),
        "bands": BANDS,
        "puzzles": puzzles,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"read {total} puzzles; per band {counts}; wrote {len(puzzles)} -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} kB)")


if __name__ == "__main__":
    main()
