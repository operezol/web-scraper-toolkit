/**
 * English production/QA site hosts. Locale TLDs used to bounce here when a
 * page had no translation — those hrefs must be remapped to the same path on
 * the locale origin, then visited. Do not treat the EN landing as a locale page.
 */
export const FXSTREET_EN_SITE_HOSTS = [
  "www.fxstreet.com",
  "fxstreet.com",
  "qa.fxstreet.com",
] as const;

const EN_HOSTS = new Set(
  FXSTREET_EN_SITE_HOSTS.map((h) => h.toLowerCase()),
);

export function isFxstreetEnHost(host: string): boolean {
  return EN_HOSTS.has(host.toLowerCase());
}

/**
 * If `url` points at the EN site, return the same path on `origin`.
 * Other hosts (editorial, cashback, other locales) are left unchanged.
 */
export function rewriteEnSiteUrlToOrigin(url: string, origin: string): string {
  try {
    const parsed = new URL(url, origin);
    if (!isFxstreetEnHost(parsed.hostname)) return parsed.href;
    const base = new URL(origin);
    return `${base.protocol}//${base.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function rewriteHostToOrigin(
  url: string,
  origin: string,
  sourceHosts: readonly string[],
): string {
  if (sourceHosts.length === 0) return url;
  try {
    const parsed = new URL(url, origin);
    const from = new Set(sourceHosts.map((h) => h.toLowerCase()));
    if (!from.has(parsed.hostname.toLowerCase())) return parsed.href;
    const base = new URL(origin);
    return `${base.protocol}//${base.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
