/**
 * Map Site colocated i18n namespaces → inventory paths.
 *
 * After a locale crawl, only keys whose pages are 2xx (and not EN-only)
 * go into `{locale}-keys.csv`. Chrome is always in (every TLD has a header).
 */

export type NamespaceKind = "chrome" | "page" | "en-only";

export interface KeyPathRule {
  /** Longest prefix wins. Omit for the namespace's shared keys. */
  keyPrefix?: string;
  pathPrefixes?: string[];
  pathExact?: string[];
}

export interface NamespaceScope {
  ns: string;
  kind: NamespaceKind;
  pathPrefixes?: string[];
  pathExact?: string[];
  keyRules?: KeyPathRule[];
}

const CALENDAR_ROOTS = [
  "/economic-calendar",
  "/calendario-economico",
  "/calendrier-economique",
  "/wirtschaftskalender",
];

function calendarPaths(suffix = ""): string[] {
  return CALENDAR_ROOTS.map((root) => (suffix ? `${root}${suffix}` : root));
}

/** Chrome / shared UI — always translate if the locale has any live page. */
const CHROME: string[] = [
  "header",
  "footer",
  "language-selector",
  "root-layout",
  "share",
  "not-found",
  "error-500",
  "service-not-available",
  "advertisement-dialog",
  "one-signal",
  "disclaimer-section",
  "sidebar",
  "paywall",
  "sponsored",
  "greyboxes",
  "calendar-disclaimer",
  "editorial-highlight-card",
];

/** Product gates: do not translate or publish on non-EN deploys. */
const EN_ONLY: Array<{ ns: string; pathPrefixes?: string[] }> = [
  { ns: "press-release", pathPrefixes: ["/press-releases"] },
  {
    ns: "crypto-industry-news",
    pathPrefixes: ["/cryptocurrencies/industry-news"],
  },
  {
    ns: "industry-news-section",
    pathPrefixes: ["/cryptocurrencies/industry-news"],
  },
  { ns: "newsletter" },
  { ns: "more-news-section" },
  { ns: "in-deep-analysis-section" },
  { ns: "best-brokers-yearly-section" },
];

