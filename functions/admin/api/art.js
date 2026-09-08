import { applyYamlFields, fail, json, readJson, safeSlug, slugFromTitle, yamlString } from "./_lib/frontmatter.js";
import { commitFiles, tryGetTextFile } from "./_lib/github.js";

const MAX_NOTE = 8000;

function artMarkdown({ title, medium, note, featured, order, image }) {
  const imageLine = image ? `image: ${yamlString(image)}\n` : "";
  return `---
title: ${yamlString(title)}
medium: ${yamlString(medium)}
note: ${yamlString(note)}
featured: ${featured}
order: ${order}
${imageLine}---
`;
}

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const title = String(body.title || "").trim();
    if (!title) return json({ error: "Title is required" }, 400);

    const slug = body.slug ? safeSlug(body.slug) : slugFromTitle(title);
    const filePath = `src/content/art/${slug}.md`;
    const existing = await tryGetTextFile(context.env, filePath);

    if (body.create && existing) {
      return json({ error: "A painting with that name already exists" }, 409);
    }
    if (!body.create && !existing) {
      return json({ error: "Painting not found" }, 404);
    }

    const note = typeof body.note === "string" ? body.note : "";
    if (note.length > MAX_NOTE) return json({ error: "That note is too long" }, 400);

    const medium = String(body.medium || "Acrylic").trim() || "Acrylic";
    const featured = Boolean(body.featured);
    const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0;
    const image = typeof body.image === "string" ? body.image.trim() : "";

    let text = existing;
    if (!text) {
      text = artMarkdown({ title, medium, note, featured, order, image });
    } else {
      const updates = { title, medium, note, featured, order };
      if (image) updates.image = image;
      text = applyYamlFields(text, updates);
    }
    if (!text.endsWith("\n")) text += "\n";

    await commitFiles(context.env, `Admin: ${existing ? "update" : "add"} art ${slug}`, [
      { path: filePath, content: text, encoding: "utf-8" },
    ]);
    return json({ ok: true, slug });
  } catch (error) {
    return fail(error, error instanceof Error && /invalid name/i.test(error.message) ? 400 : 500);
  }
}
