import { applyYamlFields, fail, json, readJson, safeSlug } from "./_lib/frontmatter.js";
import { filesWithActivity } from "./_lib/activity.js";
import { commitFiles, getTextFile } from "./_lib/github.js";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const kind = body.kind === "art" ? "art" : "book";
    const slug = safeSlug(body.slug);
    const ext = String(body.filename || ".jpg")
      .toLowerCase()
      .match(/\.[a-z0-9]+$/)?.[0] || ".jpg";
    const safeExt = ALLOWED.has(ext) ? ext : ".jpg";
    const filename = `${slug}${safeExt}`;
    const contentBase64 = String(body.contentBase64 || "").replace(/\s/g, "");
    if (!contentBase64) return json({ error: "Missing image" }, 400);

    const bytes = Math.floor((contentBase64.length * 3) / 4);
    if (bytes > MAX_BYTES) return json({ error: "Image is too large (2 MB max)" }, 400);

    if (kind === "art") {
      const filePath = `src/content/art/${slug}.md`;
      const publicPath = `/images/art/${filename}`;
      let text = await getTextFile(context.env, filePath);
      text = applyYamlFields(text, { image: publicPath });
      if (!text.endsWith("\n")) text += "\n";
      await commitFiles(
        context.env,
        `Admin: photo for ${slug}`,
        await filesWithActivity(
          context.env,
          [
            { path: `public/images/art/${filename}`, content: contentBase64, encoding: "base64" },
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
      return json({ ok: true, image: publicPath });
    }

    const filePath = `src/content/books/${slug}.md`;
    let text = await getTextFile(context.env, filePath);
    text = applyYamlFields(text, { cover: filename });
    if (!text.endsWith("\n")) text += "\n";
    await commitFiles(
      context.env,
      `Admin: cover for ${slug}`,
      await filesWithActivity(
        context.env,
        [
          { path: `src/assets/covers/${filename}`, content: contentBase64, encoding: "base64" },
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
    return json({ ok: true, cover: filename });
  } catch (error) {
    return fail(error, error instanceof Error && /not found|invalid name/i.test(error.message) ? 400 : 500);
  }
}
