import { applyYamlFields, fail, json, readJson, safeSlug } from "./_lib/frontmatter.js";
import { filesWithActivity } from "./_lib/activity.js";
import { parseImageUpload } from "./_lib/photo.js";
import { commitFiles, getTextFile } from "./_lib/github.js";

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const kind = body.kind === "art" ? "art" : "book";
    const slug = safeSlug(body.slug);
    const parsed = parseImageUpload(body, slug);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    if (!parsed.photo) return json({ error: "Missing image" }, 400);
    const photo = parsed.photo;

    if (kind === "art") {
      const filePath = `src/content/art/${slug}.md`;
      let text = await getTextFile(context.env, filePath);
      text = applyYamlFields(text, { image: photo.publicPath });
      if (!text.endsWith("\n")) text += "\n";
      await commitFiles(
        context.env,
        `Admin: photo for ${slug}`,
        await filesWithActivity(
          context.env,
          [
            { path: photo.artRepoPath, content: photo.contentBase64, encoding: "base64" },
            { path: filePath, content: text, encoding: "utf-8" },
          ],
          {
            type: "admin",
            title: `Photo for ${slug}`,
            detail: "Image saved. It shows on the site after the rebuild (about a minute).",
            by: context.data.email || "",
          },
        ),
      );
      return json({ ok: true, image: photo.publicPath });
    }

    const filePath = `src/content/books/${slug}.md`;
    let text = await getTextFile(context.env, filePath);
    text = applyYamlFields(text, { cover: photo.filename });
    if (!text.endsWith("\n")) text += "\n";
    await commitFiles(
      context.env,
      `Admin: cover for ${slug}`,
      await filesWithActivity(
        context.env,
        [
          { path: photo.bookRepoPath, content: photo.contentBase64, encoding: "base64" },
          { path: filePath, content: text, encoding: "utf-8" },
        ],
        {
          type: "admin",
          title: `Cover for ${slug}`,
          detail: "Cover saved. It shows on the site after the rebuild (about a minute).",
          by: context.data.email || "",
        },
      ),
    );
    return json({ ok: true, cover: photo.filename });
  } catch (error) {
    return fail(error, error instanceof Error && /not found|invalid name/i.test(error.message) ? 400 : 500);
  }
}
