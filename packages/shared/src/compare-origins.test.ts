import { describe, expect, it } from "vitest";
import {
  formatFxstreetEsBrokenCsv,
  formatFxstreetEsPagesCsv,
} from "../src/fxstreet-es-crawl.js";
import {
  mergeOriginCompare,
  processedPathKey,
} from "../src/compare-origins.js";
import type { CrawlResult } from "../src/crawl-types.js";

describe("processedPathKey", () => {
  it("maps calendar and educacion aliases", () => {
    expect(processedPathKey("/economic-calendar/world-interest-rates")).toBe(
      "/calendario-economico/world-interest-rates",
    );
    expect(processedPathKey("/educacion")).toBe("/education");
  });

  it("maps root broker SEO landings to /brokers/best/{slug}", () => {
    expect(processedPathKey("/beginners-brokers-australia")).toBe(
      "/brokers/best/beginners-brokers-australia",
    );
  });
});

describe("FXStreet ES CSV", () => {
  it("includes http_status and found_on", () => {
    const csv = formatFxstreetEsPagesCsv([
      {
        url: "https://www.fxstreet.es/news",
        normalizedPath: "/news",
        environment: "sitefinity",
        httpStatus: 200,
        foundOn: "/",
      },
    ]);
    expect(csv.split("\n")[0]).toBe(
      "normalized_path,environment,http_status,found_on,url",
    );
    expect(csv).toContain("/news,sitefinity,200,/,https://www.fxstreet.es/news");
  });

  it("writes broken links with found_on", () => {
    const csv = formatFxstreetEsBrokenCsv([
      {
        url: "https://www.fxstreet.es/nope",
        normalizedPath: "/nope",
        httpStatus: 404,
        foundOn: "/",
      },
    ]);
    expect(csv.split("\n")[0]).toBe(
      "normalized_path,http_status,found_on,url",
    );
    expect(csv).toContain("/nope,404,/,https://www.fxstreet.es/nope");
  });
});

describe("mergeOriginCompare", () => {
  it("joins calendar alias as one row", () => {
    const legacy: CrawlResult = {
      pages: [
        {
          url: "https://www.fxstreet.es/economic-calendar",
          normalizedPath: "/economic-calendar",
          statusCode: 200,
          foundOn: "/",
          label: "sitefinity",
        },
      ],
      broken: [],
    };
    const processed: CrawlResult = {
      pages: [
        {
          url: "https://qa.example/calendario-economico",
          normalizedPath: "/calendario-economico",
          statusCode: 200,
          foundOn: "/",
          label: "next",
        },
      ],
      broken: [],
    };
    const rows = mergeOriginCompare(legacy, processed);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.matchType).toBe("calendar-alias");
    expect(rows[0]?.pathKey).toBe("/calendario-economico");
  });
});
