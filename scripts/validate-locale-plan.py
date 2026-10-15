"""Validate that locale-plan CSVs share one complete, reviewable catalog."""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from pathlib import Path


TOKEN_RE = re.compile(
    r"https?://[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+"
    r"|</?[^>]+>|\{\{[^{}]+\}\}|\{[^{}]+\}|\$\{[^{}]+\}"
)


def load(path: Path) -> tuple[list[str], list[list[str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    return rows[0], rows[1:]


def key(row: list[str]) -> tuple[str, str, str, str]:
    return row[0], row[1], row[2], row[3]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("locales", nargs="+")
    args = parser.parse_args()

    baseline: list[tuple[str, str, str, str]] | None = None
    failed = False

    for locale in args.locales:
        path = args.directory / f"{locale}.csv"
        header, rows = load(path)
        keys = [key(row) for row in rows]
        blanks = sum(
            1
            for row in rows
            if len(row) != 8 or (row[3].strip() and not row[4].strip())
        )
        token_mismatches = sum(
            1
            for row in rows
            if len(row) == 8
            and Counter(TOKEN_RE.findall(row[3])) != Counter(TOKEN_RE.findall(row[4]))
        )
        duplicate_keys = len(keys) - len(set(keys))

        if baseline is None:
            baseline = keys
        same_catalog = keys == baseline
        valid_header = len(header) == 8 and header[4].endswith("(borrador IA)")
        ok = (
            valid_header
            and len(rows) == 3604
            and not blanks
            and not token_mismatches
            and not duplicate_keys
            and same_catalog
        )
        failed = failed or not ok
        print(
            f"{locale}: rows={len(rows)} blanks={blanks} "
            f"token_mismatches={token_mismatches} duplicates={duplicate_keys} "
            f"same_catalog={same_catalog} ok={ok}"
        )

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
