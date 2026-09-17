import type { ArticlePathRule } from "./article-path.js";
import type { DetectionConfig } from "./detection.js";
import type { UrlNormalizeOptions } from "./url-normalize.js";

export interface CrawlOptions {
  startUrl: string;
  /** Opt-in cap. Undefined = no page limit. */
  maxPages?: number;
  delayMs?: number;
  timeoutMs?: number;
  /** Default false (strip query). */
  keepQuery?: boolean;
  /** Default false (strip hash). */
  keepHash?: boolean;
  /** Default true — apply articleRules. */
  excludeArticles?: boolean;
  articleRules?: ArticlePathRule[];
  /** Optional host allowlist; default = hostname of startUrl only. */
  allowedHosts?: string[];
  /** Optional HTML label detection. */
  detection?: DetectionConfig;
  /** Opt-in: flush every N **accessible** pages via onCheckpoint. */
  checkpointEvery?: number;
  onCheckpoint?: (result: CrawlResult) => void | Promise<void>;
  onProgress?: (p: {
    visited: number;
    queueSize: number;
    currentUrl: string;
  }) => void;
}

export interface CrawlPage {
  url: string;
  normalizedPath: string;
  /** HTTP status of the successful fetch (2xx after redirects). */
  statusCode: number;
  /**
   * Normalized path of the page whose HTML contained this link.
   * Empty for the crawl seed.
   */
  foundOn: string;
  /** Present when detection config provided */
  label?: string;
}

/** Linked URL that failed to fetch (404, timeout, off-host, …). Not in `pages`. */
export interface CrawlBrokenLink {
  url: string;
  normalizedPath: string;
  /** Normalized path of the page that linked here. Empty for the seed. */
  foundOn: string;
  /** 0 = network/timeout; otherwise HTTP status. */
  statusCode: number;
}

export interface CrawlResult {
  /** Only URLs that returned 2xx (after following redirects). */
  pages: CrawlPage[];
  broken: CrawlBrokenLink[];
}

export type { ArticlePathRule, DetectionConfig, UrlNormalizeOptions };
