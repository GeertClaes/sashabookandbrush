import { applyYamlFields, fail, json, readJson, safeSlug, slugFromTitle, yamlString } from "./_lib/frontmatter.js";
import { filesWithActivity } from "./_lib/activity.js";
import { commitFiles, tryGetTextFile } from "./_lib/github.js";

const MAX_NOTE = 8000;

function affiliateValue(value) {
  const trimmed = String(value || "").trim();
  return !trimmed || trimmed === "#" ? "#" : trimmed;
}

function supplyMarkdown({ title, brand, category, note, amazon, shop, shopLabel, featured, order }) {
  const shopLines = shop ? `shop: ${yamlString(shop)}\nshopLabel: ${yamlString(shopLabel || "Shop")}\n` : "";
  return `---
title: ${yamlString(title)}
brand: ${yamlString(brand)}
category: ${yamlString(category)}
note: ${yamlString(note)}
amazon: ${yamlString(amazon)}
${shopLines}featured: ${featured}
order: ${order}
---
`;
}

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    if (body.delete) {
      const slug = safeSlug(body.slug);
      const filePath = `src/content/supplies/${slug}.md`;
      const existing = await tryGetTextFile(context.env, filePath);
      if (!existing) return json({ error: "Tool not found" }, 404);
      await commitFiles(
        context.env,
        `Admin: delete supply ${slug}`,
        await filesWithActivity(context.env, [{ path: filePath, delete: true }], {
          type: "admin",
          title: `Deleted tool ${slug}`,
          detail: "It leaves the Art page after the site rebuilds (about a minute).",
          by: context.data.email || "",
        }),
      );
      return json({ ok: true, slug, deleted: true });
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

    const brand = String(body.brand || "").trim();
    const category = String(body.category || "Studio").trim() || "Studio";
    const amazon = affiliateValue(body.amazon);
    const shop = String(body.shop || "").trim();
    const shopLabel = String(body.shopLabel || "").trim();
    const featured = Boolean(body.featured);
    const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0;

    let text = existing;
    if (!text) {
      text = supplyMarkdown({ title, brand, category, note, amazon, shop, shopLabel, featured, order });
    } else {
      const updates = { title, brand, category, note, amazon, featured, order, shop, shopLabel };
      text = applyYamlFields(text, updates);
    }
    if (!text.endsWith("\n")) text += "\n";

    await commitFiles(
      context.env,
      `Admin: ${existing ? "update" : "add"} supply ${slug}`,
      await filesWithActivity(context.env, [{ path: filePath, content: text, encoding: "utf-8" }], {
        type: "admin",
        title: `${existing ? "Updated" : "Added"} ${title}`,
        detail: "Tool saved. It shows on the site after the rebuild (about a minute).",
        by: context.data.email || "",
      }),
    );
    return json({ ok: true, slug });
  } catch (error) {
    return fail(error, error instanceof Error && /invalid name/i.test(error.message) ? 400 : 500);
  }
}
