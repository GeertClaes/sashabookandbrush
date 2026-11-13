// Ordered painting and tool rows for the admin editor. The comparator and
// flag lists are pure. The renderer writes HTML; a row config supplies the
// flag labels, the open-button attribute, and the slug attribute.
import { escapeHtml } from "./admin-format.js";

export function compareByOrderThenTitle(a, b) {
  return (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title);
}

export function sortByOrderThenTitle(items) {
  return items.toSorted(compareByOrderThenTitle);
}

export function artFlags(piece) {
  const flags = [];
  if (!piece.image) flags.push("No image");
  if (!String(piece.note || "").trim()) flags.push("No note");
  if (piece.featured) flags.push("Home");
  if (piece.available) flags.push("For sale");
  return flags;
}

export function supplyFlags(item) {
  const flags = [];
  if (!item.amazon) flags.push("No Amazon URL");
  if (item.featured) flags.push("Home");
  return flags;
}

function copyChip(label, value) {
  if (!value) return "";
  return `<button type="button" class="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:border-primary" data-copy-value="${escapeHtml(value)}" data-copy-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
}

function flagHtml(flags, className) {
  if (!flags.length) return "";
  return `<span class="mt-1 block text-xs ${className}">${escapeHtml(flags.join(" · "))}</span>`;
}

function moveButtons(kind, index, total) {
  return `<div class="flex flex-col gap-1"><button type="button" class="rounded border border-border px-1.5 py-0.5 text-xs" data-${kind}-up ${index === 0 ? "disabled" : ""}>↑</button><button type="button" class="rounded border border-border px-1.5 py-0.5 text-xs" data-${kind}-down ${index === total - 1 ? "disabled" : ""}>↓</button></div>`;
}

const KIND = {
  art: {
    empty: "No paintings yet.",
    draggable: true,
    flags: artFlags,
    flagClass(_piece, flags) {
      return flags.includes("Home") && flags.length === 1 ? "text-muted-foreground" : "text-accent";
    },
    thumb(piece) {
      return piece.imageUrl
        ? `<img src="${escapeHtml(piece.imageUrl)}" alt="" class="h-12 w-12 shrink-0 rounded object-cover bg-muted" />`
        : `<span class="h-12 w-12 shrink-0 rounded bg-muted"></span>`;
    },
    subtitle(piece) {
      return escapeHtml(piece.medium);
    },
    chips(piece, origin) {
      return copyChip("Link", `${origin}/art#${piece.slug}`);
    },
  },
  supply: {
    empty: "No tools yet.",
    draggable: false,
    flags: supplyFlags,
    flagClass(item) {
      return item.amazon ? "text-muted-foreground" : "text-accent";
    },
    thumb() {
      return "";
    },
    subtitle(item) {
      return `${escapeHtml(item.brand)}${item.category ? ` · ${escapeHtml(item.category)}` : ""}`;
    },
    chips(item, origin) {
      return `${copyChip("Amazon", item.amazon)}${copyChip("Link", `${origin}/art#${item.slug}`)}`;
    },
  },
};

export function renderKindList(listEl, items, { kind, selectedSlug, creating, origin }) {
  if (!listEl) return;
  const config = KIND[kind];
  if (!items.length) {
    listEl.innerHTML = `<li class="text-muted-foreground">${config.empty}</li>`;
    return;
  }
  const sorted = sortByOrderThenTitle(items);
  listEl.innerHTML = sorted
    .map((item, index) => {
      const flags = config.flags(item);
      const extra = flagHtml(flags, config.flagClass(item, flags));
      const selected = selectedSlug === item.slug && !creating;
      const ring = selected ? "border-primary bg-muted" : "border-border";
      const dragAttr = config.draggable ? ` draggable="false"` : "";
      return `<li class="flex items-center gap-2 rounded-lg border ${ring} px-2 py-2"${dragAttr} data-${kind}-slug="${escapeHtml(item.slug)}"><button type="button" class="cursor-grab touch-none px-1 text-muted-foreground" data-drag aria-label="Drag to reorder">⋮⋮</button><span class="w-4 text-xs text-muted-foreground">${index + 1}</span>${config.thumb(item)}<button type="button" class="min-w-0 flex-1 text-left" data-${kind}-open><span class="font-medium text-foreground">${escapeHtml(item.title)}</span><span class="mt-0.5 block text-xs text-muted-foreground">${config.subtitle(item)}</span>${extra}</button>${config.chips(item, origin)}${moveButtons(kind, index, sorted.length)}</li>`;
    })
    .join("");
}
