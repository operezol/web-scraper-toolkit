import { describe, expect, it } from "vitest";
import {
  isFxstreetEnHost,
  rewriteEnSiteUrlToOrigin,
} from "./fxstreet-en-url.js";

describe("rewriteEnSiteUrlToOrigin", () => {
  it("moves EN hrefs onto the locale origin", () => {
    expect(
      rewriteEnSiteUrlToOrigin(
        "https://www.fxstreet.com/education",
        "https://www.fxstreet.fr/",
      ),
    ).toBe("https://www.fxstreet.fr/education");
    expect(
      rewriteEnSiteUrlToOrigin(
        "//fxstreet.com/brokers/fxpro",
        "https://www.fxstreet.it/",
      ),
    ).toBe("https://www.fxstreet.it/brokers/fxpro");
  });

  it("leaves other hosts and same-locale paths alone", () => {
    expect(
      rewriteEnSiteUrlToOrigin(
        "https://www.fxstreet.fr/news",
        "https://www.fxstreet.fr/",
      ),
    ).toBe("https://www.fxstreet.fr/news");
    expect(
      rewriteEnSiteUrlToOrigin(
        "https://cashback.fxstreet.com/",
        "https://www.fxstreet.fr/",
      ),
    ).toBe("https://cashback.fxstreet.com/");
  });
});

describe("isFxstreetEnHost", () => {
  it("is only the EN site, not other TLDs", () => {
    expect(isFxstreetEnHost("www.fxstreet.com")).toBe(true);
    expect(isFxstreetEnHost("www.fxstreet.fr")).toBe(false);
    expect(isFxstreetEnHost("pt.fxstreet.com")).toBe(false);
  });
});
