import { describe, expect, it } from "vitest";
import { countQueue, defaultQueueId, featuredBooks, filterQueue } from "./admin-books-ui.js";

const books = [
  {
    title: "Pond",
    author: "Ada",
    slug: "pond",
    rating: 5,
    note: "",
    status: "read",
    featured: true,
    order: 2,
  },
  {
    title: "River",
    author: "Bea",
    slug: "river",
    rating: 5,
    note: "loved it",
    status: "read",
    featured: false,
    order: 1,
  },
  {
    title: "Lake",
    author: "Cy",
    slug: "lake",
    rating: 4,
    note: "   ",
    status: "currently-reading",
    isbn: "",
    isbn10: "",
  },
  {
    title: "Sea",
    author: "Dee",
    slug: "sea",
    rating: 5,
    note: "",
    status: "read",
    featured: true,
    order: 1,
    isbn: "123",
  },
];

describe("filterQueue", () => {
  it("returns five-star books with no note", () => {
    expect(filterQueue(books, "five-star-no-note", "").map((book) => book.slug)).toEqual([
      "pond",
      "sea",
    ]);
  });

  it("treats a whitespace-only note as no note", () => {
    expect(filterQueue(books, "no-note", "").map((book) => book.slug)).toEqual([
      "pond",
      "lake",
      "sea",
    ]);
  });

  it("searches title, author, and slug once the query is two characters", () => {
    expect(filterQueue(books, "no-note", "be").map((book) => book.slug)).toEqual(["river"]);
    expect(filterQueue(books, "five-star-no-note", "lak").map((book) => book.slug)).toEqual([
      "lake",
    ]);
  });

  it("keeps the queue when the query is shorter than two characters", () => {
    expect(filterQueue(books, "currently-reading", "z").map((book) => book.slug)).toEqual(["lake"]);
  });

  it("sorts the featured queue by order, then title", () => {
    expect(filterQueue(books, "featured", "").map((book) => book.slug)).toEqual(["sea", "pond"]);
  });
});

describe("countQueue", () => {
  it("counts five-star books with no note", () => {
    expect(countQueue(books, "five-star-no-note")).toBe(2);
  });
});

describe("defaultQueueId", () => {
  it("prefers currently reading when that shelf has a book", () => {
    expect(defaultQueueId(books)).toBe("currently-reading");
  });

  it("falls back to five-star books with no note", () => {
    expect(defaultQueueId([{ status: "read" }])).toBe("five-star-no-note");
  });
});

describe("featuredBooks", () => {
  it("returns featured books in order", () => {
    expect(featuredBooks(books).map((book) => book.slug)).toEqual(["sea", "pond"]);
  });
});
