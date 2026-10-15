/**
 * Apply {en: translated} maps onto locales/{xx}-keys.csv draft column.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCALE_DIR = path.resolve(HERE, "../../spanish-site-translation-plan/locales");

export function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQ = false;
  const src = text.replace(/^\uFEFF/, "");
  while (i < src.length) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n" || (ch === "\r" && src[i + 1] === "\n")) {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      if (ch === "\r") i++;
      i++;
      continue;
    }
    if (ch === "\r") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function esc(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function shouldKeepEnglish(en) {
  const t = en.trim();
  if (!t) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^mailto:/i.test(t)) return true;
  if (/^\/[A-Za-z0-9/_-]+$/.test(t)) return true;
  if (/^[A-Z]{2,5}$/.test(t)) return true;
  if (/^(FXStreet|EUR\/USD|GBP\/USD|USD\/JPY|XAU\/USD|BTC|ETH|NFP)$/i.test(t))
    return true;
  if (/@/.test(t) && !/\s/.test(t)) return true;
  return false;
}

function uniqueFromCsv(file) {
  const rows = parseCsv(readFileSync(file, "utf8"));
  const set = new Set();
  for (const row of rows.slice(1)) {
    const en = row[3] ?? "";
    if (en && !shouldKeepEnglish(en)) set.add(en);
  }
  return [...set];
}

const mode = process.argv[2];
const isMain = process.argv[1] && process.argv[1].includes("fill-locale-drafts");

if (isMain && mode === "extract") {
  const file = process.argv[3];
  const out = process.argv[4];
  const uniq = uniqueFromCsv(file);
  writeFileSync(out, JSON.stringify(uniq, null, 2), "utf8");
  console.log(uniq.length, "→", out);
} else if (isMain && mode === "apply") {
  const csvFile = process.argv[3];
  const mapFile = process.argv[4];
  const map = JSON.parse(readFileSync(mapFile, "utf8"));
  const rows = parseCsv(readFileSync(csvFile, "utf8"));
  let filled = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const en = row[3] ?? "";
    if (shouldKeepEnglish(en)) {
      row[4] = en;
      filled++;
      continue;
    }
    if (map[en]) {
      row[4] = map[en];
      filled++;
    }
  }
  const lines = rows.map((r) => r.map(esc).join(","));
  writeFileSync(csvFile, `${lines.join("\n")}\n`, "utf8");
  console.log(`applied ${filled}/${rows.length - 1} → ${csvFile}`);
} else if (isMain && mode === "stats") {
  const files = [
    "it", "fr", "de", "pt", "id", "ar", "vi", "zh", "ru", "tr", "hu", "ja",
  ];
  for (const loc of files) {
    const file = path.join(LOCALE_DIR, `${loc}-keys.csv`);
    if (!existsSync(file)) continue;
    const uniq = uniqueFromCsv(file);
    const bytes = readFileSync(file).length;
    console.log(
      loc,
      "unique",
      uniq.length,
      "kb",
      Math.round(bytes / 1024),
    );
  }
} else if (isMain) {
  console.error("Usage: extract <csv> <out.json> | apply <csv> <map.json> | stats");
  process.exit(1);
}
