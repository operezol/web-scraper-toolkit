import type { ArticlePathRule } from "../article-path.js";
import type { DetectionConfig } from "../detection.js";

/**
 * FXStreet-specific preset (layer B): article path rules + stack detection.
 *
 * Goal: crawl surface/landings for locale planning without enumerating every
 * CMS slug (news, education, company, calendar events, …).
 * Broker *profiles* (`/brokers/fxpro`) stay in — they are product pages, not posts.
 */
export const FXSTREET_ARTICLE_RULES: ArticlePathRule[] = [
  {
    section: "news",
    match: "slug-after-section",
    allowSegments: ["feed", "latest"],
  },
  {
    section: "analysis",
    match: "slug-after-section",
    allowSegments: ["feed", "latest"],
  },
  {
    section: "education",
    match: "slug-after-section",
    allowSegments: ["feed", "latest", "curso-forex"],
  },
  { section: "company", match: "slug-after-section" },
  { section: "author", match: "slug-after-section" },
  { section: "press-releases", match: "slug-after-section" },
  { section: "currencies", match: "slug-after-section" },
  { section: "commodities", match: "slug-after-section" },
  { section: "live-video", match: "slug-after-section" },
  {
    section: "cryptocurrencies",
    match: "slug-after-section",
    allowSegments: ["news", "rates-charts", "industry-news"],
  },
  {
    section: "rates-charts",
    match: "slug-after-section",
    allowSegments: ["chart", "chart-interactive", "forecast", "indicators", "rates"],
  },
  // Nested detail pages (hubs + /brokers/{slug} profiles stay crawlable)
  {
    section: "nested",
    match: "path-regex",
    pattern: "^/brokers/(best|reviews|prop)/[^/]+",
  },
  {
    section: "nested",
    match: "path-regex",
    pattern: "^/macroeconomics/central-banks/[^/]+",
  },
  {
    section: "nested",
    match: "path-regex",
    pattern: "^/macroeconomics/economic-indicator/[^/]+",
  },
  {
    section: "nested",
    match: "path-regex",
    pattern:
      "^/(economic-calendar|calendario-economico|calendrier-economique|wirtschaftskalender)/event/[^/]+",
  },
  {
    section: "nested",
    match: "path-regex",
    pattern: "^/education/curso-forex/.+",
  },
  {
    section: "nested",
    match: "path-regex",
    pattern: "^/rates-charts/[^/]+/(chart|forecast)$",
  },
  // Root dated posts (legacy SEO) — e.g. /slug-...-202607130702
  {
    section: "nested",
    match: "path-regex",
    pattern: "^/[^/]+-20\\d{10}$",
  },
  // Nested dated posts under any first segment (IT/FR/DE news slugs, etc.)
  {
    section: "nested",
    match: "path-regex",
    pattern: "^/[^/]+/.+-20\\d{10}$",
  },
];

export const FXSTREET_DETECTION: DetectionConfig = {
  policy: "multi-hit-conflict",
  fallbackLabel: "unknown",
  conflictLabel: "conflict",
  definitions: [
    {
      label: "next",
      combine: "or",
      rules: [
        {
          type: "selectorExists",
          selector: 'style[data-precedence="next"]',
        },
        { type: "anyScriptSrcContains", substring: "_next" },
      ],
    },
    {
      label: "sitefinity",
      combine: "or",
      rules: [
        {
          type: "metaContentContains",
          name: "Generator",
          substring: "Sitefinity",
          caseInsensitive: true,
        },
      ],
    },
  ],
};

export const FXSTREET_ES_HOSTS = ["www.fxstreet.es", "fxstreet.es"];
export const FXSTREET_ES_START_URL = "https://www.fxstreet.es/";

/**
 * Canonical Next/legacy hubs. Seeded on every locale crawl so JS-only nav
 * (IT/FR/PT home) still gets an HTTP inventory.
 */
export const FXSTREET_INVENTORY_SEED_PATHS: readonly string[] = [
  "/",
  "/news",
  "/analysis",
  "/analysis/latest",
  "/education",
  "/education/latest",
  "/cryptocurrencies",
  "/cryptocurrencies/news",
  "/cryptocurrencies/industry-news",
  "/brokers",
  "/brokers/best",
  "/brokers/reviews",
  "/rates-charts",
  "/rates-charts/chart",
  "/rates-charts/forecast",
  "/rates-charts/indicators",
  "/rates-charts/rates",
  "/economic-calendar",
  "/economic-calendar/world-interest-rates",
  "/economic-calendar/forex-market-hours",
  "/calendario-economico",
  "/commodities",
  "/equities",
  "/press-releases",
  "/bonds",
  "/live-video",
  "/rss",
  "/search",
  "/subscriptions",
  "/transparency-translations",
  "/info/about-us",
  "/info/contact-us",
  "/info/terms-conditions",
  "/info/privacy-policy",
  "/info/cookie-policy",
  "/info/ethical-code",
  "/info/editorial-guidelines",
  "/info/corporate-identity",
  "/info/prevention",
  "/info/premium",
  "/info/advertising-model",
  "/markets/commodities",
  "/markets/equities",
];

export interface FxstreetLocaleOrigin {
  locale: string;
  name: string;
  startUrl: string;
}

/** Production legacy origins from Site language switcher. */
export const FXSTREET_LOCALE_ORIGINS: readonly FxstreetLocaleOrigin[] = [
  { locale: "en", name: "English", startUrl: "https://www.fxstreet.com/" },
  { locale: "es", name: "Español", startUrl: "https://www.fxstreet.es/" },
  { locale: "it", name: "Italiano", startUrl: "https://www.fxstreet.it/" },
  { locale: "fr", name: "Français", startUrl: "https://www.fxstreet.fr/" },
  { locale: "de", name: "Deutsch", startUrl: "https://www.fxstreet.de.com/" },
  { locale: "pt", name: "Português", startUrl: "https://pt.fxstreet.com/" },
  { locale: "id", name: "Bahasa Indonesia", startUrl: "https://www.fxstreet-id.com/" },
  { locale: "ar", name: "العربية", startUrl: "https://ar.fxstreet.com/" },
  { locale: "vi", name: "Tiếng Việt", startUrl: "https://www.fxstreet-vn.com/" },
  { locale: "zh", name: "繁體中文", startUrl: "https://www.fxstreet.hk/" },
  { locale: "ru", name: "Русский", startUrl: "https://www.fxstreet.ru.com/" },
  { locale: "tr", name: "Türkçe", startUrl: "https://www.fxstreet.com.tr/" },
  { locale: "hu", name: "Magyar", startUrl: "https://www.fxstreet.hu/" },
  { locale: "ja", name: "日本語", startUrl: "https://www.fxstreet.jp/" },
];

export function getFxstreetLocaleOrigin(locale: string): FxstreetLocaleOrigin {
  const found = FXSTREET_LOCALE_ORIGINS.find((o) => o.locale === locale);
  if (!found) {
    const known = FXSTREET_LOCALE_ORIGINS.map((o) => o.locale).join(", ");
    throw new Error(`Unknown FXStreet locale "${locale}". Known: ${known}`);
  }
  return found;
}

/**
 * www + apex for a start URL. `pt.fxstreet.com` also allows `www.pt.fxstreet.com`.
 */
export function allowedHostsFromStartUrl(startUrl: string): string[] {
  const host = new URL(startUrl).hostname.toLowerCase();
  const hosts = new Set<string>([host]);
  if (host.startsWith("www.")) {
    hosts.add(host.slice(4));
  } else {
    hosts.add(`www.${host}`);
  }
  return [...hosts];
}