const PAGE_SCOPES: NamespaceScope[] = [
  { ns: "home-page", kind: "page", pathExact: ["/"] },
  {
    ns: "news",
    kind: "page",
    pathPrefixes: ["/news"],
  },
  { ns: "analysis-page", kind: "page", pathPrefixes: ["/analysis"] },
  { ns: "education", kind: "page", pathPrefixes: ["/education"] },
  { ns: "education-section", kind: "page", pathPrefixes: ["/education"], pathExact: ["/"] },
  { ns: "crypto-news", kind: "page", pathPrefixes: ["/cryptocurrencies"] },
  { ns: "cryptocurrencies-page", kind: "page", pathPrefixes: ["/cryptocurrencies"] },
  {
    ns: "cryptocurrencies-section",
    kind: "page",
    pathPrefixes: ["/cryptocurrencies"],
    pathExact: ["/"],
  },
  { ns: "search", kind: "page", pathPrefixes: ["/search"] },
  { ns: "algolia", kind: "page", pathPrefixes: ["/search"] },
  { ns: "contact-us", kind: "page", pathPrefixes: ["/info/contact-us"] },
  {
    ns: "editorial-guidelines",
    kind: "page",
    pathPrefixes: ["/info/editorial-guidelines"],
  },
  {
    ns: "become-contributor",
    kind: "page",
    pathPrefixes: ["/info/become-contributor", "/become-contributor"],
  },
  {
    ns: "transparency-translations",
    kind: "page",
    pathPrefixes: ["/transparency-translations"],
  },
  { ns: "ethical-code", kind: "page", pathPrefixes: ["/info/ethical-code"] },
  { ns: "about-us", kind: "page", pathPrefixes: ["/info/about-us"] },
  {
    ns: "corporate-identity",
    kind: "page",
    pathPrefixes: ["/info/corporate-identity"],
  },
  {
    ns: "terms-conditions",
    kind: "page",
    pathPrefixes: ["/info/terms-conditions"],
  },
  { ns: "privacy-policy", kind: "page", pathPrefixes: ["/info/privacy-policy"] },
  { ns: "cookie-policy", kind: "page", pathPrefixes: ["/info/cookie-policy"] },
  { ns: "prevention", kind: "page", pathPrefixes: ["/info/prevention"] },
  {
    ns: "advertising-model",
    kind: "page",
    pathPrefixes: ["/info/advertising-model"],
  },
  {
    ns: "how-we-score-reviews",
    kind: "page",
    pathPrefixes: ["/info/how-we-score-reviews"],
  },
  {
    ns: "how-fxstreet-uses-ai",
    kind: "page",
    pathPrefixes: ["/info/how-fxstreet-uses-ai"],
  },
  { ns: "premium", kind: "page", pathPrefixes: ["/info/premium"] },
  {
    ns: "premium-terms-and-conditions",
    kind: "page",
    pathPrefixes: ["/info/premium-terms-and-conditions"],
  },
  { ns: "account", kind: "page", pathPrefixes: ["/account"] },
  { ns: "profile", kind: "page", pathPrefixes: ["/profile"] },
  { ns: "subscriptions", kind: "page", pathPrefixes: ["/subscriptions"] },
  { ns: "brokers", kind: "page", pathPrefixes: ["/brokers"] },
  { ns: "broker-detail", kind: "page", pathPrefixes: ["/brokers"] },
  { ns: "broker-listing", kind: "page", pathPrefixes: ["/brokers"] },
  { ns: "broker-review", kind: "page", pathPrefixes: ["/brokers/reviews"] },
  {
    ns: "broker-review-sub-home",
    kind: "page",
    pathPrefixes: ["/brokers/reviews"],
  },
  { ns: "best-brokers-section", kind: "page", pathPrefixes: ["/brokers/best"] },
  { ns: "cashback-widget", kind: "page", pathPrefixes: ["/brokers"] },
  { ns: "propinder", kind: "page", pathPrefixes: ["/brokers/prop"] },
  {
    ns: "economic-calendar",
    kind: "page",
    pathPrefixes: calendarPaths(),
  },
  { ns: "calendar-event", kind: "page", pathPrefixes: calendarPaths("/event") },
  { ns: "calendar-guide", kind: "page", pathPrefixes: calendarPaths() },
  {
    ns: "forex-market-hours",
    kind: "page",
    pathPrefixes: calendarPaths("/forex-market-hours"),
  },
  {
    ns: "world-interest-rates",
    kind: "page",
    pathPrefixes: calendarPaths("/world-interest-rates"),
  },
  {
    ns: "fed-sentiment-index",
    kind: "page",
    pathPrefixes: calendarPaths("/fed-sentiment-index"),
  },
  { ns: "rates-charts", kind: "page", pathPrefixes: ["/rates-charts"] },
  { ns: "forecast", kind: "page", pathPrefixes: ["/rates-charts"] },
  { ns: "assets-forecast", kind: "page", pathPrefixes: ["/rates-charts"] },
  { ns: "forecast-chart", kind: "page", pathPrefixes: ["/rates-charts"] },
  {
    ns: "key-technicals-table",
    kind: "page",
    pathPrefixes: ["/rates-charts"],
  },
  { ns: "commodities", kind: "page", pathPrefixes: ["/commodities"] },
  { ns: "equities", kind: "page", pathPrefixes: ["/equities"] },
  {
    ns: "topic-page",
    kind: "page",
    pathPrefixes: [
      "/commodities",
      "/equities",
      "/currencies",
      "/cryptocurrencies",
    ],
    keyRules: [
      {
        keyPrefix: "topics.cryptocurrencies",
        pathPrefixes: ["/cryptocurrencies"],
      },
      { keyPrefix: "topics.commodities", pathPrefixes: ["/commodities"] },
      { keyPrefix: "topics.currencies", pathPrefixes: ["/currencies"] },
      { keyPrefix: "topics.equities", pathPrefixes: ["/equities"] },
    ],
  },
  {
    ns: "central-banks",
    kind: "page",
    pathPrefixes: ["/macroeconomics/central-banks"],
  },
  {
    ns: "central-bank-detail",
    kind: "page",
    pathPrefixes: ["/macroeconomics/central-banks"],
  },
  {
    ns: "economic-indicator-detail",
    kind: "page",
    pathPrefixes: ["/macroeconomics/economic-indicator"],
  },
  {
    ns: "trade-war",
    kind: "page",
    pathPrefixes: ["/macroeconomics/trade-war"],
  },
  {
    ns: "checklist-section",
    kind: "page",
    pathPrefixes: ["/macroeconomics/trade-war"],
  },
  {
    ns: "macro-showcases",
    kind: "page",
    pathPrefixes: ["/macroeconomics", ...calendarPaths()],
  },
  {
    ns: "macro-showcases-sub-home",
    kind: "page",
    pathPrefixes: ["/macroeconomics", ...calendarPaths()],
  },
  {
    ns: "showcase",
    kind: "page",
    pathPrefixes: ["/macroeconomics", ...calendarPaths()],
  },
  {
    ns: "showcases-variants",
    kind: "page",
    pathPrefixes: ["/macroeconomics", ...calendarPaths()],
  },
  { ns: "company", kind: "page", pathPrefixes: ["/company"] },
  { ns: "author", kind: "page", pathPrefixes: ["/author"] },
  { ns: "rss-feed", kind: "page", pathPrefixes: ["/rss"] },
  {
    ns: "posts",
    kind: "page",
    pathPrefixes: ["/news", "/analysis", "/education", "/cryptocurrencies"],
  },
  {
    ns: "post-metadata",
    kind: "page",
    pathPrefixes: ["/news", "/analysis", "/education", "/cryptocurrencies"],
  },
  {
    ns: "post-verified-translation",
    kind: "page",
    pathPrefixes: ["/news", "/analysis", "/education"],
  },
  {
    ns: "post-list-multifeed",
    kind: "page",
    pathPrefixes: ["/news", "/analysis", "/education"],
  },
  {
    ns: "author-section",
    kind: "page",
    pathPrefixes: ["/news", "/analysis", "/education", "/author"],
  },
  {
    ns: "live-coverage-section",
    kind: "page",
    pathPrefixes: ["/news", "/analysis"],
    pathExact: ["/"],
  },
  {
    ns: "editorial-highlight-section",
    kind: "page",
    pathExact: ["/"],
    pathPrefixes: ["/news", "/analysis", "/education"],
  },
  {
    ns: "editorial-highlight-calendar-section",
    kind: "page",
    pathExact: ["/"],
    pathPrefixes: calendarPaths(),
  },
  {
    ns: "weekly-forecast-section",
    kind: "page",
    pathExact: ["/"],
  },
  { ns: "stocks-section", kind: "page", pathExact: ["/"] },
  {
    ns: "youtube",
    kind: "page",
    pathPrefixes: ["/live-video"],
    pathExact: ["/"],
  },
  {
    ns: "youtube-videos-section",
    kind: "page",
    pathPrefixes: ["/live-video"],
    pathExact: ["/"],
  },
  { ns: "contributors-table", kind: "page", pathPrefixes: ["/company"] },
];

