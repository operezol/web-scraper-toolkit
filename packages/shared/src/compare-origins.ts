import type { CrawlBrokenLink, CrawlPage, CrawlResult } from "./crawl-types.js";
import { crawlSite } from "./generic-crawl.js";
import {
  FXSTREET_ARTICLE_RULES,
  FXSTREET_DETECTION,
} from "./presets/fxstreet.js";

export interface OriginCompareRow {
  pathKey: string;
  matchType: string;
  pathLegacy: string;
  pathProcessed: string;
  httpLegacy: string;
  httpProcessed: string;
  envLegacy: string;
  envProcessed: string;
  foundOnLegacy: string;
  foundOnProcessed: string;
  urlLegacy: string;
  urlProcessed: string;
  notes: string;
}

export interface OriginCompareResult {
  rows: OriginCompareRow[];
  legacy: CrawlResult;
  processed: CrawlResult;
}

/** Canonicalize known ES path moves so legacy and Next can join. */
export function processedPathKey(path: string): string {
  if (path === "/educacion" || path.startsWith("/educacion/")) {
    return path.replace("/educacion", "/education");
  }
  if (path === "/economic-calendar" || path.startsWith("/economic-calendar/")) {
    return path.replace("/economic-calendar", "/calendario-economico");
  }
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 1 && /broker/i.test(parts[0]!)) {
    return `/brokers/best/${parts[0]}`;
  }
  return path;
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

function matchType(
  pathLegacy: string,
  pathProcessed: string,
  hasLegacy: boolean,
  hasProcessed: boolean,
): string {
  if (hasLegacy && hasProcessed) {
    if (pathLegacy === pathProcessed) return "same-path";
    if (
      pathLegacy.replace("/economic-calendar", "/calendario-economico") ===
      pathProcessed
    ) {
      return "calendar-alias";
    }
    if (pathLegacy.replace("/educacion", "/education") === pathProcessed) {
      return "educacion-alias";
    }
    if (pathProcessed === `/brokers/best${pathLegacy}`) {
      return "moved-to-brokers-best";
    }
    return "parallel-other";
  }
  if (hasLegacy && !hasProcessed) return "legacy-only";
  if (!hasLegacy && hasProcessed) return "processed-only";
  return "neither-accessible";
}

export function mergeOriginCompare(
  legacy: CrawlResult,
  processed: CrawlResult,
): OriginCompareRow[] {
  const legacyPages = indexPages(legacy.pages);
  const processedPages = indexPages(processed.pages);
  const legacyBroken = indexBroken(legacy.broken);
  const processedBroken = indexBroken(processed.broken);

  const keys = new Set<string>();
  for (const p of legacyPages.keys()) keys.add(processedPathKey(p));
  for (const p of processedPages.keys()) keys.add(processedPathKey(p));
  for (const p of legacyBroken.keys()) keys.add(processedPathKey(p));
  for (const p of processedBroken.keys()) keys.add(processedPathKey(p));

  const rows: OriginCompareRow[] = [];

  for (const pathKey of [...keys].sort((a, b) => a.localeCompare(b, "es"))) {
    const lp =
      legacyPages.get(pathKey) ??
      [...legacyPages.values()].find((p) => processedPathKey(p.normalizedPath) === pathKey);
    const pp = processedPages.get(pathKey);

    const lb =
      !lp
        ? legacyBroken.get(pathKey) ??
          [...legacyBroken.values()].find(
            (p) => processedPathKey(p.normalizedPath) === pathKey,
          )
        : undefined;
    const pb = !pp ? processedBroken.get(pathKey) : undefined;

    const pathLegacy = lp?.normalizedPath ?? lb?.normalizedPath ?? "";
    const pathProcessed = pp?.normalizedPath ?? pb?.normalizedPath ?? "";
    const hasLegacy = Boolean(lp);
    const hasProcessed = Boolean(pp);

    const notes: string[] = [];
    if (lb) notes.push(`legacy linked but HTTP ${lb.statusCode || "fail"} from ${lb.foundOn || "(start)"}`);
    if (pb) notes.push(`processed linked but HTTP ${pb.statusCode || "fail"} from ${pb.foundOn || "(start)"}`);
    if (lp && !pp) notes.push("accessible on legacy, not in processed crawl");
    if (!lp && pp) notes.push("accessible on processed, not in legacy crawl");

    rows.push({
      pathKey,
      matchType: matchType(pathLegacy, pathProcessed || pathKey, hasLegacy, hasProcessed),
      pathLegacy,
      pathProcessed,
      httpLegacy: lp ? String(lp.statusCode) : lb ? String(lb.statusCode) : "",
      httpProcessed: pp ? String(pp.statusCode) : pb ? String(pb.statusCode) : "",
      envLegacy: lp?.label ?? "",
      envProcessed: pp?.label ?? "",
      foundOnLegacy: lp?.foundOn ?? lb?.foundOn ?? "",
      foundOnProcessed: pp?.foundOn ?? pb?.foundOn ?? "",
      urlLegacy: lp?.url ?? lb?.url ?? "",
      urlProcessed: pp?.url ?? pb?.url ?? "",
      notes: notes.join("; "),
    });
  }

  return rows;
}

export async function compareOrigins(options: {
  legacyStartUrl: string;
  processedStartUrl: string;
  maxPages?: number;
  delayMs?: number;
  timeoutMs?: number;
  onProgress?: (side: "legacy" | "processed", p: {
    visited: number;
    queueSize: number;
    currentUrl: string;
  }) => void;
}): Promise<OriginCompareResult> {
  const shared = {
    maxPages: options.maxPages,
    delayMs: options.delayMs ?? 400,
    timeoutMs: options.timeoutMs,
    excludeArticles: true,
    articleRules: FXSTREET_ARTICLE_RULES,
    detection: FXSTREET_DETECTION,
  };

  const [legacy, processed] = await Promise.all([
    crawlSite({
      ...shared,
      startUrl: options.legacyStartUrl,
      onProgress: options.onProgress
        ? (p) => options.onProgress!("legacy", p)
        : undefined,
    }),
    crawlSite({
      ...shared,
      startUrl: options.processedStartUrl,
      onProgress: options.onProgress
        ? (p) => options.onProgress!("processed", p)
        : undefined,
    }),
  ]);

  return {
    legacy,
    processed,
    rows: mergeOriginCompare(legacy, processed),
  };
}

export function formatOriginCompareCsv(rows: OriginCompareRow[]): string {
  const header = [
    "path_key",
    "match_type",
    "path_legacy",
    "path_processed",
    "http_legacy",
    "http_processed",
    "env_legacy",
    "env_processed",
    "found_on_legacy",
    "found_on_processed",
    "url_legacy",
    "url_processed",
    "notes",
  ].join(",");
  const lines = [header];
  for (const r of rows) {
    lines.push(
      [
        r.pathKey,
        r.matchType,
        r.pathLegacy,
        r.pathProcessed,
        r.httpLegacy,
        r.httpProcessed,
        r.envLegacy,
        r.envProcessed,
        r.foundOnLegacy,
        r.foundOnProcessed,
        r.urlLegacy,
        r.urlProcessed,
        r.notes,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

function csvEscape(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
