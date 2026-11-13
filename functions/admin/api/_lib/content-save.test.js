import { describe, expect, it } from "vitest";
import { contentCommitMessage, contentSaveDetail, planContentSave } from "./content-save.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");

const existingArt = `---
title: "Old bridge"
medium: "Acrylic"
note: "Keep me"
featured: false
order: 1
available: false
image: "garden-bridge.jpg"
---
`;

describe("planContentSave", () => {
  it("requires a title", () => {
    expect(planContentSave({ kind: "art", body: { title: "  " }, existingText: null })).toEqual({
      error: "Title is required",
      status: 400,
    });
  });

  it("rejects a create when that file already exists", () => {
    const plan = planContentSave({
      kind: "art",
      body: { title: "Garden bridge", slug: "garden-bridge", create: true },
      existingText: existingArt,
    });
    expect(plan).toEqual({ error: "A painting with that name already exists", status: 409 });
  });

  it("rejects an update when the file is missing", () => {
    const plan = planContentSave({
      kind: "supply",
      body: { title: "Liquitex", slug: "liquitex-basics" },
      existingText: null,
    });
    expect(plan).toEqual({ error: "Tool not found", status: 404 });
  });

  it("rejects a slug that is not a name", () => {
    expect(
      planContentSave({
        kind: "art",
        body: { title: "Garden bridge", slug: "!!!" },
        existingText: null,
      }).status,
    ).toBe(400);
    expect(
      planContentSave({ kind: "art", body: { delete: true, slug: "" }, existingText: existingArt }),
    ).toEqual({ error: "Invalid name", status: 400 });
    expect(
      planContentSave({ kind: "supply", body: { title: "!!!" }, existingText: null }).error,
    ).toBe("Invalid name");
  });

  it("creates markdown and a photo file", () => {
    const plan = planContentSave({
      kind: "art",
      body: {
        title: "Garden bridge",
        create: true,
        filename: "photo.jpg",
        contentBase64: JPEG,
      },
      existingText: null,
    });
    expect(plan.action).toBe("add");
    expect(plan.activity.title).toBe("Added Garden bridge");
    expect(plan.files).toHaveLength(2);
    expect(plan.files[0].path).toBe("src/content/art/garden-bridge.md");
    expect(plan.files[0].content).toContain('title: "Garden bridge"');
    expect(plan.files[0].content).toContain('image: "garden-bridge.jpg"');
    expect(plan.files[0].content.endsWith("\n")).toBe(true);
    expect(plan.files[1]).toMatchObject({
      path: "src/assets/art/garden-bridge.jpg",
      encoding: "base64",
      content: JPEG,
    });
    expect(contentCommitMessage(plan)).toBe("Admin: add art garden-bridge");
    expect(contentSaveDetail(plan)).toMatch(/Painting and photo saved/);
  });

  it("updates fields and does not write a photo when none was uploaded", () => {
    const plan = planContentSave({
      kind: "art",
      body: { title: "Garden bridge", slug: "garden-bridge", note: "New note" },
      existingText: existingArt,
    });
    expect(plan.action).toBe("update");
    expect(plan.files).toHaveLength(1);
    expect(plan.files[0].encoding).toBe("utf-8");
    expect(plan.files[0].content).toContain('title: "Garden bridge"');
    expect(plan.files[0].content).toContain('note: "New note"');
    expect(plan.files[0].content).toContain('image: "garden-bridge.jpg"');
    expect(contentSaveDetail(plan)).toBe(
      "Painting saved. It shows on the site after the rebuild (about a minute).",
    );
    expect(contentSaveDetail(plan, { local: true })).toBe(
      "Saved on this computer. Refresh the site to see it.",
    );
  });

  it("deletes the markdown and the managed photo", () => {
    const plan = planContentSave({
      kind: "supply",
      body: { delete: true, slug: "liquitex-basics" },
      existingText: '---\ntitle: "Liquitex"\nimage: "liquitex-basics.png"\n---\n',
    });
    expect(plan.activity.title).toBe("Deleted tool liquitex-basics");
    expect(plan.files).toEqual([
      { path: "src/content/supplies/liquitex-basics.md", delete: true },
      { path: "src/assets/supplies/liquitex-basics.png", delete: true },
    ]);
    expect(contentCommitMessage(plan)).toBe("Admin: delete supply liquitex-basics");
    expect(contentSaveDetail(plan)).toMatch(/Art page/);
  });

  it("tags an Amazon link while planning a tool", () => {
    const plan = planContentSave({
      kind: "supply",
      body: {
        title: "Liquitex Basics",
        create: true,
        amazon: "https://www.amazon.co.uk/dp/B09HTQXQ58",
      },
      existingText: null,
    });
    expect(plan.result.amazon).toBe(
      "https://www.amazon.co.uk/dp/B09HTQXQ58/ref=nosim?tag=sashabookandb-21",
    );
    expect(plan.files[0].content).toContain("tag=sashabookandb-21");
  });
});
