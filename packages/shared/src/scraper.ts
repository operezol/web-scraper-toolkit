import axios from "axios";
import * as cheerio from "cheerio";
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

      const $ = cheerio.load(response.data);
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      const links = new Set<string>();

      $("a[href]").each((_, element) => {
        const href = $(element).attr("href");
        if (!href) return;

        try {
          let fullUrl: string;
          if (href.startsWith("http://") || href.startsWith("https://")) {
            fullUrl = href;
          } else if (href.startsWith("//")) {
            fullUrl = `${urlObj.protocol}${href}`;
          } else if (href.startsWith("/")) {
            fullUrl = `${baseUrl}${href}`;
          } else if (
            !href.startsWith("#") &&
            !href.startsWith("mailto:") &&
            !href.startsWith("tel:")
          ) {
            fullUrl = `${baseUrl}/${href}`;
          } else {
            return;
          }

          const linkUrl = new URL(fullUrl);
          if (linkUrl.hostname === urlObj.hostname) {
            links.add(fullUrl.split("#")[0]);
          }
        } catch {}
      });

      return Array.from(links).sort();
    } catch (error) {
      throw new Error(
        `Failed to extract links: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async crawlInternalLinks(
    startUrl: string,
    maxPages: number = 100,
    onProgress?: (visited: number, total: number, currentUrl: string) => void,
  ): Promise<string[]> {
    const visited = new Set<string>();
    const toVisit = new Set<string>([startUrl]);
    const allLinks = new Set<string>();

    while (toVisit.size > 0 && visited.size < maxPages) {
      const currentUrl = Array.from(toVisit)[0];
      toVisit.delete(currentUrl);

      if (visited.has(currentUrl)) continue;

      visited.add(currentUrl);
      allLinks.add(currentUrl);

      if (onProgress) {
        onProgress(visited.size, visited.size + toVisit.size, currentUrl);
      }

      try {
        const links = await this.extractInternalLinks(currentUrl);

        for (const link of links) {
          allLinks.add(link);
          if (!visited.has(link) && visited.size < maxPages) {
            toVisit.add(link);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(
          `Error crawling ${currentUrl}:`,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    }

    return Array.from(allLinks).sort();
  }
}
