import { describe, expect, it } from "vitest";
import { groupSeries, seriesFromTitle } from "./series";

describe("seriesFromTitle", () => {
  it("resolves a known alias even without a parenthetical", () => {
    expect(seriesFromTitle("Fourth Wing")).toEqual({ name: "The Empyrean", number: 1 });
    expect(seriesFromTitle("A Court of Mist and Fury")).toEqual({
      name: "A Court of Thorns and Roses",
      number: 2,
    });
  });

  it("parses a numbered series from a parenthetical suffix", () => {
    expect(seriesFromTitle("Crown of Midnight (Throne of Glass, #2)")).toEqual({
      name: "Throne of Glass",
      number: 2,
    });
  });

  it("parses a fractional book number", () => {
    expect(seriesFromTitle("Threshing Day (The Empyrean, #3.5)")).toEqual({
      name: "The Empyrean",
      number: 3.5,
    });
  });

  it("treats a parenthetical with no # as an unnumbered series entry", () => {
    expect(seriesFromTitle("Some Book (A Collection)")).toEqual({
      name: "A Collection",
      number: 0,
    });
  });

  it("returns null when there is no series information at all", () => {
    expect(seriesFromTitle("A Standalone Novel")).toBeNull();
  });
});

describe("groupSeries", () => {
  const book = (title: string) => ({ data: { title } });

  it("only returns series meeting the minimum book count", () => {
    const books = [
      book("Fourth Wing"),
      book("Iron Flame"),
      book("A Standalone Novel"),
      book("Another Standalone"),
    ];
    expect(groupSeries(books, 3)).toEqual([]);
  });

  it("groups and sorts series books by series number", () => {
    const books = [book("Onyx Storm"), book("Fourth Wing"), book("Iron Flame")];
    const groups = groupSeries(books, 2);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("The Empyrean");
    expect(groups[0].books.map((b) => b.data.title)).toEqual([
      "Fourth Wing",
      "Iron Flame",
      "Onyx Storm",
    ]);
  });

  it("orders multiple series by book count, largest first", () => {
    const books = [
      book("Crown of Midnight (Throne of Glass, #2)"),
      book("Empire of Storms (Throne of Glass, #5)"),
      book("Heir of Fire (Throne of Glass, #3)"),
      book("Fourth Wing"),
      book("Iron Flame"),
    ];
    const groups = groupSeries(books, 2);
    expect(groups.map((g) => g.name)).toEqual(["Throne of Glass", "The Empyrean"]);
  });
});
