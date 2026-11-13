import { describe, expect, it } from "vitest";
import { artFlags, renderKindList, sortByOrderThenTitle, supplyFlags } from "./admin-lists.js";

describe("sortByOrderThenTitle", () => {
  it("sorts by order, then title", () => {
    const items = [
      { title: "B", order: 2 },
      { title: "C", order: 1 },
      { title: "A", order: 1 },
    ];
    expect(sortByOrderThenTitle(items).map((item) => item.title)).toEqual(["A", "C", "B"]);
  });

  it("treats a missing order as 0", () => {
    const items = [{ title: "Later", order: 1 }, { title: "First" }];
    expect(sortByOrderThenTitle(items).map((item) => item.title)).toEqual(["First", "Later"]);
  });
});

describe("artFlags", () => {
  it("lists no image for a painting with no photo", () => {
    expect(artFlags({ title: "Pond", note: "A note", featured: false, available: false })).toEqual([
      "No image",
    ]);
  });

  it("lists note, home, and sale flags along with a missing photo", () => {
    expect(artFlags({ image: "", note: "  ", featured: true, available: true })).toEqual([
      "No image",
      "No note",
      "Home",
      "For sale",
    ]);
  });
});

describe("supplyFlags", () => {
  it("lists a missing Amazon URL and a home flag", () => {
    expect(supplyFlags({ amazon: "", featured: true })).toEqual(["No Amazon URL", "Home"]);
  });
});

describe("renderKindList", () => {
  it("renders a painting with no photo, including the drag handle and link chip", () => {
    const el = { innerHTML: "" };
    renderKindList(
      el,
      [
        {
          slug: "pond",
          title: "Pond",
          medium: "Acrylic",
          note: "still",
          image: "",
          imageUrl: "",
          featured: false,
          available: false,
          order: 1,
        },
      ],
      { kind: "art", selectedSlug: "", creating: false, origin: "https://sashabookandbrush.com" },
    );
    expect(el.innerHTML).toBe(
      `<li class="flex items-center gap-2 rounded-lg border border-border px-2 py-2" draggable="false" data-art-slug="pond"><button type="button" class="cursor-grab touch-none px-1 text-muted-foreground" data-drag aria-label="Drag to reorder">⋮⋮</button><span class="w-4 text-xs text-muted-foreground">1</span><span class="h-12 w-12 shrink-0 rounded bg-muted"></span><button type="button" class="min-w-0 flex-1 text-left" data-art-open><span class="font-medium text-foreground">Pond</span><span class="mt-0.5 block text-xs text-muted-foreground">Acrylic</span><span class="mt-1 block text-xs text-accent">No image</span></button><button type="button" class="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:border-primary" data-copy-value="https://sashabookandbrush.com/art#pond" data-copy-label="Link">Link</button><div class="flex flex-col gap-1"><button type="button" class="rounded border border-border px-1.5 py-0.5 text-xs" data-art-up disabled>↑</button><button type="button" class="rounded border border-border px-1.5 py-0.5 text-xs" data-art-down disabled>↓</button></div></li>`,
    );
  });

  it("uses the muted flag colour when Home is the only painting flag", () => {
    const el = { innerHTML: "" };
    renderKindList(
      el,
      [
        {
          slug: "home",
          title: "Home",
          medium: "Oil",
          note: "n",
          image: "a.jpg",
          featured: true,
          order: 1,
        },
      ],
      { kind: "art", origin: "https://sashabookandbrush.com" },
    );
    expect(el.innerHTML).toContain('text-muted-foreground">Home</span>');
  });

  it("renders a tool row without a thumb and without a draggable attribute", () => {
    const el = { innerHTML: "" };
    renderKindList(
      el,
      [
        {
          slug: "brush",
          title: "Round brush",
          brand: "Princeton",
          category: "Brushes",
          amazon: "",
          featured: true,
          order: 1,
        },
      ],
      { kind: "supply", origin: "https://sashabookandbrush.com" },
    );
    expect(el.innerHTML).toBe(
      `<li class="flex items-center gap-2 rounded-lg border border-border px-2 py-2" data-supply-slug="brush"><button type="button" class="cursor-grab touch-none px-1 text-muted-foreground" data-drag aria-label="Drag to reorder">⋮⋮</button><span class="w-4 text-xs text-muted-foreground">1</span><button type="button" class="min-w-0 flex-1 text-left" data-supply-open><span class="font-medium text-foreground">Round brush</span><span class="mt-0.5 block text-xs text-muted-foreground">Princeton · Brushes</span><span class="mt-1 block text-xs text-accent">No Amazon URL · Home</span></button><button type="button" class="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:border-primary" data-copy-value="https://sashabookandbrush.com/art#brush" data-copy-label="Link">Link</button><div class="flex flex-col gap-1"><button type="button" class="rounded border border-border px-1.5 py-0.5 text-xs" data-supply-up disabled>↑</button><button type="button" class="rounded border border-border px-1.5 py-0.5 text-xs" data-supply-down disabled>↓</button></div></li>`,
    );
  });
});
