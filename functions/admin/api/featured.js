import { applyYamlFields, fail, json, readJson, safeSlug } from "./_lib/frontmatter.js";
import { filesWithActivity } from "./_lib/activity.js";
import { commitFiles, tryGetTextFile } from "./_lib/github.js";

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const rows = Array.isArray(body.books) ? body.books : [];
    if (!rows.length || rows.length > 20) {
      return json({ error: "Send between 1 and 20 books" }, 400);
    }

    const prepared = [];
    for (const row of rows) {
      const slug = safeSlug(row.slug);
      const filePath = `src/content/books/${slug}.md`;
      const text = await tryGetTextFile(context.env, filePath);
      if (!text) return json({ error: `Unknown book: ${slug}` }, 400);
      prepared.push({ slug, filePath, text, featured: Boolean(row.featured) });
    }

    let featuredIndex = 0;
    const files = prepared.map((row) => {
      const updates = { featured: row.featured };
      if (row.featured) {
        featuredIndex += 1;
        updates.order = featuredIndex;
      }
      let text = applyYamlFields(row.text, updates);
      if (!text.endsWith("\n")) text += "\n";
      return { path: row.filePath, content: text, encoding: "utf-8" };
    });

    const featuredCount = prepared.filter((row) => row.featured).length;
    await commitFiles(
      context.env,
      "Admin: update featured board",
      await filesWithActivity(context.env, files, {
        type: "admin",
        title: `Updated featured board (${featuredCount} on Home)`,
        detail: "Home featured cards update after the site rebuilds (about a minute).",
        by: context.data.email || "",
      }),
    );
    return json({ ok: true, featured: featuredCount });
  } catch (error) {
    return fail(error, error instanceof Error && /invalid name/i.test(error.message) ? 400 : 500);
  }
}
