import { fail, json, readJson, safeSlug, upsertField, yamlString } from "./_lib/frontmatter.js";
import { commitFiles, getTextFile } from "./_lib/github.js";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const slug = safeSlug(body.slug);
    const ext = String(body.filename || ".jpg")
      .toLowerCase()
      .match(/\.[a-z0-9]+$/)?.[0] || ".jpg";
    const safeExt = ALLOWED.has(ext) ? ext : ".jpg";
    const filename = `${slug}${safeExt}`;
    const contentBase64 = String(body.contentBase64 || "").replace(/\s/g, "");
    if (!contentBase64) return json({ error: "Missing image" }, 400);

    const bytes = Math.floor((contentBase64.length * 3) / 4);
    if (bytes > MAX_BYTES) return json({ error: "Cover is too large (2 MB max)" }, 400);

    const filePath = `src/content/books/${slug}.md`;
    let text = await getTextFile(context.env, filePath);
    text = upsertField(text, "cover", `cover: ${yamlString(filename)}`);
    if (!text.endsWith("\n")) text += "\n";

    await commitFiles(context.env, `Admin: cover for ${slug}`, [
      { path: `src/assets/covers/${filename}`, content: contentBase64, encoding: "base64" },
      { path: filePath, content: text, encoding: "utf-8" },
    ]);
    return json({ ok: true, cover: filename });
  } catch (error) {
    return fail(error, error instanceof Error && /not found|invalid book/i.test(error.message) ? 400 : 500);
  }
}
