import { applyYamlFields, emptyAffiliateUrl, fail, json, readJson, safeSlug, slugFromTitle, taggedAmazonUrl, yamlString } from "./_lib/frontmatter.js";
import { filesWithActivity } from "./_lib/activity.js";
import { parseImageUpload } from "./_lib/photo.js";
import { commitFiles, fileExists, tryGetTextFile } from "./_lib/github.js";

const MAX_NOTE = 8000;
const AMAZON_TAG = "sashabookandb-21";

function yamlField(text, key) {
  const match = String(text || "").match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return "";
  let value = match[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return value;
}

function supplyPhotoRepoPath(image) {
  const value = String(image || "").trim();
  const match = value.match(/^(?:\/images\/supplies\/)?([a-z0-9._-]+)$/i);
  return match ? `src/assets/supplies/${match[1]}` : "";
}

function supplyMarkdown({ title, brand, category, note, amazon, shop, shopLabel, featured, order, image }) {
  const amazonLine = amazon ? `amazon: ${yamlString(amazon)}\n` : "";
  const shopLines = shop ? `shop: ${yamlString(shop)}\nshopLabel: ${yamlString(shopLabel || "Shop")}\n` : "";
  const imageLine = image ? `image: ${yamlString(image)}\n` : "";
  return `---
title: ${yamlString(title)}
brand: ${yamlString(brand)}
category: ${yamlString(category)}
note: ${yamlString(note)}
${amazonLine}${shopLines}${imageLine}featured: ${featured}
order: ${order}
---
`;
}

async function deleteTool(env, slug, email = "") {
  const filePath = `src/content/supplies/${slug}.md`;
  const existing = await tryGetTextFile(env, filePath);
  if (!existing) return json({ error: "Tool not found" }, 404);

  const files = [{ path: filePath, delete: true }];
  const photo = supplyPhotoRepoPath(yamlField(existing, "image"));
  if (photo && (await fileExists(env, photo))) {
    files.push({ path: photo, delete: true });
  }

  await commitFiles(
    env,
    `Admin: delete supply ${slug}`,
    await filesWithActivity(env, files, {
      type: "admin",
      title: `Deleted tool ${slug}`,
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
      return await deleteTool(context.env, slug, context.data.email || "");
    }

    const title = String(body.title || "").trim();
    if (!title) return json({ error: "Title is required" }, 400);

    const slug = body.slug ? safeSlug(body.slug) : slugFromTitle(title);
    const filePath = `src/content/supplies/${slug}.md`;
    const existing = await tryGetTextFile(context.env, filePath);

    if (body.create && existing) {
      return json({ error: "A tool with that name already exists" }, 409);
    }
    if (!body.create && !existing) {
      return json({ error: "Tool not found" }, 404);
    }

    const note = typeof body.note === "string" ? body.note : "";
    if (note.length > MAX_NOTE) return json({ error: "That note is too long" }, 400);

    const pastedAmazon = emptyAffiliateUrl(body.amazon);
    const amazon = taggedAmazonUrl(pastedAmazon, AMAZON_TAG);
    if (pastedAmazon && !amazon) {
      return json({ error: "That doesn't look like an Amazon product link. Paste the address from the product page." }, 400);
    }

    const brand = String(body.brand || "").trim();
    const category = String(body.category || "Studio").trim() || "Studio";
    const shop = emptyAffiliateUrl(body.shop);
    const shopLabel = String(body.shopLabel || "").trim();
    const featured = Boolean(body.featured);
    const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0;
    const parsed = parseImageUpload(body, slug);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const photo = parsed.photo;
    const image = photo?.publicPath || (typeof body.image === "string" ? body.image.trim() : "");

    let text = existing;
    if (!text) {
      text = supplyMarkdown({ title, brand, category, note, amazon, shop, shopLabel, featured, order, image });
    } else {
      const updates = { title, brand, category, note, amazon, featured, order, shop, shopLabel };
      if (image) updates.image = image;
      text = applyYamlFields(text, updates);
    }
    if (!text.endsWith("\n")) text += "\n";

    const files = [{ path: filePath, content: text, encoding: "utf-8" }];
    if (photo) {
      files.push({ path: photo.supplyRepoPath, content: photo.contentBase64, encoding: "base64" });
    }

    await commitFiles(
      context.env,
      `Admin: ${existing ? "update" : "add"} supply ${slug}`,
      await filesWithActivity(context.env, files, {
        type: "admin",
        title: `${existing ? "Updated" : "Added"} ${title}`,
        detail: photo
          ? "Tool and photo saved. They show on the site after the rebuild (about a minute)."
          : "Tool saved. It shows on the site after the rebuild (about a minute).",
        by: context.data.email || "",
      }),
    );
    return json({ ok: true, slug, amazon, image: image || undefined });
  } catch (error) {
    return fail(error, error instanceof Error && /invalid name/i.test(error.message) ? 400 : 500);
  }
}
