import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { csvEscape } from "./fxstreet-site-crawl.js";
import {
  decideNamespaces,
  keyBelongsToInventory,
  pathMatchesPrefix,
  scopeForNamespace,
  type DiscardReason,
} from "./i18n-scope.js";

export interface TranslationKeyRow {
  carpeta: string;
  bloque: string;
  clave: string;
  en: string;
  draft: string;
  reviewed: string;
  estado: string;
  comments: string;
  pages: string;
}

export interface DiscardedKeyRow {
  carpeta: string;
  bloque: string;
  clave: string;
  en: string;
  reason: DiscardReason | "nav-page-not-in-inventory";
  pages: string;
}

export interface TranslationKeyResult {
  included: TranslationKeyRow[];
  discarded: DiscardedKeyRow[];
}

export function flattenI18nLeaves(
  obj: unknown,
  prefix = "",
): Array<{ clave: string; value: string }> {
  const out: Array<{ clave: string; value: string }> = [];
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== "object") {
    out.push({ clave: prefix, value: String(obj) });
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      out.push(...flattenI18nLeaves(item, `${prefix}[${i}]`));
    });
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") {
      out.push(...flattenI18nLeaves(v, next));
    } else {
      out.push({ clave: next, value: v == null ? "" : String(v) });
    }
  }
  return out;
}

export function discoverComponentNamespaces(siteRoot: string): string[] {
  const dir = path.join(siteRoot, "packages/ui/src/components");
  if (!existsSync(dir)) {
    throw new Error(`Site components folder not found: ${dir}`);
  }
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((ns) => existsSync(path.join(dir, ns, `${ns}.en.json`)))
    .sort((a, b) => a.localeCompare(b));
  const rss = path.join(
    siteRoot,
    "packages/lib/server-only/rss/rss-feed.en.json",
  );
  if (existsSync(rss)) names.push("rss-feed");
  return names;
}

function loadNamespaceJson(
  siteRoot: string,
  ns: string,
  locale: string,
): Record<string, unknown> | null {
  const file =
    ns === "rss-feed"
      ? path.join(
          siteRoot,
          `packages/lib/server-only/rss/rss-feed.${locale}.json`,
        )
      : path.join(
          siteRoot,
          `packages/ui/src/components/${ns}/${ns}.${locale}.json`,
        );
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
}

function carpetaFor(ns: string): string {
  return ns === "rss-feed" ? "rss" : `componentes/${ns}`;
}

function bloqueFor(ns: string): string {
  return ns === "rss-feed" ? "rss-feed" : ns;
}

const EN_ONLY_NAV_PATHS = [
  "/press-releases",
  "/cryptocurrencies/industry-news",
  "/trade-now",
];

export interface NavEntry {
  clave: string;
  text: string;
  paths: string[];
}

const ROUTE_EXPR_HINTS: Array<[RegExp, string]> = [
  [/pressRelease|PRESS_RELEASE/i, "/press-releases"],
  [/industryNews|industry-news/i, "/cryptocurrencies/industry-news"],
  [/education/i, "/education"],
  [/analysis/i, "/analysis"],
  [/\.news\b|CONTENT_ROUTES\.news/i, "/news"],
  [/BROKER_ROUTES|brokers/i, "/brokers"],
  [/ratesCharts|MARKET_ROUTES\.rates/i, "/rates-charts"],
  [/CALENDAR_ROUTES|economicCalendar|calendario/i, "/economic-calendar"],
  [/commodit/i, "/commodities"],
  [/equit/i, "/equities"],
  [/crypto/i, "/cryptocurrencies"],
  [/aboutUs|about-us/i, "/info/about-us"],
  [/contact/i, "/info/contact-us"],
  [/privacy/i, "/info/privacy-policy"],
  [/cookie/i, "/info/cookie-policy"],
  [/terms/i, "/info/terms-conditions"],
  [/search/i, "/search"],
];

function inferPathsFromRouteExpr(expr: string): string[] {
  const hits: string[] = [];
  for (const [re, pathHint] of ROUTE_EXPR_HINTS) {
    if (re.test(expr)) hits.push(pathHint);
  }
  return hits;
}

