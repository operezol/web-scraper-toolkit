import { crawlSite } from "./generic-crawl.js";
import type { CrawlBrokenLink, CrawlPage, CrawlRelinkPath } from "./crawl-types.js";
import {
  FXSTREET_EN_SITE_HOSTS,
  isFxstreetEnHost,
} from "./fxstreet-en-url.js";
import {
  FXSTREET_ARTICLE_RULES,
  FXSTREET_DETECTION,
  allowedHostsFromStartUrl,
} from "./presets/fxstreet.js";
import { collectSitemapUrls } from "./sitemap.js";

export interface FxstreetSitePage {
  url: string;
  normalizedPath: string;
  environment: string;
  httpStatus: number;
  /** Path of the page that linked here; empty for the start URL. */
  foundOn: string;
}

export interface FxstreetSiteBrokenLink {
  url: string;
  normalizedPath: string;
  httpStatus: number;
  foundOn: string;
}

export interface FxstreetRelinkPath {
  url: string;
  normalizedPath: string;
  httpStatus: number;
  foundOn: string;
}

export interface FxstreetSiteCrawlResult {
  pages: FxstreetSitePage[];
  broken: FxstreetSiteBrokenLink[];
  /** EN hrefs remapped to this TLD that are not 2xx yet — translate + relink. */
  relink: FxstreetRelinkPath[];
}

export interface FxstreetSiteCrawlOptions {
  startUrl: string;
  allowedHosts?: string[];
  maxPages?: number;
  delayMs?: number;
  timeoutMs?: number;
  keepQuery?: boolean;
  keepHash?: boolean;
  excludeArticles?: boolean;
  /** Extra pathnames on the same origin. Default: none — inventory is BFS from home. */
  seedPaths?: string[];
  extraStartUrls?: Array<string | { url: string; foundOn?: string }>;
  /** Seed from that TLD's /sitemap.xml (+ robots Sitemap:). Default true. */
  useSitemap?: boolean;
  /** Render JS and open React/Radix menus. Default true for inventory. */
  useBrowser?: boolean;
  checkpointEvery?: number;
  onCheckpoint?: (result: FxstreetSiteCrawlResult) => void | Promise<void>;
  onProgress?: (p: {
    visited: number;
    queueSize: number;
    currentUrl: string;
  }) => void;
}

function toPage(p: CrawlPage): FxstreetSitePage {
  return {
    url: p.url,
    normalizedPath: p.normalizedPath,
    environment: p.label ?? "unknown",
    httpStatus: p.statusCode,
    foundOn: p.foundOn,
  };
}

function toBroken(b: CrawlBrokenLink): FxstreetSiteBrokenLink {
  return {
    url: b.url,
    normalizedPath: b.normalizedPath,
    httpStatus: b.statusCode,
    foundOn: b.foundOn,
  };
}

function toRelink(r: CrawlRelinkPath): FxstreetRelinkPath {
  return {
    url: r.url,
    normalizedPath: r.normalizedPath,
    httpStatus: r.statusCode,
    foundOn: r.foundOn,
  };
}

function toResult(result: {
  pages: CrawlPage[];
  broken: CrawlBrokenLink[];
  relink?: CrawlRelinkPath[];
}): FxstreetSiteCrawlResult {
  return {
    pages: result.pages.map(toPage),
    broken: result.broken.map(toBroken),
    relink: (result.relink ?? []).map(toRelink),
  };
}

/**
 * FXStreet inventory crawl for any TLD — 2xx pages + broken sidecar.
 * Hosts default to www + apex of `startUrl`.
 */
