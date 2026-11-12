import { emptyAffiliateUrl, yamlString } from "./frontmatter.js";

export const ART_MAX_NOTE = 8000;

// Validates and derives the plain (non-photo) fields for an art save from
// the raw request body. Shared by the Cloudflare Pages function (art.js)
// and the local dev admin server so both enforce the same rules (e.g. the
// note-length limit) instead of drifting apart.
export function deriveArtFields(body) {
  const title = String(body.title || "").trim();
  if (!title) return { error: "Title is required" };

  const note = typeof body.note === "string" ? body.note : "";
  if (note.length > ART_MAX_NOTE) return { error: "That note is too long" };

  const medium = String(body.medium || "Acrylic").trim() || "Acrylic";
  const featured = Boolean(body.featured);
  const available = Boolean(body.available);
  const shop = available ? emptyAffiliateUrl(body.shop) : "";
  const shopLabel = available ? String(body.shopLabel || "").trim() : "";
  const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0;

  return { fields: { title, note, medium, featured, available, shop, shopLabel, order } };
}

export function artMarkdown({
  title,
  medium,
  note,
  featured,
  order,
  image,
  available,
  shop,
  shopLabel,
}) {
  const imageLine = image ? `image: ${yamlString(image)}\n` : "";
  const shopLine = shop ? `shop: ${yamlString(shop)}\n` : "";
  const labelLine = shopLabel ? `shopLabel: ${yamlString(shopLabel)}\n` : "";
  return `---
title: ${yamlString(title)}
medium: ${yamlString(medium)}
note: ${yamlString(note)}
featured: ${featured}
order: ${order}
available: ${available}
${shopLine}${labelLine}${imageLine}---
`;
}