/** Pull Text + nearby /paths from navigation-data-en.ts without evaluating it. */
export function extractNavEntries(source: string): NavEntry[] {
  const entries: NavEntry[] = [];
  const textRe = /Text:\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = textRe.exec(source))) {
    const text = match[1] ?? "";
    if (!text.trim()) continue;
    const window = source.slice(match.index, match.index + 700);
    const paths = [
      ...window.matchAll(/['"`](\/[^'"`\s]+)['"`]/g),
    ]
      .map((m) => (m[1] ?? "").split("?")[0] ?? "")
      .filter((p) => p.startsWith("/") && !p.startsWith("//"));
    const urlExpr = window.match(/Url:\s*([^,\n]+)/)?.[1] ?? "";
    for (const hint of inferPathsFromRouteExpr(urlExpr)) {
      if (!paths.includes(hint)) paths.push(hint);
    }
    const feature =
      window.match(/Feature:\s*['"]([^'"]+)['"]/)?.[1] ?? "item";
    const id = window.match(/Id:\s*['"]([^'"]+)['"]/)?.[1] ?? "NAV";
    entries.push({
      clave: `${id} / ${feature} / ${paths[0] ?? text}`,
      text,
      paths,
    });
  }
  return entries;
}

function navDecision(
  entry: NavEntry,
  inventoryPaths: readonly string[],
  locale: string,
): { include: boolean; reason?: DiscardedKeyRow["reason"]; pages: string[] } {
  if (entry.paths.some((p) => EN_ONLY_NAV_PATHS.some((g) => pathMatchesPrefix(p, g)))) {
    if (locale !== "en") {
      return { include: false, reason: "en-only-gate", pages: [] };
    }
  }
  if (entry.paths.length === 0) {
    return { include: inventoryPaths.length > 0, pages: inventoryPaths.length ? ["/"] : [] };
  }
  const pages = entry.paths.filter((p) =>
    inventoryPaths.some(
      (inv) => pathMatchesPrefix(inv, p) || pathMatchesPrefix(p, inv),
    ),
  );
  if (pages.length > 0) return { include: true, pages };
  return { include: false, reason: "nav-page-not-in-inventory", pages: [] };
}

export function generateTranslationKeys(options: {
  locale: string;
  inventoryPaths: readonly string[];
  /** Paths linked on the locale site that today bounce to EN or 404. */
  relinkPaths?: readonly string[];
  siteRoot: string;
  /** Include every non-EN-only key, regardless of which pages exist on the locale TLD. */
  fullCatalog?: boolean;
}): TranslationKeyResult {
  const locale = options.locale.toLowerCase();
  const siteRoot = options.siteRoot;
  const relinkSet = new Set(
    (options.relinkPaths ?? []).map((p) => p.replace(/\/+$/, "") || "/"),
  );
  const scopePaths = [
    ...new Set([...options.inventoryPaths, ...relinkSet]),
  ];
  const namespaces = discoverComponentNamespaces(siteRoot);
  const decisions = options.fullCatalog
    ? namespaces.map((ns) => {
        const scope = scopeForNamespace(ns);
        const isEnglishOnly = scope?.kind === "en-only";
        return {
          ns,
          include: !isEnglishOnly,
          reason: isEnglishOnly ? ("en-only-gate" as const) : undefined,
          pages: [] as string[],
        };
      })
    : decideNamespaces(scopePaths, namespaces, {
        locale,
      });
  const included: TranslationKeyRow[] = [];
  const discarded: DiscardedKeyRow[] = [];

  for (const decision of decisions) {
    const enObj = loadNamespaceJson(siteRoot, decision.ns, "en");
    if (!enObj) continue;
    const localeObj = loadNamespaceJson(siteRoot, decision.ns, locale);
    const localeFlat = new Map(
      localeObj ? flattenI18nLeaves(localeObj).map((x) => [x.clave, x.value]) : [],
    );
    const scope = scopeForNamespace(decision.ns);
    const carpeta = carpetaFor(decision.ns);
    const bloque = bloqueFor(decision.ns);

    for (const { clave, value } of flattenI18nLeaves(enObj)) {
      let include = decision.include;
      let reason = decision.reason;
      let pages = decision.pages;
      if (include && scope && !options.fullCatalog) {
        const keyDec = keyBelongsToInventory(clave, scope, scopePaths);
        include = keyDec.include;
        pages = keyDec.pages;
        if (!include) reason = "page-not-in-inventory";
      }
      if (include) {
        const inherited = pages.some((p) => relinkSet.has(p.replace(/\/+$/, "") || "/"));
        included.push({
          carpeta,
          bloque,
          clave,
          en: value,
          draft: localeFlat.get(clave) ?? "",
          reviewed: "",
          estado: "Pendiente",
          comments: inherited
            ? "heredado: el enlace iba a EN; publicar en este TLD y apuntar aquí"
            : "",
          pages: pages.join(" "),
        });
      } else {
        discarded.push({
          carpeta,
          bloque,
          clave,
          en: value,
          reason: reason ?? "page-not-in-inventory",
          pages: pages.join(" "),
        });
      }
    }
  }

  const navFile = path.join(
    siteRoot,
    "packages/ui/src/components/header/navigation-data/navigation-data-en.ts",
  );
  if (existsSync(navFile)) {
    const seen = new Set<string>();
    for (const entry of extractNavEntries(readFileSync(navFile, "utf-8"))) {
      const id = `navegacion|menu-principal|${entry.clave}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const dec = options.fullCatalog
        ? entry.paths.some((p) =>
            EN_ONLY_NAV_PATHS.some((gate) => pathMatchesPrefix(p, gate)),
          )
          ? { include: false, reason: "en-only-gate" as const, pages: [] }
          : { include: true, pages: [] }
        : navDecision(entry, scopePaths, locale);
      if (dec.include) {
        included.push({
          carpeta: "navegacion",
          bloque: "menu-principal",
          clave: entry.clave,
          en: entry.text,
          draft: "",
          reviewed: "",
          estado: "Pendiente",
          comments: "",
          pages: dec.pages.join(" "),
        });
      } else {
        discarded.push({
          carpeta: "navegacion",
          bloque: "menu-principal",
          clave: entry.clave,
          en: entry.text,
          reason: dec.reason ?? "nav-page-not-in-inventory",
          pages: "",
        });
      }
    }
  }

  included.sort(
    (a, b) =>
      a.carpeta.localeCompare(b.carpeta) ||
      a.bloque.localeCompare(b.bloque) ||
      a.clave.localeCompare(b.clave),
  );
  discarded.sort(
    (a, b) =>
      a.carpeta.localeCompare(b.carpeta) ||
      a.bloque.localeCompare(b.bloque) ||
      a.clave.localeCompare(b.clave),
  );
  return { included, discarded };
}

export function formatTranslationKeyCsv(
  rows: TranslationKeyRow[],
  localeName: string,
  options: { includePages?: boolean } = {},
): string {
  const includePages = options.includePages ?? true;
  const header = [
    "Carpeta",
    "Bloque",
    "Clave",
    "Inglés (original)",
    `${localeName} (borrador IA)`,
    `${localeName} (revisado)`,
    "Estado",
    "Comentarios",
    ...(includePages ? ["Paginas"] : []),
  ].join(",");
  const lines = [header];
  for (const r of rows) {
    lines.push(
      [
        r.carpeta,
        r.bloque,
        r.clave,
        r.en,
        r.draft,
        r.reviewed,
        r.estado,
        r.comments,
        ...(includePages ? [r.pages] : []),
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function formatDiscardedKeyCsv(rows: DiscardedKeyRow[]): string {
  const header = [
    "Carpeta",
    "Bloque",
    "Clave",
    "Inglés (original)",
    "Motivo",
    "Paginas",
  ].join(",");
  const lines = [header];
  for (const r of rows) {
    lines.push(
      [r.carpeta, r.bloque, r.clave, r.en, r.reason, r.pages]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function resolveSiteRoot(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  const candidates = [
    path.resolve(process.cwd(), "../Site"),
    path.resolve(process.cwd(), "../../Site"),
    path.resolve(process.cwd(), "../../../Site"),
  ];
  for (const candidate of candidates) {
    if (
      existsSync(path.join(candidate, "packages/ui/src/components"))
    ) {
      return candidate;
    }
  }
  throw new Error(
    "Site repo not found. Pass --site pointing at the Site checkout.",
  );
}
