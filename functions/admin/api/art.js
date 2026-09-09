import { applyYamlFields, fail, json, readJson, safeSlug, slugFromTitle, yamlString } from "./_lib/frontmatter.js";
import { filesWithActivity } from "./_lib/activity.js";
import { commitFiles, fileExists, tryGetTextFile } from "./_lib/github.js";

const MAX_NOTE = 8000;

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
  const match = value.match(/^\/images\/art\/([a-z0-9._-]+)$/i);
  return match ? `public/images/art/${match[1]}` : "";
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

    await commitFiles(
      context.env,
      `Admin: ${existing ? "update" : "add"} art ${slug}`,
      await filesWithActivity(context.env, [{ path: filePath, content: text, encoding: "utf-8" }], {
        type: "admin",
        title: `${existing ? "Updated" : "Added"} ${title}`,
        detail: "Painting saved. It shows on the site after the rebuild (about a minute).",
        by: context.data.email || "",
      }),
    );
    return json({ ok: true, slug });
  } catch (error) {
    return fail(error, error instanceof Error && /invalid name/i.test(error.message) ? 400 : 500);
  }
}
