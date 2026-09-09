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
  /** Opt-in: flush every N results via onCheckpoint. */
  checkpointEvery?: number;
  onCheckpoint?: (pages: CrawlPage[]) => void | Promise<void>;
  onProgress?: (p: {
    visited: number;
    queueSize: number;
    currentUrl: string;
  }) => void;
}

export interface CrawlPage {
  url: string;
  normalizedPath: string;
  /** Present when detection config provided */
  label?: string;
}

export type { ArticlePathRule, DetectionConfig, UrlNormalizeOptions };
