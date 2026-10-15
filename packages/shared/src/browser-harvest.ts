import type { Browser, Page } from "playwright";
import type { ExtractedInternalLink } from "./link-extract.js";
import { extractInternalLinksDetailed } from "./link-extract.js";
import { rewriteHostToOrigin } from "./fxstreet-en-url.js";

export interface RenderedPage {
  url: string;
  finalUrl: string;
  statusCode: number;
  html: string;
  links: string[];
  linksDetailed: ExtractedInternalLink[];
}

async function expandInteractiveUi(): Promise<void> {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const clickIfPresent = (selector: string) => {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) el.click();
  };

  clickIfPresent("#fxs_showLeftPush");
  clickIfPresent(".fxs_show_navmenu");
  clickIfPresent('button[aria-label*="menu" i]');
  await sleep(200);

  document.querySelectorAll("details").forEach((d) => {
    d.open = true;
  });

  const triggers = document.querySelectorAll(
    [
      "header button",
      "header [aria-haspopup]",
      "header [aria-expanded]",
      "header [data-state]",
      "[fxs-desktop-menu-entry]",
      ".fxs_nav_main_menu_desktop",
      "[role='menuitem']",
      "button[aria-controls]",
      "[data-radix-collection-item]",
    ].join(","),
  );

  for (const node of triggers) {
    const el = node instanceof HTMLElement ? node : null;
    if (!el) continue;
    el.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    try {
      el.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
    if (
      el.matches(
        "button, [role='button'], [aria-haspopup], [aria-expanded='false']",
      )
    ) {
      try {
        el.click();
      } catch {
        /* ignore */
      }
    }
    await sleep(60);
  }

  await sleep(150);
}

/**
 * One Chromium instance reused for a crawl. Opens menus / accordions, then
 * collects hrefs from the live DOM (Radix mega-menu, Sitefinity hamburger, …).
 */
export class RenderedCrawlSession {
  private browser: Browser | undefined;

  async start(): Promise<void> {
    const { chromium } = await import("playwright");
    this.browser = await chromium.launch({ headless: true });
  }

  async fetch(
    url: string,
    options: {
      timeoutMs?: number;
      allowedHosts?: string[];
      rewriteHostsToOrigin?: string[];
    } = {},
  ): Promise<RenderedPage> {
    if (!this.browser) {
      throw new Error("RenderedCrawlSession.start() must be called first");
    }
    const timeout = options.timeoutMs ?? 25_000;
    const allowed = new Set(
      (options.allowedHosts ?? []).map((h) => h.toLowerCase()),
    );
    const rewriteHosts = options.rewriteHostsToOrigin ?? [];
    const origin = new URL(url).origin;
    const empty = (finalUrl: string, statusCode: number): RenderedPage => ({
      url,
      finalUrl,
      statusCode,
      html: "",
      links: [],
      linksDetailed: [],
    });
    const page = await this.browser.newPage();
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout,
      });
      const statusCode = response?.status() ?? 0;
      const landed = page.url();
      let landedHost = "";
      try {
        landedHost = new URL(landed).hostname.toLowerCase();
      } catch {
        return empty(landed, statusCode || 0);
      }
      if (allowed.size > 0 && !allowed.has(landedHost)) {
        return empty(landed, 301);
      }
      if (statusCode < 200 || statusCode >= 300) {
        return empty(landed, statusCode);
      }
      await page.waitForTimeout(400);
      await page.evaluate(expandInteractiveUi).catch(() => undefined);
      await page.waitForTimeout(200);
      const html = await page.content();
      const finalUrl = page.url();
      const detailed = extractInternalLinksDetailed(html, url, {
        allowedHosts: options.allowedHosts,
        rewriteHostsToOrigin: rewriteHosts,
      });
      const byHref = new Map(detailed.map((l) => [l.href, l]));
      const liveHrefs = await collectLiveHrefs(page);
      for (const href of liveHrefs) {
        try {
          const original = new URL(href, url);
          const rewritten = rewriteHostToOrigin(href, origin, rewriteHosts);
          const resolved = new URL(rewritten, url);
          if (allowed.size > 0 && !allowed.has(resolved.hostname.toLowerCase())) {
            continue;
          }
          const clean = resolved.href.split("#")[0]!;
          const remapped =
            original.hostname.toLowerCase() !== resolved.hostname.toLowerCase();
          const prev = byHref.get(clean);
          if (!prev) byHref.set(clean, { href: clean, remappedFromEn: remapped });
          else if (remapped) prev.remappedFromEn = true;
        } catch {
          /* skip */
        }
      }
      const linksDetailed = [...byHref.values()];
      return {
        url,
        finalUrl,
        statusCode,
        html,
        links: linksDetailed.map((l) => l.href),
        linksDetailed,
      };
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }
}

async function collectLiveHrefs(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("a[href], area[href], [data-href]")]
      .map((el) => {
        const href =
          el instanceof HTMLAnchorElement
            ? el.href
            : el.getAttribute("href") || el.getAttribute("data-href") || "";
        return href;
      })
      .filter(Boolean),
  );
}
