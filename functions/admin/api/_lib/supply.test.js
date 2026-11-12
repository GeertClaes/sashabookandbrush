import { describe, expect, it } from "vitest";
import { SUPPLY_MAX_NOTE, deriveSupplyFields, supplyMarkdown } from "./supply.js";

describe("deriveSupplyFields", () => {
  it("requires a non-blank title", () => {
    expect(deriveSupplyFields({ title: "" }).error).toBe("Title is required");
  });

  it("rejects a note over the length limit", () => {
    const { error } = deriveSupplyFields({
      title: "Liquitex Basics",
      note: "x".repeat(SUPPLY_MAX_NOTE + 1),
    });
    expect(error).toBe("That note is too long");
  });

  it("tags a recognisable Amazon link", () => {
    const { fields } = deriveSupplyFields({
      title: "Liquitex Basics",
      amazon: "https://www.amazon.co.uk/dp/B09HTQXQ58",
    });
    expect(fields.amazon).toBe(
      "https://www.amazon.co.uk/dp/B09HTQXQ58/ref=nosim?tag=sashabookandb-21",
    );
  });

  it("rejects text that doesn't look like an Amazon link", () => {
    const { error } = deriveSupplyFields({ title: "Liquitex Basics", amazon: "not a link" });
    expect(error).toMatch(/doesn't look like an Amazon product link/);
  });

  it("defaults category to Studio", () => {
    const { fields } = deriveSupplyFields({ title: "Liquitex Basics" });
    expect(fields.category).toBe("Studio");
  });
});

describe("supplyMarkdown", () => {
  it("renders the required frontmatter fields", () => {
    const text = supplyMarkdown({
      title: "Liquitex Basics",
      brand: "Liquitex",
      category: "Paint",
      note: "",
      amazon: "",
      shop: "",
      shopLabel: "",
      featured: true,
      order: 1,
      image: "",
    });
    expect(text).toContain('title: "Liquitex Basics"');
    expect(text).toContain('brand: "Liquitex"');
    expect(text).toContain("featured: true");
    expect(text).not.toContain("amazon:");
  });

  it("defaults the shop label to 'Shop' when a shop URL is set without one", () => {
    const text = supplyMarkdown({
      title: "Sketchbook",
      brand: "Seawhite",
      category: "Paper",
      note: "",
      amazon: "",
      shop: "https://example.com/shop",
      shopLabel: "",
      featured: false,
      order: 0,
      image: "",
    });
    expect(text).toContain('shopLabel: "Shop"');
  });
});
