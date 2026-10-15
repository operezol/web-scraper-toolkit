import {
  FXSTREET_ES_HOSTS,
  FXSTREET_ES_START_URL,
} from "./presets/fxstreet.js";
import {
  crawlFxstreetSite,
  formatFxstreetSiteBrokenCsv,
  formatFxstreetSitePagesCsv,
  type FxstreetSiteBrokenLink,
  type FxstreetSiteCrawlOptions,
  type FxstreetSiteCrawlResult,
  type FxstreetSitePage,
} from "./fxstreet-site-crawl.js";

/** @deprecated Use FxstreetSitePage */
export type FxstreetEsPage = FxstreetSitePage;
/** @deprecated Use FxstreetSiteBrokenLink */
export type FxstreetEsBrokenLink = FxstreetSiteBrokenLink;
/** @deprecated Use FxstreetSiteCrawlResult */
export type FxstreetEsCrawlResult = FxstreetSiteCrawlResult;
/** @deprecated Use FxstreetSiteCrawlOptions */
export type FxstreetEsCrawlOptions = Omit<
  FxstreetSiteCrawlOptions,
  "startUrl"
> & { startUrl?: string };

/**
 * FXStreet.es page list crawl — thin wrapper over crawlFxstreetSite.
 * Rejects non-.es hosts; use crawlFxstreetSite / CLI fxstreet-locale for other TLDs.
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

  return crawlFxstreetSite({
    ...options,
    startUrl,
    allowedHosts: FXSTREET_ES_HOSTS,
  });
}

export function formatFxstreetEsPagesCsv(pages: FxstreetEsPage[]): string {
  return formatFxstreetSitePagesCsv(pages);
}

export function formatFxstreetEsBrokenCsv(
  broken: FxstreetEsBrokenLink[],
): string {
  return formatFxstreetSiteBrokenCsv(broken);
}
