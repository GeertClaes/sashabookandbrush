export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const MANAGED_ABOUT = /^\/images\/(about-[a-f0-9]{8}\.(?:jpg|png|webp))$/i;

export function shortHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function aboutImageFile(photo) {
  let ext = String(photo?.filename || "").toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || ".jpg";
  if (ext === ".jpeg") ext = ".jpg";
  if (!ALLOWED_IMAGE_EXT.has(ext)) ext = ".jpg";
  const name = `about-${shortHash(photo?.contentBase64)}${ext}`;
  return {
    filename: name,
    publicPath: `/images/${name}`,
    repoPath: `public/images/${name}`,
  };
}

export function managedAboutImagePaths(...publicPaths) {
  const paths = [];
  for (const value of publicPaths) {
    const match = String(value || "").match(MANAGED_ABOUT);
    if (!match) continue;
    const repoPath = `public/images/${match[1].toLowerCase()}`;
    if (!paths.includes(repoPath)) paths.push(repoPath);
  }
  return paths;
}

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
      supplyRepoPath: `src/assets/supplies/${filename}`,
    },
  };
}
