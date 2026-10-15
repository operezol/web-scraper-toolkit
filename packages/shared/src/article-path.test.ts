import { describe, expect, it } from "vitest";
import { isArticlePath } from "../src/article-path.js";
import { FXSTREET_ARTICLE_RULES } from "../src/presets/fxstreet.js";
import { normalizeCrawlUrl } from "../src/url-normalize.js";
import { evaluateDetection } from "../src/detection.js";
import { FXSTREET_DETECTION } from "../src/presets/fxstreet.js";

describe("normalizeCrawlUrl", () => {
  it("strips query and hash by default", () => {
    expect(
      normalizeCrawlUrl("https://www.fxstreet.es/account/login?x=1#y"),
    ).toBe("https://www.fxstreet.es/account/login");
  });

  it("keeps query when asked", () => {
    expect(
      normalizeCrawlUrl("https://www.fxstreet.es/a?b=1", { keepQuery: true }),
    ).toBe("https://www.fxstreet.es/a?b=1");
  });
});

describe("FXStreet article rules", () => {
  it("keeps news landings and feed", () => {
    expect(isArticlePath("/news", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(isArticlePath("/cryptocurrencies/news", FXSTREET_ARTICLE_RULES)).toBe(
      false,
    );
    expect(
      isArticlePath("/cryptocurrencies/news/feed", FXSTREET_ARTICLE_RULES),
    ).toBe(false);
  });

  it("excludes news article slugs", () => {
    expect(
      isArticlePath(
        "/cryptocurrencies/news/aave-lanza-v4-en-ethereum-202603301932",
        FXSTREET_ARTICLE_RULES,
      ),
    ).toBe(true);
    expect(
      isArticlePath("/news/some-long-slug-202609030900", FXSTREET_ARTICLE_RULES),
    ).toBe(true);
  });

  it("keeps analysis feed/latest, excludes analysis posts", () => {
    expect(isArticlePath("/analysis", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(isArticlePath("/analysis/latest", FXSTREET_ARTICLE_RULES)).toBe(
      false,
    );
    expect(isArticlePath("/analysis/feed", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(
      isArticlePath(
        "/analysis/analisis-de-la-fed-revirtiendo-el-rumbo-202607300743",
        FXSTREET_ARTICLE_RULES,
      ),
    ).toBe(true);
  });

  it("collapses high-volume slug families", () => {
    expect(isArticlePath("/company", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(isArticlePath("/company/analix", FXSTREET_ARTICLE_RULES)).toBe(true);
    expect(isArticlePath("/author", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(isArticlePath("/author/someone", FXSTREET_ARTICLE_RULES)).toBe(true);
    expect(isArticlePath("/education", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(isArticlePath("/education/curso-forex", FXSTREET_ARTICLE_RULES)).toBe(
      false,
    );
    expect(
      isArticlePath("/education/curso-forex/unidad-1", FXSTREET_ARTICLE_RULES),
    ).toBe(true);
    expect(isArticlePath("/education/una-leccion-201804251422", FXSTREET_ARTICLE_RULES)).toBe(
      true,
    );
    expect(isArticlePath("/brokers", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(isArticlePath("/brokers/best", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(isArticlePath("/brokers/best/accounts", FXSTREET_ARTICLE_RULES)).toBe(
      true,
    );
    expect(isArticlePath("/brokers/fxpro", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(isArticlePath("/rates-charts", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(isArticlePath("/rates-charts/chart", FXSTREET_ARTICLE_RULES)).toBe(
      false,
    );
    expect(isArticlePath("/rates-charts/audnzd", FXSTREET_ARTICLE_RULES)).toBe(
      true,
    );
    expect(
      isArticlePath("/calendario-economico/event/abc", FXSTREET_ARTICLE_RULES),
    ).toBe(true);
    expect(isArticlePath("/calendario-economico", FXSTREET_ARTICLE_RULES)).toBe(
      false,
    );
    expect(
      isArticlePath("/notizie/foo-bar-202603240930", FXSTREET_ARTICLE_RULES),
    ).toBe(true);
    expect(isArticlePath("/notizie", FXSTREET_ARTICLE_RULES)).toBe(false);
    expect(isArticlePath("/notizie/latest", FXSTREET_ARTICLE_RULES)).toBe(false);
  });
});

describe("evaluateDetection FXStreet", () => {
  it("detects next", () => {
    const html = `<html><head><style data-precedence="next"></style></head></html>`;
    expect(evaluateDetection(html, FXSTREET_DETECTION)).toBe("next");
  });

  it("detects sitefinity", () => {
    const html = `<html><head><meta name="Generator" content="Sitefinity 14"></head></html>`;
    expect(evaluateDetection(html, FXSTREET_DETECTION)).toBe("sitefinity");
  });
});
