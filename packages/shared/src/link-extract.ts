import * as cheerio from "cheerio";
import { isFxstreetEnHost, rewriteHostToOrigin } from "./fxstreet-en-url.js";

/** Same-site hosts: explicit allowlist, else page host + www/apex pair. */
export function sameSiteHosts(
  pageUrl: string,
  allowedHosts?: string[],
): Set<string> {
  if (allowedHosts?.length) {
    return new Set(allowedHosts.map((h) => h.toLowerCase()));
  }
  const host = new URL(pageUrl).hostname.toLowerCase();
  const hosts = new Set<string>([host]);
  if (host.startsWith("www.")) hosts.add(host.slice(4));
  else hosts.add(`www.${host}`);
  return hosts;
}

export interface ExtractedInternalLink {
  href: string;
  /** True when the original href pointed at the EN site and was remapped. */
  remappedFromEn: boolean;
}

/** Internal links anywhere on the page (header, body, footer). Fragments stripped. */
export function extractInternalLinksFromHtml(
  html: string,
  pageUrl: string,
  options?: { allowedHosts?: string[]; rewriteHostsToOrigin?: string[] },
): string[] {
  return extractInternalLinksDetailed(html, pageUrl, options).map((l) => l.href);
}

export function extractInternalLinksDetailed(
  html: string,
  pageUrl: string,
  options?: { allowedHosts?: string[]; rewriteHostsToOrigin?: string[] },
): ExtractedInternalLink[] {
  const $ = cheerio.load(html);
  const urlObj = new URL(pageUrl);
  const allowed = sameSiteHosts(pageUrl, options?.allowedHosts);
  const rewriteHosts = options?.rewriteHostsToOrigin ?? [];
  const byHref = new Map<string, ExtractedInternalLink>();

  const add = (href: string, remappedFromEn: boolean) => {
    const prev = byHref.get(href);
    if (!prev) {
      byHref.set(href, { href, remappedFromEn });
      return;
    }
    if (remappedFromEn) prev.remappedFromEn = true;
  };

  $("a[href], area[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    ) {
      return;
    }

    try {
      const original = new URL(href, urlObj);
      const rewritten = rewriteHostToOrigin(href, urlObj.origin, rewriteHosts);
      const linkUrl = new URL(rewritten, urlObj);
      if (!allowed.has(linkUrl.hostname.toLowerCase())) return;
      const clean = linkUrl.href.split("#")[0]!;
      const remapped =
        rewriteHosts.length > 0 &&
        original.hostname.toLowerCase() !== linkUrl.hostname.toLowerCase();
      add(clean, remapped);
    } catch {
      /* ignore bad href */
    }
  });

  harvestEmbeddedJsonPaths($, urlObj, allowed, byHref, rewriteHosts);

  return [...byHref.values()].sort((a, b) => a.href.localeCompare(b.href));
}

const IGNORE_PATH_PREFIX = /^\/(_next|static|cdn-cgi|Sitefinity|api\/v1\/)|\/_next\//;
const IGNORE_PATH_EXT = /\.(js|css|map|png|jpe?g|gif|svg|webp|woff2?|ico|json)$/i;

function harvestEmbeddedJsonPaths(
  $: ReturnType<typeof cheerio.load>,
  pageUrl: URL,
  allowed: Set<string>,
  links: Map<string, ExtractedInternalLink>,
  rewriteHosts: string[] = [],
) {
  const blobs: string[] = [];
  $('script#__NEXT_DATA__, script[type="application/json"], script[type="application/ld+json"]').each(
    (_, el) => {
      const text = $(el).contents().text();
      if (text) blobs.push(text);
    },
  );
  for (const blob of blobs) {
    for (const found of extractPathsFromJsonText(blob, pageUrl, allowed, rewriteHosts)) {
      const prev = links.get(found);
      if (!prev) links.set(found, { href: found, remappedFromEn: false });
    }
  }
}

/** Pull same-site paths/URLs out of JSON payloads (Next data, widgets). */
export function extractPathsFromJsonText(
  text: string,
  pageUrl: URL | string,
  allowed: Set<string>,
  rewriteHosts: string[] = [],
): string[] {
  const page = typeof pageUrl === "string" ? new URL(pageUrl) : pageUrl;
  const out = new Set<string>();
  const quoted = text.matchAll(/"(https?:\/\/[^"\\]+|\/[A-Za-z][^"\\]{0,240})"/g);
  for (const match of quoted) {
    const raw = match[1]!;
    try {
      const rewritten = rewriteHostToOrigin(raw, page.origin, rewriteHosts);
      const resolved = new URL(rewritten, page);
      if (!allowed.has(resolved.hostname.toLowerCase())) continue;
      const path = resolved.pathname;
      if (IGNORE_PATH_PREFIX.test(path) || IGNORE_PATH_EXT.test(path)) continue;
      if (path.length > 1 && path.includes(".")) continue;
      out.add(resolved.href.split("#")[0]!);
    } catch {
      /* skip */
    }
  }
  return [...out];
}

export interface HeaderMenuLink {
  path: string;
  href: string;
  label: string;
}

/**
 * Desktop header / mega-menu only (Sitefinity `#fxs_it_horizontalMenu`
 * or Next `header nav`). Footer and hamburger-duplicate lists are ignored.
 */
export function extractHeaderMenuLinks(
  html: string,
  pageUrl: string,
): HeaderMenuLink[] {
  const $ = cheerio.load(html);
  const page = new URL(pageUrl);
  let anchors = $("#fxs_it_horizontalMenu a[href]");
  if (anchors.length === 0) {
    anchors = $("header nav a[href]");
  }
  if (anchors.length === 0) {
    anchors = $("nav.fxs_main_nav").first().find("a[href]");
  }

  const seen = new Set<string>();
  const out: HeaderMenuLink[] = [];

  anchors.each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let resolved: URL;
    try {
      resolved = new URL(href, page);
    } catch {
      return;
    }
    if (isFxstreetEnHost(resolved.hostname) && resolved.hostname !== page.hostname) {
      resolved.protocol = page.protocol;
      resolved.host = page.host;
    }
    if (resolved.hostname !== page.hostname) return;
    const path = resolved.pathname.replace(/\/+$/, "") || "/";
    if (seen.has(path)) return;
    seen.add(path);
    const label = $(el).text().replace(/\s+/g, " ").trim();
    out.push({ path, href: `${resolved.origin}${path}`, label });
  });

  return out;
}
