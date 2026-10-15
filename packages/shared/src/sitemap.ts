import axios from "axios";

const defaultHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/** Canonical Next/EN sitemap — path list reused as the seed base for every TLD. */
export const FXSTREET_EN_SITEMAP_URL = "https://www.fxstreet.com/sitemap.xml";
export const FXSTREET_SITEMAP_PATH = "/sitemap.xml";

export interface ParsedSitemap {
  locs: string[];
  isIndex: boolean;
}

export function parseSitemapXml(xml: string): ParsedSitemap {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/gi)]
    .map((m) => decodeXml(m[1]!.trim()))
    .filter(Boolean);
  return { locs, isIndex };
}

export function parseRobotsSitemapUrls(robotsTxt: string): string[] {
  const urls: string[] = [];
  for (const line of robotsTxt.split(/\r?\n/)) {
    const m = line.match(/^\s*sitemap\s*:\s*(\S+)/i);
    if (m?.[1]) urls.push(m[1].trim());
  }
  return urls;
}

export function rewriteSitemapLocToOrigin(loc: string, origin: string): string | null {
  try {
    const from = new URL(loc);
    const base = new URL(origin);
    return `${base.protocol}//${base.host}${from.pathname}${from.search}`;
  } catch {
    return null;
  }
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function collectSitemapUrls(options: {
  origin: string;
  allowedHosts: string[];
  timeoutMs?: number;
  maxFiles?: number;
}): Promise<{ urls: string[]; sources: string[] }> {
  const timeoutMs = options.timeoutMs ?? 25_000;
  const maxFiles = options.maxFiles ?? 20;
  const origin = options.origin.replace(/\/+$/, "");
  const allowed = new Set(options.allowedHosts.map((h) => h.toLowerCase()));
  const sources: string[] = [];
  const urls = new Set<string>();
  const toFetch = new Set<string>([`${origin}${FXSTREET_SITEMAP_PATH}`]);

  try {
    const robots = await axios.get(`${origin}/robots.txt`, {
      headers: defaultHeaders,
      timeout: timeoutMs,
      responseType: "text",
      validateStatus: (s) => s >= 200 && s < 400,
    });
    for (const u of parseRobotsSitemapUrls(String(robots.data))) {
      try {
        if (allowed.has(new URL(u).hostname.toLowerCase())) toFetch.add(u);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* no robots */
  }

  let fetched = 0;
  const queue = [...toFetch];
  const seenFiles = new Set<string>();

  while (queue.length > 0 && fetched < maxFiles) {
    const fileUrl = queue.shift()!;
    if (seenFiles.has(fileUrl)) continue;
    seenFiles.add(fileUrl);
    fetched += 1;

    let xml: string;
    try {
      const res = await axios.get(fileUrl, {
        headers: defaultHeaders,
        timeout: timeoutMs,
        responseType: "text",
        validateStatus: (s) => s >= 200 && s < 400,
      });
      xml = String(res.data ?? "");
    } catch {
      continue;
    }
    if (!/<urlset|<sitemapindex/i.test(xml)) continue;

    sources.push(fileUrl);
    const parsed = parseSitemapXml(xml);
    if (parsed.isIndex) {
      for (const child of parsed.locs) {
        if (!seenFiles.has(child)) queue.push(child);
      }
      continue;
    }
    for (const loc of parsed.locs) {
      try {
        const host = new URL(loc).hostname.toLowerCase();
        if (!allowed.has(host)) continue;
        const rewritten = rewriteSitemapLocToOrigin(loc, origin);
        if (rewritten) urls.add(rewritten);
      } catch {
        /* skip */
      }
    }
  }

  return { urls: [...urls], sources };
}
