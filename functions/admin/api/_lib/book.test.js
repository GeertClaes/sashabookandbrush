import { describe, expect, it } from "vitest";
import { BOOK_MAX_NOTE, deriveBookUpdates } from "./book.js";

describe("deriveBookUpdates", () => {
  it("rejects a note over the length limit", () => {
    const { error } = deriveBookUpdates({ note: "x".repeat(BOOK_MAX_NOTE + 1) });
    expect(error).toBe("That note is too long");
  });

  it("only includes fields that were actually provided", () => {
    const { updates } = deriveBookUpdates({ title: "Fourth Wing" });
    expect(updates).toEqual({ title: "Fourth Wing" });
  });

  it("trims title/author and ignores blank values", () => {
    const { updates } = deriveBookUpdates({ title: "  Fourth Wing  ", author: "   " });
    expect(updates.title).toBe("Fourth Wing");
    expect(updates.author).toBeUndefined();
  });

  it("defaults a blank genre to 'Read'", () => {
    const { updates } = deriveBookUpdates({ genre: "" });
    expect(updates.genre).toBe("Read");
  });

  it("strips non-ISBN characters from isbn and isbn10", () => {
    const { updates } = deriveBookUpdates({ isbn: "978-1-6493-7404-2", isbn10: "1649374046 " });
    expect(updates.isbn).toBe("9781649374042");
    expect(updates.isbn10).toBe("1649374046");
  });

  it("only sets order when the book is (or stays) featured", () => {
    expect(deriveBookUpdates({ featured: true, order: 3 }).updates.order).toBe(3);
    expect(deriveBookUpdates({ featured: false, order: 3 }).updates.order).toBeUndefined();
  });

  it("cleans bookshop/amazon overrides via emptyAffiliateUrl", () => {
    const { updates } = deriveBookUpdates({ bookshop: "#", amazon: "https://amazon.co.uk/x" });
    expect(updates.bookshop).toBe("");
    expect(updates.amazon).toBe("https://amazon.co.uk/x");
  });
});
