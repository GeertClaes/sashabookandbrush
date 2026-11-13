import { describe, expect, it } from "vitest";
import { largerGoodreadsCover } from "./cover-fetch.mjs";

describe("largerGoodreadsCover", () => {
  it("returns an empty cover URL unchanged", () => {
    expect(largerGoodreadsCover("")).toBe("");
    expect(largerGoodreadsCover(null)).toBe(null);
  });

  it("rejects a Goodreads placeholder image", () => {
    expect(largerGoodreadsCover("http://images.example/nophoto/book.jpg")).toBe("");
    expect(largerGoodreadsCover("https://images.example/no-cover.jpg")).toBe("");
  });

  it("upgrades http and the Goodreads size suffix", () => {
    expect(largerGoodreadsCover("http://img.example/book._SY75_.jpg")).toBe(
      "https://img.example/book._SX800_.jpg",
    );
  });

  it("leaves a URL with no size suffix alone", () => {
    expect(largerGoodreadsCover("https://img.example/book._SX98.jpg")).toBe(
      "https://img.example/book._SX98.jpg",
    );
  });
});
