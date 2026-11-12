import { emptyAffiliateUrl, taggedAmazonUrl, yamlString } from "./frontmatter.js";

export const SUPPLY_MAX_NOTE = 8000;
export const SUPPLY_AMAZON_TAG = "sashabookandb-21";

// Validates and derives the plain (non-photo) fields for a supply/tool save
// from the raw request body. Shared by the Cloudflare Pages function
// (supply.js) and the local dev admin server so both enforce the same
// rules (e.g. the note-length limit and the Amazon-link check) instead of
// drifting apart.
export function deriveSupplyFields(body) {
  const title = String(body.title || "").trim();
  if (!title) return { error: "Title is required" };

  const note = typeof body.note === "string" ? body.note : "";
  if (note.length > SUPPLY_MAX_NOTE) return { error: "That note is too long" };

  const pastedAmazon = emptyAffiliateUrl(body.amazon);
  const amazon = taggedAmazonUrl(pastedAmazon, SUPPLY_AMAZON_TAG);
  if (pastedAmazon && !amazon) {
    return {
      error:
        "That doesn't look like an Amazon product link. Paste the address from the product page.",
    };
  }

  const brand = String(body.brand || "").trim();
  const category = String(body.category || "Studio").trim() || "Studio";
  const shop = emptyAffiliateUrl(body.shop);
  const shopLabel = String(body.shopLabel || "").trim();
  const featured = Boolean(body.featured);
  const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0;

  return { fields: { title, brand, category, note, amazon, shop, shopLabel, featured, order } };
}

export function supplyMarkdown({
  title,
  brand,
  category,
  note,
  amazon,
  shop,
  shopLabel,
  featured,
  order,
  image,
}) {
  const amazonLine = amazon ? `amazon: ${yamlString(amazon)}\n` : "";
  const shopLines = shop
    ? `shop: ${yamlString(shop)}\nshopLabel: ${yamlString(shopLabel || "Shop")}\n`
    : "";
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