export const NAMESPACE_SCOPES: NamespaceScope[] = [
  ...CHROME.map((ns) => ({ ns, kind: "chrome" as const })),
  ...EN_ONLY.map((row) => ({
    ns: row.ns,
    kind: "en-only" as const,
    pathPrefixes: row.pathPrefixes,
  })),
  ...PAGE_SCOPES,
];

export function normalizeInventoryPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";
  const noQuery = trimmed.split("?")[0] ?? trimmed;
  return noQuery.replace(/\/+$/, "") || "/";
}

export function pathMatchesPrefix(path: string, prefix: string): boolean {
  const p = normalizeInventoryPath(path);
  const pre = normalizeInventoryPath(prefix);
  if (pre === "/") return p === "/";
  return p === pre || p.startsWith(`${pre}/`);
}

export function matchingInventoryPaths(
  inventoryPaths: readonly string[],
  scope: Pick<NamespaceScope, "pathPrefixes" | "pathExact">,
): string[] {
  const hits: string[] = [];
  for (const raw of inventoryPaths) {
    const path = normalizeInventoryPath(raw);
    if (scope.pathExact?.some((exact) => normalizeInventoryPath(exact) === path)) {
      hits.push(path);
      continue;
    }
    if (scope.pathPrefixes?.some((prefix) => pathMatchesPrefix(path, prefix))) {
      hits.push(path);
    }
  }
  return [...new Set(hits)];
}

