import { artMarkdown, deriveArtFields } from "./art.js";
import { applyYamlFields, readYamlField, safeSlug, slugFromTitle } from "./frontmatter.js";
import { parseImageUpload } from "./photo.js";
import { deriveSupplyFields, supplyMarkdown } from "./supply.js";

const KINDS = {
  art: {
    dir: "src/content/art",
    photoDir: "src/assets/art",
    photoPublic: "art",
    missing: "Painting not found",
    exists: "A painting with that name already exists",
    deleteTitle: (slug) => `Deleted painting ${slug}`,
    markdown: artMarkdown,
    derive: deriveArtFields,
    updateKeys: ["title", "medium", "note", "featured", "order", "available", "shop", "shopLabel"],
  },
  supply: {
    dir: "src/content/supplies",
    photoDir: "src/assets/supplies",
    photoPublic: "supplies",
    missing: "Tool not found",
    exists: "A tool with that name already exists",
    deleteTitle: (slug) => `Deleted tool ${slug}`,
    markdown: supplyMarkdown,
    derive: deriveSupplyFields,
    updateKeys: [
      "title",
      "brand",
      "category",
      "note",
      "amazon",
      "featured",
      "order",
      "shop",
      "shopLabel",
    ],
  },
};

export function resolveContentWrite(kind, body) {
  const spec = KINDS[kind];
  if (!spec) return { error: "Unknown list", status: 400 };
  const source = body && typeof body === "object" ? body : {};
  try {
    if (source.delete) {
      const slug = safeSlug(source.slug);
      return { slug, filePath: `${spec.dir}/${slug}.md` };
    }
    const title = String(source.title || "").trim();
    if (!title) return { error: "Title is required", status: 400 };
    const slug = source.slug ? safeSlug(source.slug) : slugFromTitle(title);
    return { slug, filePath: `${spec.dir}/${slug}.md`, title };
  } catch (error) {
    if (error instanceof Error && /invalid name/i.test(error.message)) {
      return { error: "Invalid name", status: 400 };
    }
    throw error;
  }
}

export function managedPhotoRepoPath(kind, image) {
  const spec = KINDS[kind];
  if (!spec) return "";
  const value = String(image || "").trim();
  const match = value.match(new RegExp(`^(?:/images/${spec.photoPublic}/)?([a-z0-9._-]+)$`, "i"));
  return match ? `${spec.photoDir}/${match[1]}` : "";
}

function withNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function planContentSave({ kind, body, existingText }) {
  const spec = KINDS[kind];
  if (!spec) return { error: "Unknown list", status: 400 };
  const source = body && typeof body === "object" ? body : {};
  const target = resolveContentWrite(kind, source);
  if (target.error) return target;

  const found = existingText != null;
  const existing = found ? String(existingText) : "";

  if (source.delete) {
    if (!found) return { error: spec.missing, status: 404 };
    const files = [{ path: target.filePath, delete: true }];
    const photo = managedPhotoRepoPath(kind, readYamlField(existing, "image"));
    if (photo) files.push({ path: photo, delete: true });
    return {
      kind,
      slug: target.slug,
      action: "delete",
      withPhoto: false,
      result: { ok: true, slug: target.slug, deleted: true },
      activity: { type: "admin", title: spec.deleteTitle(target.slug) },
      files,
    };
  }

  if (source.create && found) return { error: spec.exists, status: 409 };
  if (!source.create && !found) return { error: spec.missing, status: 404 };

  const derived = spec.derive(source);
  if (derived.error) return { error: derived.error, status: 400 };
  const fields = derived.fields;

  const parsed = parseImageUpload(source, target.slug, kind);
  if (!parsed.ok) return { error: parsed.error, status: 400 };
  const photo = parsed.photo;
  const image = photo?.publicPath || (typeof source.image === "string" ? source.image.trim() : "");

  let text;
  if (!found) {
    text = spec.markdown({ ...fields, image });
  } else {
    const updates = {};
    for (const key of spec.updateKeys) updates[key] = fields[key];
    if (image) updates.image = image;
    text = applyYamlFields(existing, updates);
  }

  const files = [{ path: target.filePath, content: withNewline(text), encoding: "utf-8" }];
  if (photo) {
    files.push({ path: photo.repoPath, content: photo.contentBase64, encoding: "base64" });
  }

  const result = { ok: true, slug: target.slug, image: image || undefined };
  if (kind === "supply") result.amazon = fields.amazon;

  return {
    kind,
    slug: target.slug,
    action: found ? "update" : "add",
    withPhoto: Boolean(photo),
    result,
    activity: { type: "admin", title: `${found ? "Updated" : "Added"} ${fields.title}` },
    files,
  };
}

export function contentCommitMessage(plan) {
  if (plan.action === "delete") return `Admin: delete ${plan.kind} ${plan.slug}`;
  return `Admin: ${plan.action} ${plan.kind} ${plan.slug}`;
}

export function contentSaveDetail(plan, { local = false } = {}) {
  if (local) return "Saved on this computer. Refresh the site to see it.";
  if (plan.action === "delete") {
    return "It leaves the Art page after the site rebuilds (about a minute).";
  }
  if (plan.kind === "art") {
    return plan.withPhoto
      ? "Painting and photo saved. They show on the site after the rebuild (about a minute)."
      : "Painting saved. It shows on the site after the rebuild (about a minute).";
  }
  return plan.withPhoto
    ? "Tool and photo saved. They show on the site after the rebuild (about a minute)."
    : "Tool saved. It shows on the site after the rebuild (about a minute).";
}
