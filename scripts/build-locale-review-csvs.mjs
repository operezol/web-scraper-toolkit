/**
 * One review CSV per locale (no ES-style lots).
 * Scope = sitemap + home links + EN-bounce hrefs remapped to this TLD.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FXSTREET_ARTICLE_RULES,
  FXSTREET_EN_SITE_HOSTS,
  FXSTREET_LOCALE_ORIGINS,
  collectSitemapUrls,
  extractInternalLinksDetailed,
  formatTranslationKeyCsv,
  generateTranslationKeys,
  isArticlePath,
  normalizeInternalPath,
} from "../packages/shared/dist/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPOS = path.resolve(HERE, "../..");
const SITE = path.join(REPOS, "Site");
const OUT_DIR = path.join(REPOS, "spanish-site-translation-plan", "locales");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/** All switcher locales except EN (source) and ES (already in PO lots). */
const LOCALES = FXSTREET_LOCALE_ORIGINS.filter(
  (o) => o.locale !== "en" && o.locale !== "es",
);

function pathFromUrl(url) {
  try {
    return normalizeInternalPath(url);
  } catch {
    return "";
  }
}

async function discover(origin) {
  const startUrl = origin.startUrl;
  const page = new URL(startUrl);
  const allowedHosts = [page.hostname, page.hostname.replace(/^www\./, "")];
  if (!page.hostname.startsWith("www.")) allowedHosts.push(`www.${page.hostname}`);
  const rewriteHosts = [...FXSTREET_EN_SITE_HOSTS];

  const inventory = new Set(["/"]);
  const relink = new Set();

  try {
    const sitemap = await collectSitemapUrls({
      origin: `${page.protocol}//${page.host}`,
      allowedHosts,
      timeoutMs: 25_000,
    });
    for (const url of sitemap.urls) {
      const p = pathFromUrl(url);
      if (p && !isArticlePath(p, FXSTREET_ARTICLE_RULES)) inventory.add(p);
    }
  } catch (err) {
    console.warn(`  sitemap skip ${origin.locale}:`, err.message);
  }

  try {
    const res = await fetch(startUrl, {
      headers: HEADERS,
      redirect: "follow",
    });
    if (!res.ok && res.status >= 400) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();
    const links = extractInternalLinksDetailed(html, startUrl, {
      allowedHosts,
      rewriteHostsToOrigin: rewriteHosts,
    });
    for (const link of links) {
      const p = pathFromUrl(link.href);
      if (!p || isArticlePath(p, FXSTREET_ARTICLE_RULES)) continue;
      inventory.add(p);
      if (link.remappedFromEn) relink.add(p);
    }
  } catch (err) {
    console.warn(`  home skip ${origin.locale}:`, err.message);
  }

  return { inventory: [...inventory], relink: [...relink] };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const summary = [];

  for (const origin of LOCALES) {
    console.log(`\n== ${origin.locale} ${origin.startUrl}`);
    const { inventory, relink } = await discover(origin);
    console.log(`  paths ${inventory.length} · relink-EN ${relink.length}`);

    const keys = generateTranslationKeys({
      locale: origin.locale,
      inventoryPaths: inventory,
      relinkPaths: relink,
      siteRoot: SITE,
    });

    const outFile = path.join(OUT_DIR, `${origin.locale}-keys.csv`);
    writeFileSync(
      outFile,
      formatTranslationKeyCsv(keys.included, origin.name),
      "utf8",
    );

    const relinkSet = new Set(relink);
    const pagesFile = path.join(OUT_DIR, `${origin.locale}-pages.csv`);
    const pagesLines = [
      "normalized_path,relink_en",
      ...inventory
        .sort((a, b) => a.localeCompare(b))
        .map((p) => `${p},${relinkSet.has(p) ? "yes" : "no"}`),
    ];
    writeFileSync(pagesFile, `${pagesLines.join("\n")}\n`, "utf8");

    summary.push({
      locale: origin.locale,
      name: origin.name,
      paths: inventory.length,
      relink: relink.length,
      keys: keys.included.length,
      file: outFile,
      pagesFile,
    });
    console.log(`  keys ${keys.included.length} → ${outFile}`);
    console.log(`  pages ${inventory.length} → ${pagesFile}`);
  }

  const md = [
    "# CSVs de revisión por idioma",
    "",
    "Un fichero por locale. Sin lotes 01–06. Borrador IA para que Traducciones solo revise.",
    "",
    "| locale | keys | paths | relink EN | keys file | pages file |",
    "|--------|------|-------|-----------|-----------|------------|",
    ...summary.map(
      (r) =>
        `| ${r.locale} | ${r.keys} | ${r.paths} | ${r.relink} | \`${path.basename(r.file)}\` | \`${path.basename(r.pagesFile)}\` |`,
    ),
    "",
  ].join("\n");
  writeFileSync(path.join(OUT_DIR, "README.md"), md, "utf8");
  writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );
  console.log(`\nWrote ${summary.length} CSVs → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
