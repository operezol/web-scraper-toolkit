/**
 * Hybrid locale CSVs:
 * - Crawl 2xx + .relink (Chromium: mega-menus, EN-bounce hrefs)
 * - Sitemap + home fetch (when Playwright is 403-blocked)
 * - Fetch-verify sitemap paths not reached by BFS
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  FXSTREET_ARTICLE_RULES,
  FXSTREET_EN_SITE_HOSTS,
  FXSTREET_LOCALE_ORIGINS,
  collectSitemapUrls,
  csvEscape,
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
const FILL = path.join(HERE, "fill-locale-drafts.mjs");
const WORK = path.join(OUT_DIR, "_work");

const CRAWL_DIR =
  process.argv[2] ??
  path.join(REPOS, "web-scraper-toolkit", "crawls", "2026-09-21");

const LOCALES = FXSTREET_LOCALE_ORIGINS.filter(
  (o) => o.locale !== "en" && o.locale !== "es",
);

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

function pathFromUrl(url) {
  try {
    return normalizeInternalPath(url);
  } catch {
    return "";
  }
}

function parsePagesCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const out = [];
  for (const line of lines.slice(1)) {
    const [normalizedPath, , httpStatus] = line.split(",");
    const status = Number(httpStatus);
    if (normalizedPath && status >= 200 && status < 300) {
      out.push(normalizedPath);
    }
  }
  return out;
}

function parseRelinkCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  return lines
    .slice(1)
    .map((line) => line.split(",")[0])
    .filter(Boolean);
}

async function probe2xx(url) {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

async function discoverFetch(origin) {
  const page = new URL(origin.startUrl);
  const allowedHosts = [page.hostname, page.hostname.replace(/^www\./, "")];
  if (!page.hostname.startsWith("www.")) allowedHosts.push(`www.${page.hostname}`);

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
    const res = await fetch(origin.startUrl, {
      headers: HEADERS,
      redirect: "follow",
    });
    if (res.ok) {
      const html = await res.text();
      const links = extractInternalLinksDetailed(html, origin.startUrl, {
        allowedHosts,
        rewriteHostsToOrigin: [...FXSTREET_EN_SITE_HOSTS],
      });
      for (const link of links) {
        const p = pathFromUrl(link.href);
        if (!p || isArticlePath(p, FXSTREET_ARTICLE_RULES)) continue;
        inventory.add(p);
        if (link.remappedFromEn) relink.add(p);
      }
    }
  } catch (err) {
    console.warn(`  home skip ${origin.locale}:`, err.message);
  }

  return { inventory, relink };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const summary = [];

  for (const origin of LOCALES) {
    console.log(`\n== ${origin.locale} ${origin.startUrl}`);

    const crawlPagesFile = path.join(CRAWL_DIR, `${origin.locale}-pages.csv`);
    const crawlRelinkFile = path.join(CRAWL_DIR, `${origin.locale}-pages.relink.csv`);

    const crawl2xx = existsSync(crawlPagesFile)
      ? parsePagesCsv(readFileSync(crawlPagesFile, "utf8"))
      : [];
    const crawlRelink = existsSync(crawlRelinkFile)
      ? parseRelinkCsv(readFileSync(crawlRelinkFile, "utf8"))
      : [];

    const fetchDisc = await discoverFetch(origin);

    const inventory = new Set([
      ...crawl2xx,
      ...fetchDisc.inventory,
    ]);
    const relink = new Set([
      ...crawlRelink,
      ...fetchDisc.relink,
    ]);

    // Verify fetch-only sitemap paths (skip paths already from crawl 2xx)
    const crawl2xxSet = new Set(crawl2xx);
    const toVerify = [...fetchDisc.inventory].filter((p) => !crawl2xxSet.has(p));
    let verified = 0;
    for (const p of toVerify) {
      const url = new URL(p, origin.startUrl).href;
      if (await probe2xx(url)) {
        inventory.add(p);
        verified++;
      } else {
        inventory.delete(p);
      }
    }

    for (const p of relink) inventory.add(p);

    const inventoryList = [...inventory].sort((a, b) => a.localeCompare(b));
    const relinkList = [...relink].sort((a, b) => a.localeCompare(b));

    console.log(
      `  crawl 2xx=${crawl2xx.length} · relink=${crawlRelink.length} · fetch verify=${verified} · merged paths=${inventoryList.length}`,
    );

    const keys = generateTranslationKeys({
      locale: origin.locale,
      inventoryPaths: inventoryList.filter((p) => !relink.has(p)),
      relinkPaths: relinkList,
      siteRoot: SITE,
    });

    const pagesFile = path.join(OUT_DIR, `${origin.locale}-pages.csv`);
    const relinkOut = path.join(OUT_DIR, `${origin.locale}-pages.relink.csv`);
    const keysFile = path.join(OUT_DIR, `${origin.locale}-keys.csv`);

    writeFileSync(
      pagesFile,
      [
        "normalized_path,source,relink_en",
        ...inventoryList.map((p) => {
          const src = crawl2xxSet.has(p)
            ? "crawl-2xx"
            : relink.has(p)
              ? "relink"
              : "fetch-2xx";
          return `${csvEscape(p)},${src},${relink.has(p) ? "yes" : "no"}`;
        }),
      ].join("\n") + "\n",
      "utf8",
    );

    if (relinkList.length) {
      writeFileSync(
        relinkOut,
        [
          "normalized_path,note",
          ...relinkList.map(
            (p) =>
              `${csvEscape(p)},enlace heredado a EN; traducir claves y apuntar al mismo path en este TLD`,
          ),
        ].join("\n") + "\n",
        "utf8",
      );
    }

    writeFileSync(
      keysFile,
      formatTranslationKeyCsv(keys.included, origin.name),
      "utf8",
    );

    const mapFile = path.join(WORK, `${origin.locale}-map.json`);
    if (existsSync(mapFile)) {
      spawnSync(process.execPath, [FILL, "apply", keysFile, mapFile], {
        stdio: "inherit",
      });
    }

    summary.push({
      locale: origin.locale,
      name: origin.name,
      crawl2xx: crawl2xx.length,
      relink: relinkList.length,
      paths: inventoryList.length,
      keys: keys.included.length,
      pagesFile,
      keysFile,
    });
    console.log(`  keys ${keys.included.length} → ${keysFile}`);
  }

  spawnSync(process.execPath, [path.join(HERE, "assemble-locale-maps.mjs")], {
    stdio: "inherit",
  });

  const md = [
    "# CSVs de revisión por idioma (híbrido crawl + fetch)",
    "",
    `Crawl Chromium: \`${CRAWL_DIR}\` (menús JS + relink EN).`,
    "Inventario = crawl 2xx ∪ sitemap/home verificado fetch ∪ relinks.",
    "",
    "| locale | keys | paths | crawl 2xx | relink EN | keys file | pages file |",
    "|--------|------|-------|-----------|-----------|-----------|------------|",
    ...summary.map(
      (r) =>
        `| ${r.locale} | ${r.keys} | ${r.paths} | ${r.crawl2xx} | ${r.relink} | \`${path.basename(r.keysFile)}\` | \`${path.basename(r.pagesFile)}\` |`,
    ),
    "",
  ].join("\n");
  writeFileSync(path.join(OUT_DIR, "README.md"), md, "utf8");
  writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  console.log(`\nWrote ${summary.length} locale sets → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
