import { crawlSite } from "./generic-crawl.js";
import type { CrawlBrokenLink, CrawlPage } from "./crawl-types.js";
import {
  FXSTREET_ARTICLE_RULES,
  FXSTREET_DETECTION,
  FXSTREET_ES_HOSTS,
  FXSTREET_ES_START_URL,
} from "./presets/fxstreet.js";

export interface FxstreetEsPage {
  url: string;
  normalizedPath: string;
  environment: string;
  httpStatus: number;
  /** Path of the page that linked here; empty for the start URL. */
  foundOn: string;
}

export interface FxstreetEsBrokenLink {
  url: string;
  normalizedPath: string;
  httpStatus: number;
  foundOn: string;
}

export interface FxstreetEsCrawlResult {
  pages: FxstreetEsPage[];
  broken: FxstreetEsBrokenLink[];
}

export interface FxstreetEsCrawlOptions {
  startUrl?: string;
  /** Opt-in page cap. Omit for no limit. */
  maxPages?: number;
  delayMs?: number;
  timeoutMs?: number;
  keepQuery?: boolean;
  keepHash?: boolean;
  /** Default true — use FXStreet article rules. */
  excludeArticles?: boolean;
  checkpointEvery?: number;
  onCheckpoint?: (result: FxstreetEsCrawlResult) => void | Promise<void>;
  onProgress?: (p: {
    visited: number;
    queueSize: number;
    currentUrl: string;
  }) => void;
}

function toEsPage(p: CrawlPage): FxstreetEsPage {
  return {
    url: p.url,
    normalizedPath: p.normalizedPath,
    environment: p.label ?? "unknown",
    httpStatus: p.statusCode,
    foundOn: p.foundOn,
  };
}

function toEsBroken(b: CrawlBrokenLink): FxstreetEsBrokenLink {
  return {
    url: b.url,
    normalizedPath: b.normalizedPath,
    httpStatus: b.statusCode,
    foundOn: b.foundOn,
  };
}

function toEs(result: { pages: CrawlPage[]; broken: CrawlBrokenLink[] }): FxstreetEsCrawlResult {
  return {
    pages: result.pages.map(toEsPage),
    broken: result.broken.map(toEsBroken),
  };
}

/**
 * FXStreet.es page list crawl — thin wrapper over generic crawlSite + preset.
 * `pages` are HTTP-accessible only; dead links are in `broken` with `foundOn`.
 */
export async function crawlFxstreetEs(
  options: FxstreetEsCrawlOptions = {},
): Promise<FxstreetEsCrawlResult> {
  const startUrl = options.startUrl ?? FXSTREET_ES_START_URL;
  const host = new URL(startUrl).hostname;
  if (!FXSTREET_ES_HOSTS.includes(host)) {
    throw new Error(
      `startUrl must be on www.fxstreet.es (or fxstreet.es), got ${host}`,
    );
  }

  const result = await crawlSite({
    startUrl,
    maxPages: options.maxPages,
    delayMs: options.delayMs,
    timeoutMs: options.timeoutMs,
    keepQuery: options.keepQuery ?? false,
    keepHash: options.keepHash ?? false,
    excludeArticles: options.excludeArticles ?? true,
    articleRules: FXSTREET_ARTICLE_RULES,
    allowedHosts: FXSTREET_ES_HOSTS,
    detection: FXSTREET_DETECTION,
    checkpointEvery: options.checkpointEvery,
    onCheckpoint: options.onCheckpoint
      ? async (r) => options.onCheckpoint!(toEs(r))
      : undefined,
    onProgress: options.onProgress,
  });

  return toEs(result);
}

export function formatFxstreetEsPagesCsv(pages: FxstreetEsPage[]): string {
  const sorted = [...pages].sort((a, b) =>
    a.normalizedPath.localeCompare(b.normalizedPath, "es"),
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

export function formatFxstreetEsBrokenCsv(broken: FxstreetEsBrokenLink[]): string {
  const sorted = [...broken].sort((a, b) =>
    a.normalizedPath.localeCompare(b.normalizedPath, "es"),
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

function csvEscape(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
