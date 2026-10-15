import { describe, expect, it } from "vitest";
import {
  collapsePathsToPatterns,
  toListingPattern,
} from "../src/path-pattern.js";

describe("toListingPattern", () => {
  it("keeps hubs and collapses news/brokers slugs", () => {
    expect(toListingPattern("/news")).toBe("/news");
    expect(toListingPattern("/news/latest")).toBe("/news/latest");
    expect(toListingPattern("/news/foo-bar-202603240930")).toBe("/news/[slug]");
    expect(toListingPattern("/brokers")).toBe("/brokers");
    expect(toListingPattern("/brokers/fxpro")).toBe("/brokers/[slug]");
    expect(toListingPattern("/brokers/best")).toBe("/brokers/best");
    expect(toListingPattern("/brokers/best/beginners-brokers-australia")).toBe(
      "/brokers/best/[slug]",
    );
    expect(toListingPattern("/brokers/reviews/octa")).toBe(
      "/brokers/reviews/[slug]",
    );
    expect(toListingPattern("/rates-charts/eurusd")).toBe("/rates-charts/[slug]");
    expect(toListingPattern("/rates-charts/chart")).toBe("/rates-charts/chart");
  });
});

describe("collapsePathsToPatterns", () => {
  it("counts collapsed slugs once as a pattern", () => {
    const rows = collapsePathsToPatterns([
      "/brokers",
      "/brokers/fxpro",
      "/brokers/xtb",
      "/news",
    ]);
    expect(rows.find((r) => r.pattern === "/brokers/[slug]")?.count).toBe(2);
    expect(rows.find((r) => r.pattern === "/brokers")?.type).toBe("static");
  });
});
