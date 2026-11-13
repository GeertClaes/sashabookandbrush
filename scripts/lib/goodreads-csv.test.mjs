import { describe, expect, it } from "vitest";
import { bookFromRow, cleanIsbn, genreFromShelves, parseCsv, pickNote } from "./goodreads-csv.mjs";

describe("parseCsv", () => {
  it("drops a BOM and keeps a comma inside quotes", () => {
    expect(parseCsv('\uFEFFTitle,Author\n"A, B",Ada\n')).toEqual([
      ["Title", "Author"],
      ["A, B", "Ada"],
    ]);
  });
});

describe("cleanIsbn", () => {
  it("keeps digits and X and drops everything else", () => {
    expect(cleanIsbn("978-0-123456-78-9")).toBe("9780123456789");
    expect(cleanIsbn("isbn: 012345678X")).toBe("012345678X");
    expect(cleanIsbn("")).toBe("");
    expect(cleanIsbn(null)).toBe("");
  });
});

describe("genreFromShelves", () => {
  it("skips Goodreads status shelves and title-cases the first real shelf", () => {
    expect(genreFromShelves("to-read, currently-reading, fantasy")).toBe("Fantasy");
    expect(genreFromShelves("epic-fantasy")).toBe("Epic-Fantasy");
  });

  it("returns Read when every shelf is a status shelf", () => {
    expect(genreFromShelves("read, favorites, owned")).toBe("Read");
    expect(genreFromShelves("")).toBe("Read");
  });
});

describe("pickNote", () => {
  it("keeps the site note when it is as long as the Goodreads note", () => {
    expect(pickNote("  ", "from goodreads")).toBe("from goodreads");
    expect(pickNote("kept on the site", "")).toBe("kept on the site");
    expect(pickNote("same", "same")).toBe("same");
    expect(pickNote("longer site", "short")).toBe("longer site");
  });

  it("takes the Goodreads note when it is longer", () => {
    expect(pickNote("short", "a longer goodreads note")).toBe("a longer goodreads note");
  });
});

describe("bookFromRow", () => {
  it("calls a currently-reading row with no other shelf Currently reading", () => {
    const header = [
      "Title",
      "Author",
      "My Review",
      "My Rating",
      "Bookshelves",
      "ISBN13",
      "ISBN",
      "Book Id",
      "Date Read",
      "Date Added",
      "Number of Pages",
      "Year Published",
      "Original Publication Year",
      "Publisher",
      "Read Count",
    ];
    const values = [
      "Pond",
      "Ada",
      "<p>Hello<br>there</p>",
      "0",
      "currently-reading",
      '="9781402894626"',
      "",
      "42",
      "",
      "2024/1/2",
      "",
      "1999",
      "",
      "  ",
      "",
    ];
    const index = Object.fromEntries(header.map((name, i) => [name, i]));
    const book = bookFromRow(values, (row, name) => row[index[name]] ?? "", {
      status: "currently-reading",
      slug: "pond-ada",
    });
    expect(book.genre).toBe("Currently reading");
    expect(book.isbn).toBe("9781402894626");
    expect(book.note).toBe("Hello\nthere");
    expect(book.dateAdded).toBe("2024-01-02");
    expect(book.yearPublished).toBe(1999);
    expect(book.slug).toBe("pond-ada");
  });
});
