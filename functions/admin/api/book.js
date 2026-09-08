import { fail, json, readJson, safeSlug, upsertField, yamlString } from "./_lib/frontmatter.js";
import { commitFiles, getTextFile } from "./_lib/github.js";

const MAX_NOTE = 8000;

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const slug = safeSlug(body.slug);
    const filePath = `src/content/books/${slug}.md`;
    let text = await getTextFile(context.env, filePath);

    if (typeof body.note === "string") {
      if (body.note.length > MAX_NOTE) {
        return json({ error: "That note is too long" }, 400);
      }
      text = upsertField(text, "note", `note: ${yamlString(body.note)}`);
    }
    if (typeof body.featured === "boolean") {
      text = upsertField(text, "featured", `featured: ${body.featured}`);
    }
    if (!text.endsWith("\n")) text += "\n";

    await commitFiles(context.env, `Admin: update ${slug}`, [
      { path: filePath, content: text, encoding: "utf-8" },
    ]);
    return json({ ok: true });
  } catch (error) {
    return fail(error, error instanceof Error && /not found|invalid book/i.test(error.message) ? 400 : 500);
  }
}
