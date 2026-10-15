import { describe, expect, it } from "vitest";
import {
  extractHeaderMenuLinks,
  extractInternalLinksFromHtml,
  extractPathsFromJsonText,
} from "../src/link-extract.js";

describe("extractInternalLinksFromHtml", () => {
  it("keeps header, body and footer links, including www/apex", () => {
    const html = `
      <header><a href="/rates-charts">Charts</a></header>
      <main><a href="https://fxstreet.it/news">News</a></main>
      <footer><a href="/info/contact-us">Contact</a></footer>`;
    const links = extractInternalLinksFromHtml(html, "https://www.fxstreet.it/", {
      allowedHosts: ["www.fxstreet.it", "fxstreet.it"],
    });
    expect(links.some((u) => u.endsWith("/rates-charts"))).toBe(true);
    expect(links.some((u) => u.includes("/news"))).toBe(true);
    expect(links.some((u) => u.endsWith("/info/contact-us"))).toBe(true);
  });

  it("rewrites inherited EN bounce hrefs onto the locale origin", () => {
    const html = `<header><a href="https://www.fxstreet.com/education">Education</a></header>`;
    const links = extractInternalLinksFromHtml(html, "https://www.fxstreet.fr/", {
      allowedHosts: ["www.fxstreet.fr", "fxstreet.fr"],
      rewriteHostsToOrigin: ["www.fxstreet.com", "fxstreet.com"],
    });
    expect(links).toContain("https://www.fxstreet.fr/education");
    expect(links.some((u) => u.includes("fxstreet.com/education"))).toBe(false);
  });

  it("reads paths from Next JSON payloads", () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">{"props":{"url":"/brokers/fxpro"}}</script></html>`;
    const links = extractInternalLinksFromHtml(html, "https://www.fxstreet.fr/");
    expect(links.some((u) => u.endsWith("/brokers/fxpro"))).toBe(true);
  });
});

describe("extractPathsFromJsonText", () => {
  it("keeps same-host paths and drops assets", () => {
    const allowed = new Set(["www.fxstreet.com"]);
    const found = extractPathsFromJsonText(
      `{"a":"/news","b":"/_next/static/x.js","c":"https://www.fxstreet.com/brokers"}`,
      "https://www.fxstreet.com/",
      allowed,
    );
    expect(found.some((u) => u.endsWith("/news"))).toBe(true);
    expect(found.some((u) => u.endsWith("/brokers"))).toBe(true);
    expect(found.some((u) => u.includes("/_next/"))).toBe(false);
  });
});


describe("extractHeaderMenuLinks", () => {
  it("reads Sitefinity desktop mega-menu only", () => {
    const html = `
      <header>
        <div id="fxs_it_horizontalMenu">
          <nav class="fxs_nav_menu fxs_main_nav">
            <a href="/rates-charts">Grafici</a>
            <a href="/economic-calendar">Calendario</a>
            <a href="/brokers">Broker</a>
          </nav>
        </div>
      </header>
      <footer><a href="/info/about-us">About</a></footer>`;
    const links = extractHeaderMenuLinks(html, "https://www.fxstreet.it/");
    expect(links.map((l) => l.path)).toEqual([
      "/rates-charts",
      "/economic-calendar",
      "/brokers",
    ]);
  });

  it("reads Next header nav", () => {
    const html = `
      <header>
        <nav aria-label="Main">
          <a href="/news">News</a>
          <a href="/calendario-economico">Calendario</a>
        </nav>
      </header>`;
    const links = extractHeaderMenuLinks(html, "https://www.fxstreet.es/");
    expect(links.map((l) => l.path)).toEqual(["/news", "/calendario-economico"]);
  });

  it("rewrites EN header hrefs to the locale path", () => {
    const html = `
      <header>
        <div id="fxs_it_horizontalMenu">
          <a href="https://www.fxstreet.com/education">Éducation</a>
        </div>
      </header>`;
    const links = extractHeaderMenuLinks(html, "https://www.fxstreet.fr/");
    expect(links.map((l) => l.path)).toEqual(["/education"]);
    expect(links[0]?.href).toBe("https://www.fxstreet.fr/education");
  });
});
