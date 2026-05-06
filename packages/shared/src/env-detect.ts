import * as cheerio from "cheerio";

export type PageEnvironment = "next" | "sitefinity" | "unknown" | "conflict";

/**
 * Detects FXStreet page stack from HTML.
 * Next: <style data-precedence="next"> and/or any script src containing "_next".
 * Sitefinity: meta Generator contains "Sitefinity".
 */
export function detectPageEnvironment(html: string): PageEnvironment {
  const $ = cheerio.load(html);

  let hasNext = false;
  if ($('style[data-precedence="next"]').length > 0) {
    hasNext = true;
  }

  $("script[src]").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (src.includes("_next")) {
      hasNext = true;
    }
  });

  const generator =
    $('meta[name="Generator"]').attr("content") ??
    $('meta[name="generator"]').attr("content") ??
    "";
  const hasSitefinity = generator.includes("Sitefinity");

  if (hasNext && hasSitefinity) return "conflict";
  if (hasNext) return "next";
  if (hasSitefinity) return "sitefinity";
  return "unknown";
}

/** Same pathname on www vs qa for joining rows (trailing slash stripped except root). */
export function normalizeInternalPath(urlString: string): string {
  const u = new URL(urlString);
  let path = u.pathname;
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path || "/";
}
