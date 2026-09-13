import { applyYamlFields, fail, json, readJson, safeSlug } from "./_lib/frontmatter.js";
import { filesWithActivity } from "./_lib/activity.js";
import { commitFiles, tryGetTextFile } from "./_lib/github.js";

const KINDS = {
  art: { dir: "src/content/art", label: "paintings" },
  supply: { dir: "src/content/supplies", label: "tools" },
};

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const kind = KINDS[body.kind];
    const slugs = Array.isArray(body.slugs) ? body.slugs : [];
    if (!kind) return json({ error: "Unknown list" }, 400);
    if (!slugs.length || slugs.length > 40) {
      return json({ error: "Send between 1 and 40 items" }, 400);
    }

    const prepared = [];
    for (const raw of slugs) {
      const slug = safeSlug(raw);
      const filePath = `${kind.dir}/${slug}.md`;
      const text = await tryGetTextFile(context.env, filePath);
      if (!text) return json({ error: `Unknown item: ${slug}` }, 400);
      prepared.push({ slug, filePath, text });
    }

    const files = prepared.map((row, index) => {
      let text = applyYamlFields(row.text, { order: index + 1 });
      if (!text.endsWith("\n")) text += "\n";
      return { path: row.filePath, content: text, encoding: "utf-8" };
    });

    await commitFiles(
      context.env,
      `Admin: reorder ${kind.label}`,
      await filesWithActivity(context.env, files, {
        type: "admin",
        title: `Reordered ${kind.label}`,
        detail: "The Art page order updates after the site rebuilds (about a minute).",
        by: context.data.email || "",
      }),
    );
    return json({ ok: true, count: prepared.length });
  } catch (error) {
    return fail(error, error instanceof Error && /invalid name/i.test(error.message) ? 400 : 500);
  }
}
