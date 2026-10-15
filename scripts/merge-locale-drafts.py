"""Merge previously generated locale drafts into full-catalog CSV files."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def row_key(row: list[str]) -> tuple[str, str, str]:
    return row[0], row[1], row[2]


def merge(source: Path, target: Path, map_path: Path | None = None) -> tuple[int, int]:
    with source.open(encoding="utf-8-sig", newline="") as handle:
        source_rows = list(csv.reader(handle))

    exact_drafts = {
        row_key(row): row[4]
        for row in source_rows[1:]
        if len(row) > 4 and row[4].strip()
    }
    block_key_drafts = {
        (row[1], row[2]): row[4]
        for row in source_rows[1:]
        if len(row) > 4 and row[4].strip()
    }
    english_drafts = {
        row[3]: row[4]
        for row in source_rows[1:]
        if len(row) > 4 and row[3].strip() and row[4].strip()
    }
    if map_path and map_path.exists():
        english_drafts.update(json.loads(map_path.read_text(encoding="utf-8")))

    with target.open(encoding="utf-8-sig", newline="") as handle:
        target_rows = list(csv.reader(handle))

    merged = 0
    for row in target_rows[1:]:
        if len(row) > 4 and not row[4].strip():
            draft = (
                exact_drafts.get(row_key(row))
                or block_key_drafts.get((row[1], row[2]))
                or english_drafts.get(row[3])
            )
            if draft:
                row[4] = draft
                merged += 1

    with target.open("w", encoding="utf-8", newline="") as handle:
        csv.writer(handle, lineterminator="\n").writerows(target_rows)

    remaining = sum(1 for row in target_rows[1:] if len(row) <= 4 or not row[4].strip())
    return merged, remaining


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--target-dir", type=Path, required=True)
    parser.add_argument("--work-dir", type=Path)
    parser.add_argument("locales", nargs="+")
    args = parser.parse_args()

    for locale in args.locales:
        source = args.source_dir / f"{locale}-keys.csv"
        target = args.target_dir / f"{locale}.csv"
        map_path = args.work_dir / f"{locale}-map.json" if args.work_dir else None
        merged, remaining = merge(source, target, map_path)
        print(f"{locale}: merged={merged}, remaining={remaining}")


if __name__ == "__main__":
    main()
