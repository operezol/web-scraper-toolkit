import { describe, expect, it } from "vitest";
import {
  inferFirstSegmentAliases,
  mergeLocaleCompare,
  parseFxstreetPagesCsv,
  toEnCanonical,
} from "../src/compare-crawls.js";
import { allowedHostsFromStartUrl } from "../src/presets/fxstreet.js";
import type { CrawlResult } from "../src/crawl-types.js";

describe("allowedHostsFromStartUrl", () => {
  it("adds apex for www hosts", () => {
    expect(allowedHostsFromStartUrl("https://www.fxstreet.it/")).toEqual([
      "www.fxstreet.it",
      "fxstreet.it",
    ]);
  });

  it("adds www for locale subdomains", () => {
    expect(allowedHostsFromStartUrl("https://pt.fxstreet.com/")).toEqual([
      "pt.fxstreet.com",
      "www.pt.fxstreet.com",
    ]);
  });
});

describe("inferFirstSegmentAliases", () => {
  it("joins calendar tails across first segments", () => {
    const aliases = inferFirstSegmentAliases(
      ["/calendrier-economique/world-interest-rates", "/news"],
      ["/economic-calendar/world-interest-rates", "/news"],
    );
    const hit = aliases.find((a) => a.localeSegment === "calendrier-economique");
    expect(hit?.enSegment).toBe("economic-calendar");
    expect(hit?.source).toBe("known");
    expect(hit?.sharedTails).toBe(1);
  });

  it("does not alias hubs that only share generic tails", () => {
    const aliases = inferFirstSegmentAliases(
      ["/education/latest"],
      ["/analysis/latest", "/education/latest"],
    );
    expect(aliases.find((a) => a.localeSegment === "education")).toBeUndefined();
  });

  it("infers unknown first segments from tail overlap", () => {
    const aliases = inferFirstSegmentAliases(
      ["/kalender/world-interest-rates", "/kalender/forex-market-hours"],
      [
        "/economic-calendar/world-interest-rates",
        "/economic-calendar/forex-market-hours",
      ],
    );
    const hit = aliases.find((a) => a.localeSegment === "kalender");
    expect(hit).toEqual({
      localeSegment: "kalender",
      enSegment: "economic-calendar",
      sharedTails: 2,
      source: "tail-overlap",
    });
  });
});

describe("toEnCanonical", () => {
  it("rewrites known calendar + broker landings", () => {
    const aliases = new Map([["calendario-economico", "economic-calendar"]]);
    expect(toEnCanonical("/calendario-economico/nfp", aliases)).toBe(
      "/economic-calendar/nfp",
    );
    expect(toEnCanonical("/beginners-brokers-australia", aliases)).toBe(
      "/brokers/best/beginners-brokers-australia",
    );
    expect(toEnCanonical("/brokers", aliases)).toBe("/brokers");
  });
});

describe("mergeLocaleCompare", () => {
  it("marks same-path and calendar-alias", () => {
    const locale: CrawlResult = {
      pages: [
        {
          url: "https://www.fxstreet.fr/news",
          normalizedPath: "/news",
          statusCode: 200,
          foundOn: "/",
          label: "sitefinity",
        },
        {
          url: "https://www.fxstreet.fr/calendrier-economique",
          normalizedPath: "/calendrier-economique",
          statusCode: 200,
          foundOn: "/",
          label: "sitefinity",
        },
      ],
      broken: [],
    };
    const en: CrawlResult = {
      pages: [
        {
          url: "https://www.fxstreet.com/news",
          normalizedPath: "/news",
          statusCode: 200,
          foundOn: "/",
          label: "next",
        },
        {
          url: "https://www.fxstreet.com/economic-calendar",
          normalizedPath: "/economic-calendar",
          statusCode: 200,
          foundOn: "/",
          label: "next",
        },
      ],
      broken: [],
    };
    const { rows, byType } = mergeLocaleCompare(locale, en);
    expect(byType["same-path"]).toBe(1);
    expect(byType["calendar-alias"]).toBe(1);
    expect(rows.find((r) => r.pathKey === "/economic-calendar")?.pathLocale).toBe(
      "/calendrier-economique",
    );
  });
});

describe("parseFxstreetPagesCsv", () => {
  it("reads inventory columns", () => {
    const pages = parseFxstreetPagesCsv(
      "normalized_path,environment,http_status,found_on,url\n/news,sitefinity,200,/,https://www.fxstreet.it/news\n",
    );
    expect(pages).toHaveLength(1);
    expect(pages[0]?.normalizedPath).toBe("/news");
    expect(pages[0]?.httpStatus).toBe(200);
  });
});
