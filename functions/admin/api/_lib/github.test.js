import { describe, expect, it } from "vitest";
import { blobPayload, treeItem } from "./github.js";

describe("treeItem", () => {
  it("marks a delete with a null sha", () => {
    expect(treeItem({ path: "src/content/art/old.md", delete: true })).toEqual({
      path: "src/content/art/old.md",
      mode: "100644",
      type: "blob",
      sha: null,
    });
  });

  it("points a utf-8 file at its blob", () => {
    const file = { path: "src/content/art/garden.md", content: "---\n---\n" };
    expect(blobPayload(file)).toEqual({ content: "---\n---\n", encoding: "utf-8" });
    expect(treeItem(file, "abc123")).toEqual({
      path: "src/content/art/garden.md",
      mode: "100644",
      type: "blob",
      sha: "abc123",
    });
  });

  it("keeps a base64 payload marked as base64", () => {
    const file = {
      path: "src/assets/art/garden.jpg",
      content: "aGVsbG8=",
      encoding: "base64",
    };
    expect(blobPayload(file)).toEqual({ content: "aGVsbG8=", encoding: "base64" });
    expect(treeItem(file, "def456").sha).toBe("def456");
  });
});
