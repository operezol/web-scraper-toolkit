import { describe, expect, it } from "vitest";
import {
  parseRobotsSitemapUrls,
  parseSitemapXml,
  rewriteSitemapLocToOrigin,
} from "../src/sitemap.js";

describe("parseSitemapXml", () => {
  it("reads urlset locs", () => {
    const xml = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://www.fxstreet.fr/brokers</loc></url>
        <url><loc><![CDATA[https://www.fxstreet.fr/brokers/fxpro]]></loc></url>
      </urlset>`;
    const parsed = parseSitemapXml(xml);
    expect(parsed.isIndex).toBe(false);
    expect(parsed.locs).toEqual([
      "https://www.fxstreet.fr/brokers",
      "https://www.fxstreet.fr/brokers/fxpro",
    ]);
  });

  it("reads sitemap index", () => {
    const xml = `<sitemapindex>
      <sitemap><loc>https://www.fxstreet.fr/sitemap-news.xml</loc></sitemap>
    </sitemapindex>`;
    const parsed = parseSitemapXml(xml);
    expect(parsed.isIndex).toBe(true);
    expect(parsed.locs).toEqual(["https://www.fxstreet.fr/sitemap-news.xml"]);
  });
});

describe("rewriteSitemapLocToOrigin", () => {
  it("moves EN sitemap paths onto a locale origin", () => {
    expect(
      rewriteSitemapLocToOrigin(
        "https://www.fxstreet.com/brokers/fxpro",
        "https://www.fxstreet.fr/",
      ),
    ).toBe("https://www.fxstreet.fr/brokers/fxpro");
  });
});

describe("parseRobotsSitemapUrls", () => {
  it("extracts Sitemap lines", () => {
    expect(
      parseRobotsSitemapUrls(
        "User-agent: *\nSitemap: https://www.fxstreet.fr/sitemap.xml\n",
      ),
    ).toEqual(["https://www.fxstreet.fr/sitemap.xml"]);
  });
});
