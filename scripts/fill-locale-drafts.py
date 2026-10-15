"""Fill empty draft cells with offline Argos Translate proposals."""

from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from pathlib import Path

from argostranslate import package, translate


TOKEN_RE = re.compile(
    r"https?://[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+"
    r"|</?[^>]+>|\{\{[^{}]+\}\}|\{[^{}]+\}|\$\{[^{}]+\}"
)


def split_protected(text: str) -> list[tuple[bool, str]]:
    parts: list[tuple[bool, str]] = []
    cursor = 0
    for match in TOKEN_RE.finditer(text):
        parts.append((False, text[cursor : match.start()]))
        parts.append((True, match.group(0)))
        cursor = match.end()
    parts.append((False, text[cursor:]))
    return parts


def ensure_model(target: str) -> None:
    try:
        translate.get_translation_from_codes("en", target)
        return
    except Exception:
        pass

    package.update_package_index()
    candidate = next(
        (
            item
            for item in package.get_available_packages()
            if item.from_code == "en" and item.to_code == target
        ),
        None,
    )
    if candidate is None:
        raise RuntimeError(f"No Argos en→{target} model is available")
    package.install_from_path(candidate.download())


def translate_file(csv_path: Path, target: str) -> tuple[int, int]:
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))

    cached_translator = translate.get_translation_from_codes("en", target)
    translator = getattr(cached_translator, "underlying", cached_translator)
    translator.translate("Warmup.")
    completed = 0
    repaired = 0
    for row in rows[1:]:
        if (
            len(row) > 4
            and row[3].strip()
            and row[4].strip()
            and Counter(TOKEN_RE.findall(row[3])) != Counter(TOKEN_RE.findall(row[4]))
        ):
            row[4] = ""
            repaired += 1

    pending = [
        row for row in rows[1:] if len(row) > 4 and row[3].strip() and not row[4].strip()
    ]

    for start in range(0, len(pending), 32):
        batch_rows = pending[start : start + 32]
        split_rows = [split_protected(row[3]) for row in batch_rows]
        translatable = [
            text
            for parts in split_rows
            for is_token, text in parts
            if not is_token and text.strip()
        ]
        translated: list[str] = []
        for chunk_start in range(0, len(translatable), 64):
            chunk = translatable[chunk_start : chunk_start + 64]
            encoded = [translator.pkg.tokenizer.encode(text) for text in chunk]
            results = translator.translator.translate_batch(encoded, beam_size=1)
            translated.extend(
                translator.pkg.tokenizer.decode(result.hypotheses[0]) for result in results
            )

        translation_index = 0
        for row, parts in zip(batch_rows, split_rows):
            rebuilt: list[str] = []
            for is_token, text in parts:
                if is_token or not text.strip():
                    rebuilt.append(text)
                else:
                    rebuilt.append(translated[translation_index])
                    translation_index += 1
            draft = "".join(rebuilt)
            row[4] = draft if draft.strip() else row[3]
            completed += 1

        with csv_path.open("w", encoding="utf-8", newline="") as handle:
            csv.writer(handle, lineterminator="\n").writerows(rows)
        print(f"{target}: {completed} new drafts", flush=True)

    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        csv.writer(handle, lineterminator="\n").writerows(rows)

    remaining = sum(
        1 for row in rows[1:] if len(row) <= 4 or (row[3].strip() and not row[4].strip())
    )
    print(f"{target}: repaired_invalid_tokens={repaired}", flush=True)
    return completed, remaining


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("locale")
    parser.add_argument("csv", type=Path)
    args = parser.parse_args()

    ensure_model(args.locale)
    completed, remaining = translate_file(args.csv, args.locale)
    print(f"{args.locale}: completed={completed}, remaining={remaining}")


if __name__ == "__main__":
    main()
