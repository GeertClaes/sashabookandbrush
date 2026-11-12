import { describe, expect, it } from "vitest";
import { ART_MAX_NOTE, artMarkdown, deriveArtFields } from "./art.js";

describe("deriveArtFields", () => {
  it("requires a non-blank title", () => {
    expect(deriveArtFields({ title: "" }).error).toBe("Title is required");
    expect(deriveArtFields({ title: "   " }).error).toBe("Title is required");
  });

  it("rejects a note over the length limit", () => {
    const { error } = deriveArtFields({
      title: "Garden bridge",
      note: "x".repeat(ART_MAX_NOTE + 1),
    });
    expect(error).toBe("That note is too long");
  });

  it("defaults the medium to Acrylic", () => {
    const { fields } = deriveArtFields({ title: "Garden bridge" });
    expect(fields.medium).toBe("Acrylic");
  });

  it("only derives shop/shopLabel when the piece is available", () => {
    const notAvailable = deriveArtFields({
      title: "Garden bridge",
      available: false,
      shop: "https://example.com/shop",
      shopLabel: "Etsy",
    });
    expect(notAvailable.fields.shop).toBe("");
    expect(notAvailable.fields.shopLabel).toBe("");

    const available = deriveArtFields({
      title: "Garden bridge",
      available: true,
      shop: "https://example.com/shop",
      shopLabel: "Etsy",
    });
    expect(available.fields.shop).toBe("https://example.com/shop");
    expect(available.fields.shopLabel).toBe("Etsy");
  });

  it("defaults order to 0 for a non-numeric value", () => {
    expect(deriveArtFields({ title: "Garden bridge" }).fields.order).toBe(0);
  });
});

describe("artMarkdown", () => {
  it("renders the required frontmatter fields", () => {
    const text = artMarkdown({
      title: "Garden bridge",
      medium: "Acrylic",
      note: "A quiet corner.",
      featured: true,
      order: 2,
      image: "garden-bridge.jpg",
      available: false,
      shop: "",
      shopLabel: "",
    });
    expect(text).toContain('title: "Garden bridge"');
    expect(text).toContain("featured: true");
    expect(text).toContain("order: 2");
    expect(text).toContain('image: "garden-bridge.jpg"');
    expect(text).not.toContain("shop:");
  });

  it("includes shop/shopLabel lines only when set", () => {
    const text = artMarkdown({
      title: "Archway",
      medium: "Oil",
      note: "",
      featured: false,
      order: 0,
      image: "",
      available: true,
      shop: "https://example.com/shop",
      shopLabel: "Etsy",
    });
    expect(text).toContain('shop: "https://example.com/shop"');
    expect(text).toContain('shopLabel: "Etsy"');
  });
});
