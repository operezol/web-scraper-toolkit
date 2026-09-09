export interface UrlNormalizeOptions {
  /** Keep query string in identity URL. Default false (strip). */
  keepQuery?: boolean;
  /** Keep hash in identity URL. Default false (strip). */
  keepHash?: boolean;
  /** Strip trailing slash except root. Default true. */
  stripTrailingSlash?: boolean;
}

/**
 * Normalize a URL for crawl identity (visited / queue / output).
 * Defaults: strip query, strip hash, strip trailing slash.
 */
export function normalizeCrawlUrl(
  urlString: string,
  options: UrlNormalizeOptions = {},
): string {
  const {
    keepQuery = false,
    keepHash = false,
    stripTrailingSlash = true,
  } = options;

  const u = new URL(urlString);
  if (!keepHash) u.hash = "";
  if (!keepQuery) u.search = "";

  let path = u.pathname;
  if (stripTrailingSlash && path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  u.pathname = path || "/";

  // URL.toString() may add trailing empty path quirks; rebuild cleanly
  const q = keepQuery ? u.search : "";
  const h = keepHash ? u.hash : "";
  return `${u.protocol}//${u.host}${u.pathname}${q}${h}`;
}

/** Pathname only, trailing slash stripped except root (merge key). */
export function normalizeInternalPath(urlString: string): string {
  const u = new URL(urlString);
  let path = u.pathname;
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path || "/";
}
