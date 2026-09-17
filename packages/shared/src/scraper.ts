import axios from "axios";
import * as cheerio from "cheerio";
import { crawlSite } from "./generic-crawl.js";
import type { CrawlOptions } from "./crawl-types.js";
import { extractInternalLinksFromHtml } from "./link-extract.js";
import type { ScraperOptions, ScraperResult, ScraperError } from "./types.js";

export class WebScraper {
  private defaultHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  };

  async scrape(options: ScraperOptions): Promise<ScraperResult | ScraperError> {
    try {
      const response = await axios.get(options.url, {
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
          ...(options.userAgent && { "User-Agent": options.userAgent }),
        },
        timeout: options.timeout || 10000,
      });

      const $ = cheerio.load(response.data);
      const title = $("title").text();

      let content: string | string[];
      if (options.selector) {
        content = $(options.selector)
          .map((_, el) => $(el).text().trim())
          .get();
      } else {
        content = $("body").text().trim();
      }

      return {
        url: options.url,
        title,
        content,
        timestamp: new Date(),
        statusCode: response.status,
      };
    } catch (error) {
      return {
        url: options.url,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };
    }
  }

  async scrapeMultiple(
    urls: string[],
    selector?: string,
  ): Promise<(ScraperResult | ScraperError)[]> {
    const promises = urls.map((url) => this.scrape({ url, selector }));
    return Promise.all(promises);
  }

  async extractInternalLinks(url: string): Promise<string[]> {
    try {
      const response = await axios.get(url, {
        headers: this.defaultHeaders,
        timeout: 10000,
      });

      return extractInternalLinksFromHtml(response.data, url);
    } catch (error) {
      throw new Error(
        `Failed to extract links: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Recursively crawl internal links.
   * Overload: (url, maxPages?, onProgress?) — maxPages opt-in when number provided.
   * Prefer CrawlOptions for filters / checkpoint.
   */
  async crawlInternalLinks(
    startUrl: string,
    maxPagesOrOptions?: number | Omit<CrawlOptions, "startUrl">,
    onProgress?: (visited: number, total: number, currentUrl: string) => void,
  ): Promise<string[]> {
    const opts: CrawlOptions =
      typeof maxPagesOrOptions === "object" && maxPagesOrOptions !== null
        ? { startUrl, ...maxPagesOrOptions }
        : {
            startUrl,
            maxPages:
              typeof maxPagesOrOptions === "number"
                ? maxPagesOrOptions
                : undefined,
            delayMs: 500,
            excludeArticles: false,
            onProgress: onProgress
              ? ({ visited, queueSize, currentUrl }) =>
                  onProgress(visited, visited + queueSize, currentUrl)
              : undefined,
          };

    // Legacy positional callback when options object used without onProgress mapping
    if (
      typeof maxPagesOrOptions === "object" &&
      maxPagesOrOptions !== null &&
      onProgress &&
      !maxPagesOrOptions.onProgress
    ) {
      opts.onProgress = ({ visited, queueSize, currentUrl }) =>
        onProgress(visited, visited + queueSize, currentUrl);
    }

    const { pages } = await crawlSite(opts);
    return pages.map((p) => p.url).sort();
  }
}
