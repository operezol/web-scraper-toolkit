import { writeFileSync } from "node:fs";
import path from "node:path";
import { parseCsv, esc, shouldKeepEnglish } from "./fill-locale-drafts.mjs";
import { readFileSync } from "node:fs";

const DIR = "c:/Users/oriol/source/repos/spanish-site-translation-plan/locales";
const locales = ["it", "fr", "de", "pt", "id", "ar", "vi", "zh", "ru", "tr", "hu", "ja"];

for (const loc of locales) {
  const file = path.join(DIR, `${loc}-keys.csv`);
  const rows = parseCsv(readFileSync(file, "utf8"));
  let n = 0;
  for (let i = 1; i < rows.length; i++) {
    const en = rows[i][3] ?? "";
    if (shouldKeepEnglish(en) && !(rows[i][4] || "").trim()) {
      rows[i][4] = en;
      n++;
    }
  }
  writeFileSync(file, `${rows.map((r) => r.map(esc).join(",")).join("\n")}\n`, "utf8");
  console.log(loc, "kept-en", n);
}
