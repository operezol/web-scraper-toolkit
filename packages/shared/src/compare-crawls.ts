import type { CrawlBrokenLink, CrawlPage, CrawlResult } from "./crawl-types.js";
import {
  csvEscape,
  type FxstreetSiteBrokenLink,
  type FxstreetSitePage,
} from "./fxstreet-site-crawl.js";

/** First-segment locale → EN when hubs share no children (legacy localizations). */
export const KNOWN_FIRST_SEGMENT_ALIASES: Readonly<Record<string, string>> = {
  "calendario-economico": "economic-calendar",
  "calendrier-economique": "economic-calendar",
  wirtschaftskalender: "economic-calendar",
  "kalender-ekonomi": "economic-calendar",
  educacion: "education",
  formazione: "education",
  formation: "education",
  bildung: "education",
  educacao: "education",
  noticias: "news",
  notizie: "news",
  actualites: "news",
  nachrichten: "news",
  analisis: "analysis",
  analisi: "analysis",
  analyses: "analysis",
  analyse: "analysis",
};

export interface InferredAlias {
  localeSegment: string;
  enSegment: string;
  sharedTails: number;
  source: "known" | "tail-overlap";
}

export interface LocaleCompareRow {
  pathKey: string;
  matchType: string;
  pathEn: string;
  pathLocale: string;
  httpEn: string;
  httpLocale: string;
  envEn: string;
  envLocale: string;
  foundOnEn: string;
  foundOnLocale: string;
  urlEn: string;
  urlLocale: string;
  aliasFamily: string;
  notes: string;
}

export interface LocaleCompareResult {
  rows: LocaleCompareRow[];
  inferredAliases: InferredAlias[];
  byType: Record<string, number>;
}

export function firstPathSegment(path: string): string {
  return path.split("/").filter(Boolean)[0] ?? "";
}

export function pathTail(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.slice(1).join("/");
}

export function rewriteFirstSegment(path: string, newSegment: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return path;
  parts[0] = newSegment;
  return `/${parts.join("/")}`;
}

function indexPages(pages: CrawlPage[]): Map<string, CrawlPage> {
  const map = new Map<string, CrawlPage>();
  for (const p of pages) {
    if (!map.has(p.normalizedPath)) map.set(p.normalizedPath, p);
  }
  return map;
}

function indexBroken(broken: CrawlBrokenLink[]): Map<string, CrawlBrokenLink> {
  const map = new Map<string, CrawlBrokenLink>();
  for (const b of broken) {
    if (!map.has(b.normalizedPath)) map.set(b.normalizedPath, b);
  }
  return map;
}

const GENERIC_TAILS = new Set([
  "latest",
  "feed",
  "news",
  "chart",
  "rates",
  "forecast",
  "indicators",
  "reviews",
  "best",
  "contact-us",
  "about-us",
]);

function isBrokerSeoLanding(path: string): boolean {
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 1) return false;
  const slug = parts[0]!;
  if (slug === "brokers") return false;
  return /broker/i.test(slug);
}

/**
 * Infer locale first-segment → EN first-segment from shared path tails.
 * Example: /calendrier-economique/world-interest-rates ↔ /economic-calendar/world-interest-rates
 */
