import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, parseImageUpload } from "./photo.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");

describe("parseImageUpload", () => {
  it("returns the art, book, or supply repo path for that kind", () => {
    const body = { filename: "photo.jpg", contentBase64: JPEG };
    expect(parseImageUpload(body, "garden-bridge", "art").photo.repoPath).toBe(
      "src/assets/art/garden-bridge.jpg",
    );
    expect(parseImageUpload(body, "acotar", "book").photo.repoPath).toBe(
      "src/assets/covers/acotar.jpg",
    );
    expect(parseImageUpload(body, "liquitex-basics", "supply").photo.repoPath).toBe(
      "src/assets/supplies/liquitex-basics.jpg",
    );
  });

  it("keeps the stored public name as the filename", () => {
    const parsed = parseImageUpload(
      { filename: "photo.jpg", contentBase64: JPEG },
      "garden-bridge",
      "art",
    );
    expect(parsed.photo.publicPath).toBe("garden-bridge.jpg");
    expect(parsed.photo.filename).toBe("garden-bridge.jpg");
  });

  it("rejects a file type the editor does not accept", () => {
    const parsed = parseImageUpload({ filename: "photo.gif", contentBase64: JPEG }, "x", "art");
    expect(parsed).toEqual({ ok: false, error: "Use a JPG, PNG, or WebP photo" });
  });

  it("rejects a payload over 2 MB", () => {
    const contentBase64 = "A".repeat(Math.ceil(((MAX_IMAGE_BYTES + 1) * 4) / 3));
    const parsed = parseImageUpload({ filename: "photo.jpg", contentBase64 }, "x", "book");
    expect(parsed).toEqual({ ok: false, error: "Image is too large (2 MB max)" });
  });

  it("returns no photo when the body has no image", () => {
    expect(parseImageUpload({ filename: "photo.jpg" }, "x", "art")).toEqual({
      ok: true,
      photo: null,
    });
  });

  it("does not invent a repo path for an about photo", () => {
    const parsed = parseImageUpload(
      { filename: "photo.png", contentBase64: JPEG },
      "about",
      "about",
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.photo.repoPath).toBeUndefined();
    expect(parsed.photo.filename).toBe("about.png");
  });
});
