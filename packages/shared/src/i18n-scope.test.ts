import { describe, expect, it } from "vitest";
import {
  decideNamespaces,
  keyBelongsToInventory,
  pathMatchesPrefix,
  scopeForNamespace,
} from "./i18n-scope.js";

describe("pathMatchesPrefix", () => {
  it("matches hub and children, not siblings", () => {
    expect(pathMatchesPrefix("/brokers/fxpro", "/brokers")).toBe(true);
    expect(pathMatchesPrefix("/brokers", "/brokers")).toBe(true);
    expect(pathMatchesPrefix("/news", "/brokers")).toBe(false);
    expect(pathMatchesPrefix("/education", "/")).toBe(false);
  });
});

describe("decideNamespaces", () => {
  it("keeps chrome, drops EN-only and missing pages", () => {
    const decisions = decideNamespaces(
      ["/", "/brokers", "/brokers/fxpro", "/rates-charts"],
      [
        "header",
        "education",
        "brokers",
        "broker-detail",
        "press-release",
        "newsletter",
        "mystery-ns",
      ],
      { locale: "fr" },
    );
    const byNs = Object.fromEntries(decisions.map((d) => [d.ns, d]));
    expect(byNs.header?.include).toBe(true);
    expect(byNs.brokers?.include).toBe(true);
    expect(byNs["broker-detail"]?.include).toBe(true);
    expect(byNs.education?.include).toBe(false);
    expect(byNs.education?.reason).toBe("page-not-in-inventory");
    expect(byNs["press-release"]?.reason).toBe("en-only-gate");
    expect(byNs.newsletter?.reason).toBe("en-only-gate");
    expect(byNs["mystery-ns"]?.reason).toBe("unmapped-namespace");
  });

  it("keeps education when the locale inventory has it", () => {
    const [education] = decideNamespaces(["/education"], ["education"], {
      locale: "es",
    });
    expect(education?.include).toBe(true);
  });

  it("includes a page that only exists as an EN-bounce relink", () => {
    const [education] = decideNamespaces(["/", "/education"], ["education"], {
      locale: "fr",
    });
    expect(education?.include).toBe(true);
  });
});

describe("keyBelongsToInventory topic-page", () => {
  it("keeps only topic keys whose hub is live", () => {
    const scope = scopeForNamespace("topic-page")!;
    expect(
      keyBelongsToInventory(
        "topics.cryptocurrencies.bitcoin.seo.title",
        scope,
        ["/cryptocurrencies"],
      ).include,
    ).toBe(true);
    expect(
      keyBelongsToInventory(
        "topics.commodities.gold.seo.title",
        scope,
        ["/cryptocurrencies"],
      ).include,
    ).toBe(false);
    expect(
      keyBelongsToInventory("sidebar.latestContent", scope, ["/cryptocurrencies"])
        .include,
    ).toBe(true);
  });
});