export function inferFirstSegmentAliases(
  localePaths: string[],
  enPaths: string[],
): InferredAlias[] {
  const enByTail = new Map<string, Set<string>>();
  for (const en of enPaths) {
    const tail = pathTail(en);
    if (!tail) continue;
    const set = enByTail.get(tail) ?? new Set<string>();
    set.add(firstPathSegment(en));
    enByTail.set(tail, set);
  }

  const localeSegsPresent = new Set(
    localePaths.map(firstPathSegment).filter(Boolean),
  );

  const votes = new Map<string, Map<string, number>>();
  for (const loc of localePaths) {
    const tail = pathTail(loc);
    if (!tail) continue;
    const tailHead = tail.split("/")[0] ?? tail;
    if (!tail.includes("/") && GENERIC_TAILS.has(tailHead)) continue;
    const enSegs = enByTail.get(tail);
    if (!enSegs || enSegs.size !== 1) continue;
    const localeSeg = firstPathSegment(loc);
    const enSeg = [...enSegs][0]!;
    if (!localeSeg || localeSeg === enSeg) continue;
    const inner = votes.get(localeSeg) ?? new Map<string, number>();
    inner.set(enSeg, (inner.get(enSeg) ?? 0) + 1);
    votes.set(localeSeg, inner);
  }

  const inferred: InferredAlias[] = [];
  const seen = new Set<string>();

  for (const [localeSeg, knownEn] of Object.entries(KNOWN_FIRST_SEGMENT_ALIASES)) {
    if (!localeSegsPresent.has(localeSeg)) continue;
    inferred.push({
      localeSegment: localeSeg,
      enSegment: knownEn,
      sharedTails: votes.get(localeSeg)?.get(knownEn) ?? 0,
      source: "known",
    });
    seen.add(localeSeg);
  }

  for (const [localeSeg, inner] of votes) {
    if (seen.has(localeSeg)) continue;
    let bestEn = "";
    let bestN = 0;
    for (const [enSeg, n] of inner) {
      if (n > bestN) {
        bestEn = enSeg;
        bestN = n;
      }
    }
    if (bestN >= 1 && bestEn) {
      inferred.push({
        localeSegment: localeSeg,
        enSegment: bestEn,
        sharedTails: bestN,
        source: "tail-overlap",
      });
    }
  }

  return inferred.sort((a, b) => a.localeSegment.localeCompare(b.localeSegment));
}

export function toEnCanonical(
  path: string,
  aliases: ReadonlyMap<string, string>,
): string {
  if (isBrokerSeoLanding(path)) {
    return `/brokers/best/${firstPathSegment(path)}`;
  }
  const seg = firstPathSegment(path);
  const mapped = aliases.get(seg);
  if (mapped && mapped !== seg) {
    return rewriteFirstSegment(path, mapped);
  }
  return path;
}

function aliasFamilyFor(
  pathLocale: string,
  pathEn: string,
  aliases: ReadonlyMap<string, string>,
): string {
  if (pathLocale && isBrokerSeoLanding(pathLocale)) return "brokers-best";
  const locSeg = firstPathSegment(pathLocale);
  const mapped = aliases.get(locSeg);
  if (!mapped) return "";
  if (mapped === "economic-calendar") return "calendar";
  if (mapped === "education") return "education";
  if (mapped === "news") return "news";
  if (mapped === "analysis") return "analysis";
  if (pathLocale && pathEn && pathLocale !== pathEn) return "first-segment";
  return "";
}

function matchType(
  pathEn: string,
  pathLocale: string,
  hasEn: boolean,
  hasLocale: boolean,
  family: string,
): string {
  if (hasEn && hasLocale) {
    if (pathEn === pathLocale) return "same-path";
    if (family === "calendar") return "calendar-alias";
    if (family === "education") return "education-alias";
    if (family === "brokers-best") return "moved-to-brokers-best";
    if (family) return `${family}-alias`;
    return "parallel-other";
  }
  if (hasLocale && !hasEn) return "locale-only";
  if (!hasLocale && hasEn) return "en-only";
  return "neither-accessible";
}

