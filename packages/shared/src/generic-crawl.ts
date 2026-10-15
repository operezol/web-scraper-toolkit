import axios from "axios";
import type { AxiosResponse } from "axios";
import { isArticlePath } from "./article-path.js";
import type {
  CrawlBrokenLink,
  CrawlOptions,
  CrawlPage,
  CrawlRelinkPath,
  CrawlResult,
} from "./crawl-types.js";
import { evaluateDetection } from "./detection.js";
import { extractInternalLinksDetailed } from "./link-extract.js";
import {
  normalizeCrawlUrl,
  normalizeInternalPath,
} from "./url-normalize.js";
import { RenderedCrawlSession } from "./browser-harvest.js";
import { classifyFetchedPage } from "./not-found-page.js";

const defaultHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

interface QueueItem {
  url: string;
  foundOn: string;
  /** Harvested from an EN-site href that we remapped to this locale origin. */
  fromEnHref?: boolean;
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
 * Sitemap / BFS seeds are always visited. The result list only contains URLs
 * that responded 2xx on this origin (not a 404 template, not a bounce to EN).
 * EN-site hrefs on locale pages are remapped to the same path here, visited,
 * and if they 404 or bounce back to EN they go to `relink` (translate + fix href)
 * as well as `broken`. Links on a 404 / EN-bounce page are not followed.
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
    rewriteSourceHosts = [],
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
  const queued = new Set<string>([seed]);
  for (const extra of options.extraStartUrls ?? []) {
    const extraUrl = typeof extra === "string" ? extra : extra.url;
    const extraFoundOn =
      typeof extra === "string" ? "(seed)" : (extra.foundOn ?? "(seed)");
    let normalizedExtra: string;
    try {
      normalizedExtra = normalize(extraUrl);
    } catch {
      continue;
    }
    let extraHost: string;
    try {
      extraHost = new URL(normalizedExtra).hostname;
    } catch {
      continue;
    }
    if (!allowedHosts.has(extraHost)) continue;
    if (shouldSkipPath(normalizeInternalPath(normalizedExtra))) continue;
    if (queued.has(normalizedExtra)) continue;
    queued.add(normalizedExtra);
    queue.push({ url: normalizedExtra, foundOn: extraFoundOn });
  }
  const pages: CrawlPage[] = [];
  const broken: CrawlBrokenLink[] = [];
  const relink: CrawlRelinkPath[] = [];
  const relinkSeen = new Set<string>();
  const browser = options.useBrowser ? new RenderedCrawlSession() : undefined;
  if (browser) await browser.start();

  const withinLimit = () =>
    maxPages === undefined || maxPages <= 0 || pages.length < maxPages;

  const pushBroken = (item: QueueItem, path: string, statusCode: number) => {
    broken.push({
      url: item.url,
      normalizedPath: path,
      foundOn: item.foundOn,
      statusCode,
    });
    if (item.fromEnHref && !relinkSeen.has(path)) {
      relinkSeen.add(path);
      relink.push({
        normalizedPath: path,
        url: item.url,
        foundOn: item.foundOn,
        statusCode,
      });
    }
  };

  const enqueueLinks = (
    links: Array<{ href: string; remappedFromEn?: boolean }>,
    foundOn: string,
  ) => {
    for (const link of links) {
      let n: string;
      try {
        n = normalize(link.href);
      } catch {
        continue;
      }
      if (!allowedHosts.has(new URL(n).hostname)) continue;
      if (shouldSkipPath(normalizeInternalPath(n))) continue;
      if (!visited.has(n) && !queued.has(n)) {
        queued.add(n);
        queue.push({
          url: n,
          foundOn,
          fromEnHref: Boolean(link.remappedFromEn),
        });
      }
    }
  };

  try {
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
      let html: string;
      let statusCode: number;
      let finalRaw: string;
      let links: Array<{ href: string; remappedFromEn?: boolean }>;

      if (browser) {
        const rendered = await browser.fetch(currentUrl, {
          timeoutMs,
          allowedHosts: [...allowedHosts],
          rewriteHostsToOrigin: rewriteSourceHosts,
        });
        html = rendered.html;
        statusCode = rendered.statusCode;
        finalRaw = rendered.finalUrl;
        links = rendered.linksDetailed ?? rendered.links.map((href) => ({ href }));
      } else {
        const response = await axios.get<string>(currentUrl, {
          headers: defaultHeaders,
          timeout: timeoutMs,
          responseType: "text",
          validateStatus: (s) => s >= 200 && s < 300,
        });
        html = response.data;
        statusCode = response.status;
        finalRaw = resolveFinalUrl(response, currentUrl);
        links = extractInternalLinksDetailed(html, currentUrl, {
          allowedHosts: [...allowedHosts],
          rewriteHostsToOrigin: rewriteSourceHosts,
        });
      }

      const verdict = classifyFetchedPage(statusCode, html);
      if (!verdict.ok) {
        pushBroken(item, path, verdict.statusCode);
        continue;
      }
      statusCode = verdict.statusCode;

      const finalUrl = normalize(finalRaw);
      if (finalUrl !== currentUrl) visited.add(finalUrl);

      const finalHost = new URL(finalUrl).hostname;
      if (!allowedHosts.has(finalHost)) {
        // Locale URL bounced to another TLD (usually EN). Not a locale page.
        pushBroken(item, path, statusCode >= 300 && statusCode < 400 ? statusCode : 301);
        continue;
      } else {
        const finalPath = normalizeInternalPath(finalUrl);
        if (!shouldSkipPath(finalPath)) {
          pages.push({
            url: finalUrl,
            normalizedPath: finalPath,
            statusCode,
            foundOn: item.foundOn,
            label: detection ? evaluateDetection(html, detection) : undefined,
          });
          enqueueLinks(links, finalPath);
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

  return { pages, broken, relink };
  } finally {
    await browser?.close();
  }
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
