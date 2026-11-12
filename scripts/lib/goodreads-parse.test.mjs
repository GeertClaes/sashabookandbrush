import { describe, expect, it } from "vitest";
import {
  booksFromProfile,
  booksFromWidget,
  decodeEntities,
  largerCover,
  percentIn,
  shelfCount,
  stripTags,
  widgetHtml,
} from "./goodreads-parse.mjs";

describe("decodeEntities", () => {
  it("decodes common named and numeric entities and collapses whitespace", () => {
    expect(decodeEntities("Tom &amp; Jerry&nbsp;&mdash;")).toBe("Tom & Jerry &mdash;");
    expect(decodeEntities("It&#39;s &quot;great&quot;")).toBe(`It's "great"`);
    expect(decodeEntities("  a   b  \n c ")).toBe("a b c");
  });
});

describe("stripTags", () => {
  it("removes HTML tags and decodes entities in the remaining text", () => {
    expect(stripTags("<b>Rebecca &amp; Yarros</b>")).toBe("Rebecca & Yarros");
  });
});

describe("largerCover", () => {
  it("strips Goodreads' thumbnail size suffix, including its trailing underscore", () => {
    expect(largerCover("https://images.gr-assets.com/books/123._SX98_.jpg")).toBe(
      "https://images.gr-assets.com/books/123.jpg",
    );
  });

  it("also handles a suffix with no trailing underscore", () => {
    expect(largerCover("https://images.gr-assets.com/books/123._SX98.jpg")).toBe(
      "https://images.gr-assets.com/books/123.jpg",
    );
  });

  it("leaves a URL without a size suffix untouched", () => {
    expect(largerCover("https://images.gr-assets.com/books/123.jpg")).toBe(
      "https://images.gr-assets.com/books/123.jpg",
    );
  });
});

describe("shelfCount", () => {
  it("reads the shelf count out of a shelf link", () => {
    const html = `<a href="/review/list?shelf=currently-reading">Currently reading (4)</a>`;
    expect(shelfCount(html, "currently-reading")).toBe(4);
  });

  it("returns null when the shelf link is missing", () => {
    expect(shelfCount("<p>no shelves here</p>", "currently-reading")).toBeNull();
  });
});

describe("percentIn", () => {
  it("reads a labeled percentage", () => {
    expect(percentIn('<span class="rightContainer">(50%)</span>')).toBe(50);
  });

  it("reads a percentage from a graphBar width style", () => {
    expect(percentIn('<div class="graphBar" style="width: 73%;"></div>')).toBe(73);
  });

  it("clamps out-of-range values and returns undefined when absent", () => {
    expect(percentIn("(150%)")).toBe(100);
    expect(percentIn("no percent here")).toBeUndefined();
  });
});

describe("widgetHtml", () => {
  it("unescapes the JS string literal embedded in the widget script", () => {
    const source = `var widget_code = '<div>Line1\\nLine2 \\u0026amp;</div>';`;
    expect(widgetHtml(source)).toBe("<div>Line1\nLine2 &amp;</div>");
  });

  it("returns null when the marker is not present", () => {
    expect(widgetHtml("no widget here")).toBeNull();
  });
});

describe("booksFromProfile", () => {
  const currentlyReadingHtml = `
    <html><body>
    <a href="/review/list?shelf=currently-reading">Currently reading (1)</a>
    <div id="currentlyReadingReviews">
      <div class="Updates foo">
        <a class="bookTitle" href="https://www.goodreads.com/book/show/61431922-fourth-wing">Fourth Wing</a>
        <a class="authorName">Rebecca Yarros</a>
        <img src="https://images.gr-assets.com/books/61431922._SY475_.jpg">
        <span>(50%)</span>
      </div>
    </div>
    <div class="bigBoxBottom"></div>
    </body></html>
  `;

  it("parses the currently-reading shelf into books with progress", () => {
    const { books, count } = booksFromProfile(currentlyReadingHtml);
    expect(count).toBe(1);
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      title: "Fourth Wing",
      author: "Rebecca Yarros",
      goodreadsId: "61431922",
      progress: 50,
    });
    expect(books[0].image).toBe("https://images.gr-assets.com/books/61431922.jpg");
  });

  it("returns an empty shelf without error when the count is zero", () => {
    const html = `<a href="/review/list?shelf=currently-reading">Currently reading (0)</a>`;
    expect(booksFromProfile(html)).toEqual({ books: [], count: 0 });
  });

  it("throws when Goodreads redirects to a sign-in page", () => {
    expect(() => booksFromProfile("<title>Sign in to Goodreads</title>")).toThrow(/sign-in/);
  });

  it("throws when the shelf block is missing but the shelf isn't empty", () => {
    const html = `<a href="/review/list?shelf=currently-reading">Currently reading (2)</a>`;
    expect(() => booksFromProfile(html)).toThrow(/did not include/);
  });
});

describe("booksFromWidget", () => {
  it("parses books out of the to-read grid widget markup", () => {
    const widgetMarkup =
      '<a title="Iron Flame" href="https://www.goodreads.com/review/show/123456789">' +
      '<img src="https://images.gr-assets.com/books/987._SY475_.jpg" alt="Iron Flame"></a>';
    const source = `var widget_code = '${widgetMarkup.replace(/'/g, "\\'")}';`;
    const books = booksFromWidget(source);
    expect(books).toEqual([
      {
        title: "Iron Flame",
        author: "",
        goodreadsId: "987",
        isbn: "",
        image: "https://images.gr-assets.com/books/987.jpg",
      },
    ]);
  });

  it("throws when the widget script has no book list at all", () => {
    expect(() => booksFromWidget("var something_else = '';")).toThrow(/did not return/);
  });

  it("returns an empty array when the widget list is empty", () => {
    expect(booksFromWidget("var widget_code = '';")).toEqual([]);
  });
});