export async function crawlFxstreetSite(
  options: FxstreetSiteCrawlOptions,
): Promise<FxstreetSiteCrawlResult> {
  const startUrl = options.startUrl;
  const allowedHosts =
    options.allowedHosts ?? allowedHostsFromStartUrl(startUrl);
  const origin = new URL(startUrl);
  const seedPaths = options.seedPaths ?? [];
  const extraStartUrls = [
    ...seedPaths.map((p) => {
      const pathname = p.startsWith("/") ? p : `/${p}`;
      return `${origin.protocol}//${origin.host}${pathname}`;
    }),
    ...(options.extraStartUrls ?? []),
  ];

  if (options.useSitemap !== false) {
    const sitemap = await collectSitemapUrls({
      origin: `${origin.protocol}//${origin.host}`,
      allowedHosts,
      timeoutMs: options.timeoutMs,
    });
    extraStartUrls.push(
      ...sitemap.urls.map((url) => ({ url, foundOn: "(sitemap)" })),
    );
  }

  const result = await crawlSite({
    startUrl,
    extraStartUrls,
    maxPages: options.maxPages,
    delayMs: options.delayMs,
    timeoutMs: options.timeoutMs,
    keepQuery: options.keepQuery ?? false,
    keepHash: options.keepHash ?? false,
    excludeArticles: options.excludeArticles ?? true,
    useBrowser: options.useBrowser ?? true,
    articleRules: FXSTREET_ARTICLE_RULES,
    allowedHosts,
    rewriteSourceHosts: isFxstreetEnHost(origin.hostname)
      ? []
      : [...FXSTREET_EN_SITE_HOSTS],
    detection: FXSTREET_DETECTION,
    checkpointEvery: options.checkpointEvery,
    onCheckpoint: options.onCheckpoint
      ? async (r) => options.onCheckpoint!(toResult(r))
      : undefined,
    onProgress: options.onProgress,
  });

  const mapped = toResult(result);
  return {
    pages: uniqueByPath(mapped.pages),
    broken: uniqueByPath(mapped.broken),
    relink: uniqueByPath(mapped.relink),
  };
}

function uniqueByPath<T extends { normalizedPath: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.normalizedPath)) continue;
    seen.add(row.normalizedPath);
    out.push(row);
  }
  return out;
}

export function formatFxstreetSitePagesCsv(pages: FxstreetSitePage[]): string {
  const sorted = uniqueByPath(pages).sort((a, b) =>
    a.normalizedPath.localeCompare(b.normalizedPath),
  );
  const header = "normalized_path,environment,http_status,found_on,url";
  const lines = [header];
  for (const p of sorted) {
    lines.push(
      [
        csvEscape(p.normalizedPath),
        csvEscape(p.environment),
        String(p.httpStatus),
        csvEscape(p.foundOn),
        csvEscape(p.url),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function formatFxstreetSiteBrokenCsv(
  broken: FxstreetSiteBrokenLink[],
): string {
  const sorted = uniqueByPath(broken).sort((a, b) =>
    a.normalizedPath.localeCompare(b.normalizedPath),
  );
  const header = "normalized_path,http_status,found_on,url";
  const lines = [header];
  for (const p of sorted) {
    lines.push(
      [
        csvEscape(p.normalizedPath),
        String(p.httpStatus),
        csvEscape(p.foundOn),
        csvEscape(p.url),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function formatFxstreetRelinkCsv(rows: FxstreetRelinkPath[]): string {
  const sorted = uniqueByPath(rows).sort((a, b) =>
    a.normalizedPath.localeCompare(b.normalizedPath),
  );
  const header = "normalized_path,http_status,found_on,url,note";
  const lines = [header];
  for (const p of sorted) {
    lines.push(
      [
        csvEscape(p.normalizedPath),
        String(p.httpStatus),
        csvEscape(p.foundOn),
        csvEscape(p.url),
        csvEscape(
          "enlace heredado a EN; traducir claves y apuntar al mismo path en este TLD",
        ),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function parseFxstreetRelinkCsv(text: string): FxstreetRelinkPath[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]!).map((h) => h.trim());
  if (!header.includes("normalized_path")) return [];
  const iPath = header.indexOf("normalized_path");
  const iStatus = header.indexOf("http_status");
  const iFound = header.indexOf("found_on");
  const iUrl = header.indexOf("url");
  const rows: FxstreetRelinkPath[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const normalizedPath = cols[iPath] ?? "";
    if (!normalizedPath) continue;
    rows.push({
      normalizedPath,
      httpStatus: iStatus >= 0 ? Number(cols[iStatus] || 0) : 301,
      foundOn: iFound >= 0 ? (cols[iFound] ?? "") : "",
      url: iUrl >= 0 ? (cols[iUrl] ?? "") : "",
    });
  }
  return rows;
}

export function csvEscape(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
