import axios from "axios";
import type { AxiosResponse } from "axios";
import { isArticlePath } from "./article-path.js";
import type {
  CrawlBrokenLink,
  CrawlOptions,
  CrawlPage,
  CrawlResult,
} from "./crawl-types.js";
import { evaluateDetection } from "./detection.js";
import { extractInternalLinksFromHtml } from "./link-extract.js";
import {
  normalizeCrawlUrl,
  normalizeInternalPath,
} from "./url-normalize.js";

const defaultHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

interface QueueItem {
  url: string;
  foundOn: string;
}

function httpStatusFromError(error: unknown): number {
  if (axios.isAxiosError(error) && typeof error.response?.status === "number") {
    return error.response.status;
  }
  return 0;
}

/**
 * Generic BFS internal-link crawl with optional filters, detection, checkpoint.
 *
 * The result list only contains URLs that responded 2xx. Linked-but-dead URLs
 * go to `broken` with the page they were found on (`foundOn`).
 */
export async function crawlSite(options: CrawlOptions): Promise<CrawlResult> {
  const {
    startUrl,
    maxPages,
    delayMs = 400,
    timeoutMs = 25_000,
    keepQuery = false,
    keepHash = false,
    excludeArticles = true,
    articleRules = [],
    detection,
    checkpointEvery,
    onCheckpoint,
    onProgress,
  } = options;

  const startHost = new URL(startUrl).hostname;
  const allowedHosts = new Set(options.allowedHosts ?? [startHost]);
  const normOpts = { keepQuery, keepHash };

  const normalize = (u: string) => normalizeCrawlUrl(u, normOpts);
  const shouldSkipPath = (path: string) =>
    excludeArticles &&
    articleRules.length > 0 &&
    isArticlePath(path, articleRules);

  const seed = normalize(startUrl);
  if (shouldSkipPath(normalizeInternalPath(seed))) {
    return { pages: [], broken: [] };
  }

  const visited = new Set<string>();
  const queue: QueueItem[] = [{ url: seed, foundOn: "" }];
  const pages: CrawlPage[] = [];
  const broken: CrawlBrokenLink[] = [];

  const withinLimit = () =>
    maxPages === undefined || maxPages <= 0 || pages.length < maxPages;

  const pushBroken = (item: QueueItem, path: string, statusCode: number) => {
    broken.push({
      url: item.url,
      normalizedPath: path,
      foundOn: item.foundOn,
      statusCode,
    });
  };

  while (queue.length > 0 && withinLimit()) {
    const item = queue.shift()!;
    const currentUrl = item.url;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    let host: string;
    try {
      host = new URL(currentUrl).hostname;
    } catch {
      continue;
    }
    if (!allowedHosts.has(host)) continue;

    const path = normalizeInternalPath(currentUrl);
    if (shouldSkipPath(path)) continue;

    onProgress?.({
      visited: pages.length + 1,
      queueSize: queue.length,
      currentUrl,
    });

    try {
      const response = await axios.get<string>(currentUrl, {
        headers: defaultHeaders,
        timeout: timeoutMs,
        responseType: "text",
        validateStatus: (s) => s >= 200 && s < 300,
      });

      const html = response.data;
      const finalRaw = resolveFinalUrl(response, currentUrl);
      const finalUrl = normalize(finalRaw);
      if (finalUrl !== currentUrl) visited.add(finalUrl);

      const finalHost = new URL(finalUrl).hostname;
      if (!allowedHosts.has(finalHost)) {
        pushBroken(item, path, response.status);
      } else {
        const finalPath = normalizeInternalPath(finalUrl);
        if (shouldSkipPath(finalPath)) {
          // redirect landed on an excluded article — do not record
        } else {
          const page: CrawlPage = {
            url: finalUrl,
            normalizedPath: finalPath,
            statusCode: response.status,
            foundOn: item.foundOn,
            label: detection ? evaluateDetection(html, detection) : undefined,
          };
          pages.push(page);

          const links = extractInternalLinksFromHtml(html, finalUrl);
          for (const link of links) {
            let n: string;
            try {
              n = normalize(link);
            } catch {
              continue;
            }
            if (!allowedHosts.has(new URL(n).hostname)) continue;
            if (shouldSkipPath(normalizeInternalPath(n))) continue;
            if (!visited.has(n)) {
              queue.push({ url: n, foundOn: finalPath });
            }
          }
        }
      }
    } catch (error) {
      pushBroken(item, path, httpStatusFromError(error));
    }

    if (
      checkpointEvery &&
      checkpointEvery > 0 &&
      pages.length > 0 &&
      pages.length % checkpointEvery === 0
    ) {
      await onCheckpoint?.({ pages, broken });
    }

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { pages, broken };
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
