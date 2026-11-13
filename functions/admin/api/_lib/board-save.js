import { applyYamlFields, safeSlug } from "./frontmatter.js";

const LOCAL_DETAIL = "Saved on this computer. Refresh the site to see it.";

const ORDER_KINDS = {
  art: { dir: "src/content/art", label: "paintings" },
  supply: { dir: "src/content/supplies", label: "tools" },
};

function namedSlugs(values) {
  const slugs = [];
  for (const value of values) {
    try {
      slugs.push(safeSlug(value));
    } catch (error) {
      if (error instanceof Error && /invalid name/i.test(error.message)) {
        return { error: "Invalid name", status: 400 };
      }
      throw error;
    }
  }
  return { slugs };
}

function withNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function planFeaturedBoard(rows, filesBySlug = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length || list.length > 20) {
    return { error: "Send between 1 and 20 books", status: 400 };
  }
  const names = namedSlugs(list.map((row) => row?.slug));
  if (names.error) return names;

  let featuredCount = 0;
  const files = [];
  for (const [index, slug] of names.slugs.entries()) {
    const text = filesBySlug[slug];
    if (!text) return { error: `Unknown book: ${slug}`, status: 400 };
    const featured = Boolean(list[index].featured);
    const updates = { featured };
    if (featured) {
      featuredCount += 1;
      updates.order = featuredCount;
    }
    files.push({
      path: `src/content/books/${slug}.md`,
      content: withNewline(applyYamlFields(text, updates)),
      encoding: "utf-8",
    });
  }

  return {
    files,
    result: { ok: true, featured: featuredCount },
    activity: { type: "admin", title: `Updated featured board (${featuredCount} on Home)` },
    message: "Admin: update featured board",
  };
}

export function planReorder({ kind, slugs, filesBySlug = {} }) {
  const spec = ORDER_KINDS[kind];
  const list = Array.isArray(slugs) ? slugs : [];
  if (!spec) return { error: "Unknown list", status: 400 };
  if (!list.length || list.length > 40) {
    return { error: "Send between 1 and 40 items", status: 400 };
  }
  const names = namedSlugs(list);
  if (names.error) return names;

  const files = names.slugs.map((slug, index) => {
    const text = filesBySlug[slug];
    if (!text) return null;
    return {
      path: `${spec.dir}/${slug}.md`,
      content: withNewline(applyYamlFields(text, { order: index + 1 })),
      encoding: "utf-8",
    };
  });
  if (files.some((file) => !file)) {
    const missing = names.slugs.find((slug) => !filesBySlug[slug]);
    return { error: `Unknown item: ${missing}`, status: 400 };
  }

  return {
    files,
    result: { ok: true, count: files.length },
    activity: { type: "admin", title: `Reordered ${spec.label}` },
    message: `Admin: reorder ${spec.label}`,
  };
}

export function featuredSaveDetail({ local = false } = {}) {
  return local
    ? LOCAL_DETAIL
    : "Home featured cards update after the site rebuilds (about a minute).";
}

export function reorderSaveDetail({ local = false } = {}) {
  return local
    ? LOCAL_DETAIL
    : "The Art page order updates after the site rebuilds (about a minute).";
}
