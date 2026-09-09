import type { ArticlePathRule } from "../article-path.js";
import type { DetectionConfig } from "../detection.js";

/**
 * FXStreet-specific preset (layer B): article path rules + stack detection.
 *
 * Goal: crawl surface/landings for locale planning without enumerating every
 * CMS slug (news, education, company, brokers/best/*, calendar events, …).
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
  {
    section: "brokers",
    match: "slug-after-section",
    allowSegments: ["best", "reviews", "cashback", "prop"],
  },
  // Nested detail pages (hubs above stay crawlable)
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
    pattern: "^/(economic-calendar|calendario-economico)/event/[^/]+",
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
