import axios from "axios";
import type { AxiosResponse } from "axios";
import { detectPageEnvironment, normalizeInternalPath } from "./env-detect.js";
import { extractInternalLinksFromHtml } from "./link-extract.js";

const defaultHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export type HostKey = "www" | "qa";

export interface DualOriginCrawlPage {
  url: string;
  hostKey: HostKey;
  normalizedPath: string;
  environment: import("./env-detect.js").PageEnvironment;
}

export interface DualOriginCrawlOptions {
  wwwStartUrl: string;
  qaStartUrl: string;
  /** Total visits across both hosts (safety cap). Default 50_000 */
  maxPages?: number;
  delayMs?: number;
  timeoutMs?: number;
  onProgress?: (p: {
    visited: number;
    queueSize: number;
    currentUrl: string;
  }) => void;
}

export interface MergedPathRow {
  normalizedPath: string;
  wwwEnvironment: string;
  qaEnvironment: string;
  wwwUrl: string;
  qaUrl: string;
}

function hostKeyFromHostname(hostname: string): HostKey | null {
  if (hostname === "www.fxstreet.com") return "www";
  if (hostname === "qa.fxstreet.com") return "qa";
  return null;
}

/**
 * BFS crawl of www and qa in one queue: each URL visited once.
 * Only links staying on the same host as the current page are enqueued.
 */
export async function crawlDualFxstreet(
  options: DualOriginCrawlOptions,
): Promise<DualOriginCrawlPage[]> {
  const {
    wwwStartUrl,
    qaStartUrl,
    maxPages = 50_000,
    delayMs = 400,
    timeoutMs = 25_000,
    onProgress,
  } = options;

  const wwwParsed = new URL(wwwStartUrl);
  const qaParsed = new URL(qaStartUrl);
  if (hostKeyFromHostname(wwwParsed.hostname) !== "www") {
    throw new Error(`wwwStartUrl must be on www.fxstreet.com, got ${wwwParsed.hostname}`);
  }
  if (hostKeyFromHostname(qaParsed.hostname) !== "qa") {
    throw new Error(`qaStartUrl must be on qa.fxstreet.com, got ${qaParsed.hostname}`);
  }

  const visited = new Set<string>();
  const queue: string[] = [wwwStartUrl, qaStartUrl];
  const results: DualOriginCrawlPage[] = [];

  while (queue.length > 0 && results.length < maxPages) {
    const currentUrl = queue.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    const hostKey = hostKeyFromHostname(new URL(currentUrl).hostname);
    if (!hostKey) continue;

    onProgress?.({
      visited: results.length + 1,
      queueSize: queue.length,
      currentUrl,
    });

    try {
      const response = await axios.get<string>(currentUrl, {
        headers: defaultHeaders,
        timeout: timeoutMs,
        responseType: "text",
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const html = response.data;
      const finalUrl = stripHash(resolveFinalUrl(response, currentUrl));
      if (finalUrl !== currentUrl) {
        visited.add(finalUrl);
      }

      const env = detectPageEnvironment(html);
      const path = normalizeInternalPath(finalUrl);

      results.push({
        url: finalUrl,
        hostKey,
        normalizedPath: path,
        environment: env,
      });

      const links = extractInternalLinksFromHtml(html, finalUrl);
      for (const link of links) {
        if (!visited.has(link)) {
          queue.push(link);
        }
      }
    } catch {
      // Still record visit with unknown env if we need — skip row or add error row
      results.push({
        url: currentUrl,
        hostKey,
        normalizedPath: normalizeInternalPath(currentUrl),
        environment: "unknown",
      });
    }

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}

function stripHash(url: string): string {
  const i = url.indexOf("#");
  return i >= 0 ? url.slice(0, i) : url;
}

function resolveFinalUrl(response: AxiosResponse, fallback: string): string {
  const req = response.request as
    | { res?: { responseUrl?: string } }
    | undefined;
  const fromRedirect = req?.res?.responseUrl;
  if (typeof fromRedirect === "string" && fromRedirect.length > 0) {
    return fromRedirect;
  }
  return fallback;
}

/** Merge crawl rows by normalized path for CSV comparison across hosts. */
export function mergePagesByPath(
  pages: DualOriginCrawlPage[],
): Map<string, { www?: DualOriginCrawlPage; qa?: DualOriginCrawlPage }> {
  const map = new Map<
    string,
    { www?: DualOriginCrawlPage; qa?: DualOriginCrawlPage }
  >();

  for (const p of pages) {
    const key = p.normalizedPath;
    let entry = map.get(key);
    if (!entry) {
      entry = {};
      map.set(key, entry);
    }
    if (p.hostKey === "www") entry.www = p;
    else entry.qa = p;
  }

  return map;
}

export function mergedPathsToCsvRows(
  merged: Map<string, { www?: DualOriginCrawlPage; qa?: DualOriginCrawlPage }>,
): MergedPathRow[] {
  const rows: MergedPathRow[] = [];
  const paths = Array.from(merged.keys()).sort((a, b) =>
    a.localeCompare(b, "en"),
  );

  for (const normalizedPath of paths) {
    const e = merged.get(normalizedPath)!;
    rows.push({
      normalizedPath,
      wwwEnvironment: e.www?.environment ?? "",
      qaEnvironment: e.qa?.environment ?? "",
      wwwUrl: e.www?.url ?? "",
      qaUrl: e.qa?.url ?? "",
    });
  }

  return rows;
}

export function formatMergedCsv(rows: MergedPathRow[]): string {
  const header =
    "normalized_path,www_environment,qa_environment,www_url,qa_url";
  const lines = [header];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.normalizedPath),
        csvEscape(r.wwwEnvironment),
        csvEscape(r.qaEnvironment),
        csvEscape(r.wwwUrl),
        csvEscape(r.qaUrl),
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
