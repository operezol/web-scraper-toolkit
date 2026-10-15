/**
 * Copy crawl outputs → spanish-site-translation-plan/locales/
 * and re-apply IA draft maps from locales/_work/{locale}-map.json
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPOS = path.resolve(HERE, "../..");
const LOCALE_DIR = path.join(REPOS, "spanish-site-translation-plan", "locales");
const WORK = path.join(LOCALE_DIR, "_work");
const FILL = path.join(HERE, "fill-locale-drafts.mjs");
const ASSEMBLE = path.join(HERE, "assemble-locale-maps.mjs");

const LOCALES = [
  "it", "fr", "de", "pt", "id", "ar", "vi", "zh", "ru", "tr", "hu", "ja",
];

const crawlDir = process.argv[2];
if (!crawlDir) {
  console.error("Usage: node sync-locale-csvs-from-crawl.mjs <crawl-dir>");
  process.exit(1);
}

const absCrawl = path.resolve(crawlDir);
spawnSync(process.execPath, [ASSEMBLE], { stdio: "inherit" });

const summary = [];

for (const locale of LOCALES) {
  const pagesSrc = path.join(absCrawl, `${locale}-pages.csv`);
  const keysSrc = path.join(absCrawl, `${locale}-keys.csv`);
  const relinkSrc = path.join(absCrawl, `${locale}-pages.relink.csv`);
  const pagesDst = path.join(LOCALE_DIR, `${locale}-pages.csv`);
  const keysDst = path.join(LOCALE_DIR, `${locale}-keys.csv`);
  const relinkDst = path.join(LOCALE_DIR, `${locale}-pages.relink.csv`);

  if (!existsSync(pagesSrc) || !existsSync(keysSrc)) {
    console.warn(`skip ${locale}: missing crawl outputs`);
    continue;
  }

  copyFileSync(pagesSrc, pagesDst);
  copyFileSync(keysSrc, keysDst);
  if (existsSync(relinkSrc)) copyFileSync(relinkSrc, relinkDst);

  const mapFile = path.join(WORK, `${locale}-map.json`);
  if (existsSync(mapFile)) {
    spawnSync(process.execPath, [FILL, "apply", keysDst, mapFile], {
      stdio: "inherit",
    });
  }

  const pages = readFileSync(pagesDst, "utf8").trim().split("\n").length - 1;
  const relink = existsSync(relinkDst)
    ? readFileSync(relinkDst, "utf8").trim().split("\n").length - 1
    : 0;
  const keys = readFileSync(keysDst, "utf8").trim().split("\n").length - 1;

  summary.push({ locale, pages, relink, keys, pagesFile: pagesDst, keysFile: keysDst });
  console.log(`✓ ${locale}: ${pages} pages, ${relink} relink, ${keys} keys`);
}

writeFileSync(
  path.join(LOCALE_DIR, "summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

const md = [
  "# CSVs de revisión por idioma (crawl 2xx + menús JS)",
  "",
  `Origen crawl: \`${absCrawl}\``,
  "",
  "Un fichero de claves + inventario de páginas por locale. Sin lotes 01–06.",
  "",
  "| locale | keys | pages 2xx | relink EN | keys file | pages file |",
  "|--------|------|-----------|-----------|-----------|------------|",
  ...summary.map(
    (r) =>
      `| ${r.locale} | ${r.keys} | ${r.pages} | ${r.relink} | \`${path.basename(r.keysFile)}\` | \`${path.basename(r.pagesFile)}\` |`,
  ),
  "",
  "Columnas keys: Carpeta, Bloque, Clave, Inglés, Borrador IA, Revisado, Estado, Comentarios, Paginas.",
  "",
].join("\n");
writeFileSync(path.join(LOCALE_DIR, "README.md"), md, "utf8");

console.log(`\nSynced ${summary.length} locales → ${LOCALE_DIR}`);
