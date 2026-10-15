import { describe, expect, it } from "vitest";
import { extractNavEntries, flattenI18nLeaves } from "./translation-keys.js";

describe("flattenI18nLeaves", () => {
  it("flattens nested objects and arrays", () => {
    const leaves = flattenI18nLeaves({
      title: "Hello",
      items: [{ text: "A" }],
    });
    expect(leaves).toEqual([
      { clave: "title", value: "Hello" },
      { clave: "items[0].text", value: "A" },
    ]);
  });
});

describe("extractNavEntries", () => {
  it("reads Text and nearby path literals", () => {
    const entries = extractNavEntries(`
      {
        Text: 'Education',
        Id: 'EDU_SECTION',
        Url: '/education',
        Tracking: { Feature: 'section' },
      }
    `);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe("Education");
    expect(entries[0]?.paths).toContain("/education");
  });

  it("infers paths from route constant expressions", () => {
    const entries = extractNavEntries(`
      { Text: 'Education', Id: 'EDU', Url: CONTENT_ROUTES.education.root, Tracking: { Feature: 'section' } }
    `);
    expect(entries[0]?.paths).toContain("/education");
  });
});
