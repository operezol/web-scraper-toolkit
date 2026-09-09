import { crawlSite } from "./generic-crawl.js";
import type { CrawlPage } from "./crawl-types.js";
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
  onCheckpoint?: (pages: FxstreetEsPage[]) => void | Promise<void>;
  onProgress?: (p: {
    visited: number;
    queueSize: number;
    currentUrl: string;
  }) => void;
}

/**
 * FXStreet.es page list crawl — thin wrapper over generic crawlSite + preset.
 */
export async function crawlFxstreetEs(
  options: FxstreetEsCrawlOptions = {},
): Promise<FxstreetEsPage[]> {
  const startUrl = options.startUrl ?? FXSTREET_ES_START_URL;
  const host = new URL(startUrl).hostname;
  if (!FXSTREET_ES_HOSTS.includes(host)) {
    throw new Error(
      `startUrl must be on www.fxstreet.es (or fxstreet.es), got ${host}`,
    );
  }

  const toEs = (pages: CrawlPage[]): FxstreetEsPage[] =>
    pages.map((p) => ({
      url: p.url,
      normalizedPath: p.normalizedPath,
      environment: p.label ?? "unknown",
    }));

  const pages = await crawlSite({
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
      ? async (p) => options.onCheckpoint!(toEs(p))
      : undefined,
    onProgress: options.onProgress,
  });

  return toEs(pages);
}

export function formatFxstreetEsPagesCsv(pages: FxstreetEsPage[]): string {
  const sorted = [...pages].sort((a, b) =>
    a.normalizedPath.localeCompare(b.normalizedPath, "es"),
  );
  const header = "normalized_path,environment,url";
  const lines = [header];
  for (const p of sorted) {
    lines.push(
      [
        csvEscape(p.normalizedPath),
        csvEscape(p.environment),
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
