/**
 * Collapse high-volume families to `[slug]` for inventory listings.
 * Hubs and known tool segments stay literal.
 */
const SLUG_FAMILIES: { prefix: string; keep: string[] }[] = [
  { prefix: "/brokers/best", keep: [] },
  { prefix: "/brokers/reviews", keep: [] },
  { prefix: "/brokers/prop", keep: [] },
  { prefix: "/brokers/cashback", keep: [] },
  { prefix: "/brokers", keep: ["best", "reviews", "cashback", "prop"] },
  { prefix: "/news", keep: ["feed", "latest"] },
  { prefix: "/analysis", keep: ["feed", "latest"] },
  { prefix: "/education", keep: ["feed", "latest", "curso-forex"] },
  { prefix: "/author", keep: [] },
  { prefix: "/company", keep: [] },
  { prefix: "/press-releases", keep: [] },
  { prefix: "/currencies", keep: [] },
  { prefix: "/live-video", keep: ["latest", "shows"] },
  { prefix: "/cryptocurrencies/news", keep: ["feed", "latest"] },
  { prefix: "/cryptocurrencies/resources", keep: [] },
  {
    prefix: "/rates-charts",
    keep: ["chart", "chart-interactive", "forecast", "indicators", "rates"],
  },
  {
    prefix: "/economic-calendar",
    keep: [
      "world-interest-rates",
      "forex-market-hours",
      "fed-sentiment-index",
      "australia",
      "canada",
      "united-kingdom",
      "united-states",
    ],
  },
  {
    prefix: "/calendario-economico",
    keep: [
      "world-interest-rates",
      "forex-market-hours",
      "fed-sentiment-index",
      "australia",
      "canada",
      "united-kingdom",
      "united-states",
    ],
  },
  { prefix: "/macroeconomics/central-banks", keep: [] },
  { prefix: "/macroeconomics/economic-indicator", keep: [] },
  { prefix: "/info/jobs", keep: [] },
];

export function toListingPattern(path: string): string {
  const clean = path.split("?")[0] || "/";
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 1 && /-20\d{10}$/.test(parts[0]!)) {
    return "/[slug]";
  }

  for (const family of SLUG_FAMILIES) {
    if (clean === family.prefix) return clean;
    if (!clean.startsWith(`${family.prefix}/`)) continue;

    const rest = clean.slice(family.prefix.length + 1);
    const [first, ...more] = rest.split("/").filter(Boolean);
    if (!first) return clean;

    if (family.keep.includes(first)) {
      if (more.length === 0) return `${family.prefix}/${first}`;
      return `${family.prefix}/${first}/[slug]`;
    }
    return `${family.prefix}/[slug]`;
  }

  return clean;
}

export interface ListingPatternRow {
  pattern: string;
  type: "static" | "dynamic";
  count: number;
  examples: string[];
}

export function collapsePathsToPatterns(paths: string[]): ListingPatternRow[] {
  const groups = new Map<string, string[]>();
  for (const raw of paths) {
    const pattern = toListingPattern(raw);
    const list = groups.get(pattern) ?? [];
    list.push(raw);
    groups.set(pattern, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([pattern, examples]) => ({
      pattern,
      type: pattern.includes("[slug]") ? "dynamic" : "static",
      count: new Set(examples).size,
      examples: [...new Set(examples)].slice(0, 5),
    }));
}

export function formatListingPatternsCsv(rows: ListingPatternRow[]): string {
  const header = "pattern,type,count,examples";
  const lines = [header];
  for (const row of rows) {
    const examples = row.examples.join(" ");
    const fields = [row.pattern, row.type, String(row.count), examples];
    lines.push(
      fields
        .map((field) =>
          field.includes(",") || field.includes('"')
            ? `"${field.replace(/"/g, '""')}"`
            : field,
        )
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}
