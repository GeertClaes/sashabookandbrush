import {
  applyYamlFields,
  fail,
  json,
  readJson,
  safeSlug,
  slugFromTitle,
} from "./_lib/frontmatter.js";
import { artMarkdown, deriveArtFields } from "./_lib/art.js";
import { filesWithActivity } from "./_lib/activity.js";
import { parseImageUpload } from "./_lib/photo.js";
import { commitFiles, fileExists, tryGetTextFile } from "./_lib/github.js";

function yamlField(text, key) {
  const match = String(text || "").match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return "";
  let value = match[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return value;
}

function artPhotoRepoPath(image) {
  const value = String(image || "").trim();
  const match = value.match(/^(?:\/images\/art\/)?([a-z0-9._-]+)$/i);
  return match ? `src/assets/art/${match[1]}` : "";
}

async function deletePainting(env, slug, email = "") {
  const filePath = `src/content/art/${slug}.md`;
  const existing = await tryGetTextFile(env, filePath);
  if (!existing) return json({ error: "Painting not found" }, 404);

  const files = [{ path: filePath, delete: true }];
  const photo = artPhotoRepoPath(yamlField(existing, "image"));
  if (photo && (await fileExists(env, photo))) {
    files.push({ path: photo, delete: true });
  }

  await commitFiles(
    env,
    `Admin: delete art ${slug}`,
    await filesWithActivity(env, files, {
      type: "admin",
      title: `Deleted painting ${slug}`,
      detail: "It leaves the Art page after the site rebuilds (about a minute).",
      by: email,
    }),
  );
  return json({ ok: true, slug, deleted: true });
}

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    if (body.delete) {
      const slug = safeSlug(body.slug);
      return await deletePainting(context.env, slug, context.data.email || "");
    }

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

    const { error, fields } = deriveArtFields(body);
    if (error) return json({ error }, 400);
    const { note, medium, featured, available, shop, shopLabel, order } = fields;

    const parsed = parseImageUpload(body, slug);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const photo = parsed.photo;
    const image = photo?.publicPath || (typeof body.image === "string" ? body.image.trim() : "");

    let text = existing;
    if (!text) {
      text = artMarkdown({
        title,
        medium,
        note,
        featured,
        order,
        image,
        available,
        shop,
        shopLabel,
      });
    } else {
      const updates = { title, medium, note, featured, order, available, shop, shopLabel };
      if (image) updates.image = image;
      text = applyYamlFields(text, updates);
    }
    if (!text.endsWith("\n")) text += "\n";

    const files = [{ path: filePath, content: text, encoding: "utf-8" }];
    if (photo) {
      files.push({ path: photo.artRepoPath, content: photo.contentBase64, encoding: "base64" });
    }

    await commitFiles(
      context.env,
      `Admin: ${existing ? "update" : "add"} art ${slug}`,
      await filesWithActivity(context.env, files, {
        type: "admin",
        title: `${existing ? "Updated" : "Added"} ${title}`,
        detail: photo
          ? "Painting and photo saved. They show on the site after the rebuild (about a minute)."
          : "Painting saved. It shows on the site after the rebuild (about a minute).",
        by: context.data.email || "",
      }),
    );
    return json({ ok: true, slug, image: image || undefined });
  } catch (error) {
    return fail(error, error instanceof Error && /invalid name/i.test(error.message) ? 400 : 500);
  }
}
