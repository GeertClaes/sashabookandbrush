import { describe, expect, it } from "vitest";
import { affiliateLinks, realUrl, tagAmazonUrl, taggedAmazon } from "./affiliates";

describe("realUrl", () => {
  it("returns an empty string for blank, placeholder, or missing values", () => {
    expect(realUrl()).toBe("");
    expect(realUrl("")).toBe("");
    expect(realUrl("#")).toBe("");
    expect(realUrl("   ")).toBe("");
  });

  it("extracts an http(s) URL embedded in surrounding text", () => {
    expect(realUrl("See https://example.com/book (great read)")).toBe("https://example.com/book");
  });

  it("strips zero-width characters and trims trailing punctuation", () => {
    expect(realUrl("https://example.com/book,")).toBe("https://example.com/book");
    expect(realUrl("\u200Bhttps://example.com/book\u200B")).toBe("https://example.com/book");
  });

  it("returns a bare non-URL string as empty", () => {
    expect(realUrl("not a link")).toBe("");
  });
});

describe("taggedAmazon", () => {
  const tag = "sashabookandb-21";

  it("returns empty for a non-Amazon or missing URL", () => {
    expect(taggedAmazon("", tag)).toBe("");
    expect(taggedAmazon("https://uk.bookshop.org/a/1/123", tag)).toBe(
      "https://uk.bookshop.org/a/1/123",
    );
  });

  it("rewrites a /dp/ product URL to the canonical tagged nosim link", () => {
    expect(taggedAmazon("https://www.amazon.co.uk/Some-Book/dp/1649374046/ref=abc", tag)).toBe(
      "https://www.amazon.co.uk/dp/1649374046/ref=nosim?tag=sashabookandb-21",
    );
  });

  it("uses www.amazon.com for .com links", () => {
    expect(taggedAmazon("https://amazon.com/dp/1649374046", tag)).toBe(
      "https://www.amazon.com/dp/1649374046/ref=nosim?tag=sashabookandb-21",
    );
  });

  it("appends the tag query param when the URL has no recognizable ASIN", () => {
    expect(taggedAmazon("https://www.amazon.co.uk/s?k=book", tag)).toBe(
      "https://www.amazon.co.uk/s?k=book&tag=sashabookandb-21",
    );
  });

  it("returns the URL unchanged when there is no tag", () => {
    expect(taggedAmazon("https://www.amazon.co.uk/dp/1649374046", "")).toBe(
      "https://www.amazon.co.uk/dp/1649374046",
    );
  });
});

describe("tagAmazonUrl", () => {
  const tag = "sashabookandb-21";

  it("returns empty for a missing/empty cleaned URL", () => {
    expect(tagAmazonUrl("", tag)).toBe("");
  });

  it("works on a pre-cleaned URL that didn't come from realUrl", () => {
    // Exercises the admin editor's use case: its own firstHttpUrl() accepts
    // bare domains/short links (e.g. "amazon.co.uk/dp/...") that realUrl
    // would reject, so it calls tagAmazonUrl directly on its own output.
    expect(tagAmazonUrl("https://amazon.co.uk/dp/1649374046", tag)).toBe(
      "https://www.amazon.co.uk/dp/1649374046/ref=nosim?tag=sashabookandb-21",
    );
  });

  it("leaves non-Amazon URLs unchanged", () => {
    expect(tagAmazonUrl("https://uk.bookshop.org/a/1/123", tag)).toBe(
      "https://uk.bookshop.org/a/1/123",
    );
  });
});

describe("affiliateLinks", () => {
  it("builds a bookshop link from the ISBN-13 when no override is set", () => {
    const links = affiliateLinks({ isbn: "9781649374042" });
    expect(links.bookshop).toContain("9781649374042");
  });

  it("prefers an explicit bookshop/amazon override over generated links", () => {
    const links = affiliateLinks({
      isbn: "9781649374042",
      bookshop: "https://uk.bookshop.org/a/custom/999",
    });
    expect(links.bookshop).toBe("https://uk.bookshop.org/a/custom/999");
  });

  it("falls back to an empty bookshop link with no ISBN and no override", () => {
    const links = affiliateLinks({});
    expect(links.bookshop).toBe("");
  });
});
