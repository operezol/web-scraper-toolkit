import * as cheerio from "cheerio";

/** Internal links for the same hostname as pageUrl; fragments stripped. */
export function extractInternalLinksFromHtml(
  html: string,
  pageUrl: string,
): string[] {
  const $ = cheerio.load(html);
  const urlObj = new URL(pageUrl);
  const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
  const links = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    try {
      let fullUrl: string;
      if (href.startsWith("http://") || href.startsWith("https://")) {
        fullUrl = href;
      } else if (href.startsWith("//")) {
        fullUrl = `${urlObj.protocol}${href}`;
      } else if (href.startsWith("/")) {
        fullUrl = `${baseUrl}${href}`;
      } else if (
        !href.startsWith("#") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:")
      ) {
        fullUrl = `${baseUrl}/${href}`;
      } else {
        return;
      }

      const linkUrl = new URL(fullUrl);
      if (linkUrl.hostname === urlObj.hostname) {
        links.add(fullUrl.split("#")[0]);
      }
    } catch {
      /* ignore bad href */
    }
  });

  return Array.from(links).sort();
}
