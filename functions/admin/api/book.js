import { applyYamlFields, fail, json, readJson, safeSlug } from "./_lib/frontmatter.js";
import { commitFiles, getTextFile } from "./_lib/github.js";

const MAX_NOTE = 8000;

function affiliateValue(value) {
  const trimmed = String(value || "").trim();
  return trimmed;
}

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const slug = safeSlug(body.slug);
    const filePath = `src/content/books/${slug}.md`;
    let text = await getTextFile(context.env, filePath);

    if (typeof body.note === "string" && body.note.length > MAX_NOTE) {
      return json({ error: "That note is too long" }, 400);
    }

    const updates = {};
    if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
    if (typeof body.author === "string" && body.author.trim()) updates.author = body.author.trim();
    if (typeof body.genre === "string") updates.genre = body.genre.trim() || "Read";
    if (typeof body.note === "string") updates.note = body.note;
    if (typeof body.featured === "boolean") updates.featured = body.featured;
    if (typeof body.bookshop === "string") updates.bookshop = affiliateValue(body.bookshop);
    if (typeof body.amazon === "string") updates.amazon = affiliateValue(body.amazon);

    text = applyYamlFields(text, updates);
    if (!text.endsWith("\n")) text += "\n";

    await commitFiles(context.env, `Admin: update book ${slug}`, [
      { path: filePath, content: text, encoding: "utf-8" },
    ]);
    return json({ ok: true });
  } catch (error) {
    return fail(error, error instanceof Error && /not found|invalid name/i.test(error.message) ? 400 : 500);
  }
}
