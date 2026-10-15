import { describe, expect, it } from "vitest";
import {
  classifyFetchedPage,
  isHttpNotFound,
  isSoftNotFoundHtml,
} from "./not-found-page.js";

describe("isHttpNotFound", () => {
  it("treats 404 and 410 as gone", () => {
    expect(isHttpNotFound(404)).toBe(true);
    expect(isHttpNotFound(410)).toBe(true);
    expect(isHttpNotFound(200)).toBe(false);
    expect(isHttpNotFound(301)).toBe(false);
  });
});

describe("isSoftNotFoundHtml", () => {
  it("detects FXStreet locale 404 templates", () => {
    expect(
      isSoftNotFoundHtml(
        "<title>Oops i did it again - FXStreet</title><h1>Ooops! Error 404</h1>",
      ),
    ).toBe(true);
    expect(
      isSoftNotFoundHtml(
        "<title>Oops je l&#39;ai encore fait - FXStreet</title><h1>Ooops ! Erreur 404</h1>",
      ),
    ).toBe(true);
    expect(
      isSoftNotFoundHtml(
        "<title>Oh, lo hice otra vez - FXStreet</title><h1>¡Oh! Error 404</h1>",
      ),
    ).toBe(true);
  });

  it("does not flag a live brokers hub", () => {
    expect(
      isSoftNotFoundHtml(
        "<title>FXStreet - Forex Brokers</title><h1>Forex Brokers</h1>",
      ),
    ).toBe(false);
  });
});

describe("classifyFetchedPage", () => {
  it("keeps 2xx live pages", () => {
    expect(classifyFetchedPage(200, "<title>News</title><h1>News</h1>")).toEqual(
      { ok: true, statusCode: 200 },
    );
  });

  it("discards HTTP 404 and soft 404", () => {
    expect(classifyFetchedPage(404, "<html></html>")).toEqual({
      ok: false,
      statusCode: 404,
    });
    expect(
      classifyFetchedPage(
        200,
        "<title>Oops i did it again - FXStreet</title><h1>Ooops! Error 404</h1>",
      ),
    ).toEqual({ ok: false, statusCode: 404 });
  });
});