export function mergeLocaleCompare(
  locale: CrawlResult,
  en: CrawlResult,
): LocaleCompareResult {
  const localePages = indexPages(locale.pages);
  const enPages = indexPages(en.pages);
  const localeBroken = indexBroken(locale.broken);
  const enBroken = indexBroken(en.broken);

  const localeOkPaths = [...localePages.keys()];
  const enOkPaths = [...enPages.keys()];
  const inferredAliases = inferFirstSegmentAliases(localeOkPaths, enOkPaths);
  const aliasMap = new Map<string, string>();
  for (const a of inferredAliases) aliasMap.set(a.localeSegment, a.enSegment);

  const keys = new Set<string>();
  for (const p of localePages.keys()) keys.add(toEnCanonical(p, aliasMap));
  for (const p of enPages.keys()) keys.add(p);
  for (const p of localeBroken.keys()) keys.add(toEnCanonical(p, aliasMap));
  for (const p of enBroken.keys()) keys.add(p);

  const rows: LocaleCompareRow[] = [];

  for (const pathKey of [...keys].sort((a, b) => a.localeCompare(b))) {
    const ep = enPages.get(pathKey);
    const lp =
      localePages.get(pathKey) ??
      [...localePages.values()].find(
        (p) => toEnCanonical(p.normalizedPath, aliasMap) === pathKey,
      );

    const eb = !ep ? enBroken.get(pathKey) : undefined;
    const lb = !lp
      ? localeBroken.get(pathKey) ??
        [...localeBroken.values()].find(
          (p) => toEnCanonical(p.normalizedPath, aliasMap) === pathKey,
        )
      : undefined;

    const pathEn = ep?.normalizedPath ?? eb?.normalizedPath ?? "";
    const pathLocale = lp?.normalizedPath ?? lb?.normalizedPath ?? "";
    const hasEn = Boolean(ep);
    const hasLocale = Boolean(lp);
    const family = aliasFamilyFor(pathLocale, pathEn || pathKey, aliasMap);

    const notes: string[] = [];
    if (lb)
      notes.push(
        `locale linked but HTTP ${lb.statusCode || "fail"} from ${lb.foundOn || "(start)"}`,
      );
    if (eb)
      notes.push(
        `en linked but HTTP ${eb.statusCode || "fail"} from ${eb.foundOn || "(start)"}`,
      );
    if (lp && !ep) notes.push("accessible on locale, not in EN crawl");
    if (!lp && ep) notes.push("accessible on EN, not in locale crawl");
    if (family && pathLocale && pathLocale !== pathEn) {
      notes.push(`alias ${firstPathSegment(pathLocale)} → ${aliasMap.get(firstPathSegment(pathLocale))}`);
    }

    rows.push({
      pathKey,
      matchType: matchType(pathEn, pathLocale, hasEn, hasLocale, family),
      pathEn,
      pathLocale,
      httpEn: ep ? String(ep.statusCode) : eb ? String(eb.statusCode) : "",
      httpLocale: lp ? String(lp.statusCode) : lb ? String(lb.statusCode) : "",
      envEn: ep?.label ?? "",
      envLocale: lp?.label ?? "",
      foundOnEn: ep?.foundOn ?? eb?.foundOn ?? "",
      foundOnLocale: lp?.foundOn ?? lb?.foundOn ?? "",
      urlEn: ep?.url ?? eb?.url ?? "",
      urlLocale: lp?.url ?? lb?.url ?? "",
      aliasFamily: family,
      notes: notes.join("; "),
    });
  }

  const byType: Record<string, number> = {};
  for (const r of rows) {
    byType[r.matchType] = (byType[r.matchType] ?? 0) + 1;
  }

  return { rows, inferredAliases, byType };
}

export function pagesToCrawlResult(
  pages: FxstreetSitePage[],
  broken: FxstreetSiteBrokenLink[] = [],
): CrawlResult {
  return {
    pages: pages.map(
      (p): CrawlPage => ({
        url: p.url,
        normalizedPath: p.normalizedPath,
        statusCode: p.httpStatus,
        foundOn: p.foundOn,
        label: p.environment,
      }),
    ),
    broken: broken.map(
      (b): CrawlBrokenLink => ({
        url: b.url,
        normalizedPath: b.normalizedPath,
        statusCode: b.httpStatus,
        foundOn: b.foundOn,
      }),
    ),
  };
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseFxstreetPagesCsv(text: string): FxstreetSitePage[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]!).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const iPath = idx("normalized_path");
  if (iPath < 0) {
    throw new Error("pages CSV missing normalized_path column");
  }
  const iEnv = idx("environment");
  const iStatus = idx("http_status");
  const iFound = idx("found_on");
  const iUrl = idx("url");

  const pages: FxstreetSitePage[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const normalizedPath = cols[iPath] ?? "";
    if (!normalizedPath) continue;
    pages.push({
      normalizedPath,
      environment: iEnv >= 0 ? (cols[iEnv] ?? "") : "",
      httpStatus: iStatus >= 0 ? Number(cols[iStatus] || 0) : 200,
      foundOn: iFound >= 0 ? (cols[iFound] ?? "") : "",
      url: iUrl >= 0 ? (cols[iUrl] ?? "") : "",
    });
  }
  return pages;
}