export function scopeForNamespace(ns: string): NamespaceScope | undefined {
  return NAMESPACE_SCOPES.find((s) => s.ns === ns);
}

export type DiscardReason =
  | "en-only-gate"
  | "page-not-in-inventory"
  | "unmapped-namespace";

export interface NamespaceDecision {
  ns: string;
  include: boolean;
  reason?: DiscardReason;
  pages: string[];
}

/**
 * Decide which namespaces to translate for a locale inventory (2xx paths only).
 * EN-only gates are always discarded for non-`en` locales.
 */
export function decideNamespaces(
  inventoryPaths: readonly string[],
  namespaces: readonly string[],
  options: { locale: string } = { locale: "xx" },
): NamespaceDecision[] {
  const locale = options.locale.toLowerCase();
  const paths = inventoryPaths.map(normalizeInventoryPath);
  const hasAnyPage = paths.length > 0;

  return namespaces.map((ns) => {
    const scope = scopeForNamespace(ns);
    if (!scope) {
      return { ns, include: false, reason: "unmapped-namespace", pages: [] };
    }
    if (scope.kind === "en-only" && locale !== "en") {
      return { ns, include: false, reason: "en-only-gate", pages: [] };
    }
    if (scope.kind === "chrome") {
      return { ns, include: hasAnyPage, reason: hasAnyPage ? undefined : "page-not-in-inventory", pages: hasAnyPage ? ["/"] : [] };
    }
    const pages = matchingInventoryPaths(paths, scope);
    if (pages.length === 0) {
      return { ns, include: false, reason: "page-not-in-inventory", pages: [] };
    }
    return { ns, include: true, pages };
  });
}

/** Filter a flattened key against optional per-key path rules. */
export function keyBelongsToInventory(
  clave: string,
  scope: NamespaceScope,
  inventoryPaths: readonly string[],
): { include: boolean; pages: string[] } {
  if (!scope.keyRules?.length) {
    const pages = matchingInventoryPaths(inventoryPaths, scope);
    if (scope.kind === "chrome") {
      return { include: inventoryPaths.length > 0, pages: inventoryPaths.length ? ["/"] : [] };
    }
    return { include: pages.length > 0, pages };
  }
  const rules = [...scope.keyRules].sort(
    (a, b) => (b.keyPrefix?.length ?? 0) - (a.keyPrefix?.length ?? 0),
  );
  const matched = rules.find(
    (rule) => rule.keyPrefix && clave.startsWith(rule.keyPrefix),
  );
  const rule = matched ?? { pathPrefixes: scope.pathPrefixes, pathExact: scope.pathExact };
  const pages = matchingInventoryPaths(inventoryPaths, rule);
  return { include: pages.length > 0, pages };
}
