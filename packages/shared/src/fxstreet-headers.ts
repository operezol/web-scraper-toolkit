import axios from "axios";
import { extractHeaderMenuLinks, type HeaderMenuLink } from "./link-extract.js";
import { csvEscape } from "./fxstreet-site-crawl.js";
import {
  FXSTREET_LOCALE_ORIGINS,
  getFxstreetLocaleOrigin,
} from "./presets/fxstreet.js";

export interface LocaleHeaderMenu {
  locale: string;
  startUrl: string;
  links: HeaderMenuLink[];
}

const defaultHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export async function fetchLocaleHeaderMenu(
  locale: string,
  timeoutMs = 25_000,
): Promise<LocaleHeaderMenu> {
  const origin = getFxstreetLocaleOrigin(locale);
  const response = await axios.get(origin.startUrl, {
    headers: defaultHeaders,
    timeout: timeoutMs,
    maxRedirects: 5,
  });
  const html = typeof response.data === "string" ? response.data : String(response.data);
  return {
    locale,
    startUrl: origin.startUrl,
    links: extractHeaderMenuLinks(html, origin.startUrl),
  };
}

export async function fetchLocaleHeaderMenus(
  locales: string[],
  options: {
    delayMs?: number;
    timeoutMs?: number;
    onProgress?: (locale: string, links: number) => void;
  } = {},
): Promise<LocaleHeaderMenu[]> {
  const out: LocaleHeaderMenu[] = [];
  for (const locale of locales) {
    const menu = await fetchLocaleHeaderMenu(locale, options.timeoutMs);
    options.onProgress?.(locale, menu.links.length);
    out.push(menu);
    if (options.delayMs) {
      await new Promise((r) => setTimeout(r, options.delayMs));
    }
  }
  return out;
}

export function formatHeaderMenusCsv(menus: LocaleHeaderMenu[]): string {
  const lines = ["locale,path,label,url"];
  for (const menu of menus) {
    for (const link of menu.links) {
      lines.push(
        [menu.locale, link.path, link.label, link.href].map(csvEscape).join(","),
      );
    }
  }
  return lines.join("\n") + "\n";
}

export function formatHeaderMatrixCsv(menus: LocaleHeaderMenu[]): string {
  const locales = menus.map((m) => m.locale);
  const paths = new Set<string>();
  const byLocale = new Map<string, Set<string>>();
  for (const menu of menus) {
    const set = new Set(menu.links.map((l) => l.path));
    byLocale.set(menu.locale, set);
    for (const p of set) paths.add(p);
  }
  const header = ["path", ...locales].join(",");
  const lines = [header];
  for (const path of [...paths].sort()) {
    lines.push(
      [
        path,
        ...locales.map((l) => (byLocale.get(l)?.has(path) ? "1" : "")),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function formatHeaderSummaryMarkdown(menus: LocaleHeaderMenu[]): string {
  const rows = menus
    .map(
      (m) =>
        `| ${m.locale} | ${m.links.length} | ${m.links
          .map((l) => `\`${l.path}\``)
          .slice(0, 12)
          .join(", ")}${m.links.length > 12 ? ", …" : ""} |`,
    )
    .join("\n");
  return `# Header menus (home HTML)

Solo la cabecera desktop (\`#fxs_it_horizontalMenu\` o \`header nav\`). El footer no cuenta.
Contenido editorial fino es esperado; lo que importa es qué hubs enlaza el menú.

| locale | items | paths |
|--------|------:|-------|
${rows}
`;
}

export { FXSTREET_LOCALE_ORIGINS };
