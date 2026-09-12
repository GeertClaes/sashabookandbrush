export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function parseImageUpload(body, slug) {
  const contentBase64 = String(body.contentBase64 || "").replace(/\s/g, "");
  if (!contentBase64) return { ok: true, photo: null };

  const ext =
    String(body.filename || "")
      .toLowerCase()
      .match(/\.[a-z0-9]+$/)?.[0] || "";
  if (!ALLOWED_IMAGE_EXT.has(ext)) {
    return { ok: false, error: "Use a JPG, PNG, or WebP photo" };
  }

  const bytes = Math.floor((contentBase64.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image is too large (2 MB max)" };
  }

  const filename = `${slug}${ext}`;
  return {
    ok: true,
    photo: {
      filename,
      contentBase64,
      publicPath: filename,
      artRepoPath: `src/assets/art/${filename}`,
      bookRepoPath: `src/assets/covers/${filename}`,
    },
  };
}
