import { describe, expect, it } from "vitest";
import { planFeaturedBoard, planReorder } from "./board-save.js";

const book = (title, order = 9) => `---
title: "${title}"
featured: false
order: ${order}
---
`;

describe("planFeaturedBoard", () => {
  it("numbers the featured rows and leaves the others alone", () => {
    const plan = planFeaturedBoard(
      [
        { slug: "one", featured: true },
        { slug: "two", featured: false },
        { slug: "three", featured: true },
      ],
      {
        one: book("One", 9),
        two: book("Two", 4),
        three: book("Three", 8),
      },
    );
    expect(plan.result.featured).toBe(2);
    expect(plan.activity.title).toBe("Updated featured board (2 on Home)");
    expect(plan.files[0].content).toContain("featured: true");
    expect(plan.files[0].content).toContain("order: 1");
    expect(plan.files[1].content).toContain("featured: false");
    expect(plan.files[1].content).toContain("order: 4");
    expect(plan.files[2].content).toContain("order: 2");
  });

  it("rejects an empty list, a list over 20, an unknown book, and a bad name", () => {
    expect(planFeaturedBoard([], {}).error).toBe("Send between 1 and 20 books");
    expect(
      planFeaturedBoard(
        Array.from({ length: 21 }, (_, i) => ({ slug: `b${i}` })),
        {},
      ).status,
    ).toBe(400);
    expect(planFeaturedBoard([{ slug: "missing", featured: true }], {}).error).toBe(
      "Unknown book: missing",
    );
    expect(planFeaturedBoard([{ slug: "!!!" }], { "!!!": book("No") }).error).toBe("Invalid name");
  });
});

describe("planReorder", () => {
  it("writes order from 1 for a known list", () => {
    const plan = planReorder({
      kind: "art",
      slugs: ["garden-bridge", "mirror"],
      filesBySlug: {
        "garden-bridge": '---\ntitle: "Garden"\norder: 5\n---\n',
        mirror: '---\ntitle: "Mirror"\norder: 2\n---\n',
      },
    });
    expect(plan.files.map((file) => file.path)).toEqual([
      "src/content/art/garden-bridge.md",
      "src/content/art/mirror.md",
    ]);
    expect(plan.files[0].content).toContain("order: 1");
    expect(plan.files[1].content).toContain("order: 2");
    expect(plan.activity.title).toBe("Reordered paintings");
    expect(plan.result.count).toBe(2);
  });

  it("rejects an empty list, a list over 40, an unknown item, and an unknown kind", () => {
    expect(planReorder({ kind: "art", slugs: [], filesBySlug: {} }).error).toBe(
      "Send between 1 and 40 items",
    );
    expect(
      planReorder({ kind: "supply", slugs: Array.from({ length: 41 }, (_, i) => `t${i}`) }).status,
    ).toBe(400);
    expect(planReorder({ kind: "art", slugs: ["missing"], filesBySlug: {} }).error).toBe(
      "Unknown item: missing",
    );
    expect(
      planReorder({ kind: "book", slugs: ["one"], filesBySlug: { one: "---\n---\n" } }).error,
    ).toBe("Unknown list");
  });
});