export function parseFxstreetBrokenCsv(text: string): FxstreetSiteBrokenLink[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]!).map((h) => h.trim());
  if (!header.includes("normalized_path")) return [];
  const idx = (name: string) => header.indexOf(name);
  const iPath = idx("normalized_path");
  const iStatus = idx("http_status");
  const iFound = idx("found_on");
  const iUrl = idx("url");
  const broken: FxstreetSiteBrokenLink[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const normalizedPath = cols[iPath] ?? "";
    if (!normalizedPath) continue;
    broken.push({
      normalizedPath,
      httpStatus: iStatus >= 0 ? Number(cols[iStatus] || 0) : 0,
      foundOn: iFound >= 0 ? (cols[iFound] ?? "") : "",
      url: iUrl >= 0 ? (cols[iUrl] ?? "") : "",
    });
  }
  return broken;
}

export function formatLocaleCompareCsv(rows: LocaleCompareRow[]): string {
  const header = [
    "path_key",
    "match_type",
    "path_en",
    "path_locale",
    "http_en",
    "http_locale",
    "env_en",
    "env_locale",
    "found_on_en",
    "found_on_locale",
    "url_en",
    "url_locale",
    "alias_family",
    "notes",
  ].join(",");
  const lines = [header];
  for (const r of rows) {
    lines.push(
      [
        r.pathKey,
        r.matchType,
        r.pathEn,
        r.pathLocale,
        r.httpEn,
        r.httpLocale,
        r.envEn,
        r.envLocale,
        r.foundOnEn,
        r.foundOnLocale,
        r.urlEn,
        r.urlLocale,
        r.aliasFamily,
        r.notes,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function formatCompareSummaryMarkdown(options: {
  locale: string;
  enLabel?: string;
  localePages: number;
  enPages: number;
  localeBroken: number;
  enBroken: number;
  result: LocaleCompareResult;
}): string {
  const { locale, result } = options;
  const enLabel = options.enLabel ?? "en";
  const typeLines = Object.entries(result.byType)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, n]) => `| ${k} | ${n} |`)
    .join("\n");
  const aliasLines =
    result.inferredAliases.length === 0
      ? "_None_"
      : [
          "| locale segment | EN segment | shared tails | source |",
          "|----------------|------------|--------------|--------|",
          ...result.inferredAliases.map(
            (a) =>
              `| \`${a.localeSegment}\` | \`${a.enSegment}\` | ${a.sharedTails} | ${a.source} |`,
          ),
        ].join("\n");

  const localeOnly = result.rows
    .filter((r) => r.matchType === "locale-only")
    .map((r) => `- \`${r.pathLocale}\``)
    .join("\n");
  const aliases = result.rows
    .filter((r) => r.matchType !== "same-path" && r.matchType !== "locale-only" && r.matchType !== "en-only" && r.matchType !== "neither-accessible")
    .map((r) => `- \`${r.pathLocale || "(none)"}\` ↔ \`${r.pathEn || r.pathKey}\` (${r.matchType})`)
    .join("\n");

  return `# Compare ${locale} vs ${enLabel}

| | ${locale} | ${enLabel} |
|--|-----------|--------|
| 2xx pages | ${options.localePages} | ${options.enPages} |
| broken links | ${options.localeBroken} | ${options.enBroken} |
| path keys | ${result.rows.length} | |

## match_type

| type | n |
|------|---|
${typeLines}

## First-segment aliases

${aliasLines}

## Path aliases (joined)

${aliases || "_None_"}

## Locale-only (grupo B / dictamen)

${localeOnly || "_None_"}
`;
}
