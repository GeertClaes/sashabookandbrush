// DOM-builder helpers for the Pages/Copy tab's dynamic "add paragraph" /
// "add card" editor, plus the reverse (reading the rendered form back into
// a plain copy object for saving). These still touch the DOM directly, so
// they aren't unit tested, but keeping them here shrinks admin.astro's
// inline script and groups the Copy tab's rendering logic in one place.

export const COPY_MAX = { short: 160, medium: 800, long: 2000, items: 8 };

export function copyInputClass() {
  return "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal";
}

/**
 * @param {string} label
 * @param {string} value
 * @param {{ long?: boolean, rows?: number, max?: number, path?: string, key?: string, hint?: string }} [options]
 */
export function labelledField(label, value, options = {}) {
  const wrap = document.createElement("label");
  wrap.className = "mb-4 block text-sm font-medium text-foreground";
  wrap.append(document.createTextNode(label));
  const input = document.createElement(options.long ? "textarea" : "input");
  input.className = copyInputClass();
  if (options.long && input instanceof HTMLTextAreaElement) input.rows = options.rows || 4;
  input.maxLength = options.max || COPY_MAX.short;
  input.value = value || "";
  if (options.path) input.dataset.copyPath = options.path;
  if (options.key) input.dataset.copyKey = options.key;
  wrap.append(input);
  if (options.hint) {
    const hint = document.createElement("span");
    hint.className = "mt-1 block text-xs font-normal text-muted-foreground";
    hint.textContent = options.hint;
    wrap.append(hint);
  }
  return wrap;
}

/**
 * @param {string} title
 * @param {string} hint
 * @param {string} [copyName]
 * @param {(copyName: string) => void} [onCopyLink] Called when the section's
 *   "Copy link" button is clicked, since building that link (site origin +
 *   path) is the page's job, not this DOM builder's.
 */
export function copySection(title, hint, copyName, onCopyLink) {
  const section = document.createElement("details");
  section.className = "rounded-xl border border-border bg-card px-5 pb-5";
  const summary = document.createElement("summary");
  summary.className = "flex cursor-pointer list-none items-center justify-between gap-3 py-4";
  const heading = document.createElement("span");
  heading.className = "font-display text-xl font-semibold text-foreground";
  heading.textContent = title;
  summary.append(heading);
  if (copyName) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.copy = copyName;
    button.className =
      "shrink-0 text-sm font-normal text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground";
    button.textContent = "Copy link";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onCopyLink?.(copyName);
    });
    summary.append(button);
  }
  const note = document.createElement("p");
  note.className = "text-sm text-muted-foreground";
  note.textContent = hint;
  const linkNote = document.createElement("p");
  linkNote.className = "mt-1 mb-4 text-xs text-muted-foreground";
  linkNote.textContent = "To make a link, write [the words](https://the-site.com).";
  section.append(summary, note, linkNote);
  return section;
}

export function copySubhead(text) {
  const heading = document.createElement("h3");
  heading.className = "font-display mt-2 mb-3 text-lg font-semibold text-foreground";
  heading.textContent = text;
  return heading;
}

export function copyRemoveButton(name) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.copyRemove = name;
  button.className = "text-xs text-muted-foreground hover:text-foreground";
  button.textContent = "Remove";
  return button;
}

export function paragraphRow(value) {
  const row = document.createElement("div");
  row.dataset.copyItem = "paragraphs";
  row.className = "mb-3 rounded-lg border border-border p-3";
  const field = labelledField("Paragraph", value, {
    long: true,
    max: COPY_MAX.long,
    rows: 5,
    key: "body",
  });
  field.classList.remove("mb-4");
  row.append(field, copyRemoveButton("paragraphs"));
  return row;
}

export function cardRow(name, item) {
  const row = document.createElement("div");
  row.dataset.copyItem = name;
  row.className = "mb-3 rounded-lg border border-border p-3";
  const title = labelledField("Title", item.title, { key: "title" });
  const text = labelledField("Text", item.desc, {
    long: true,
    max: COPY_MAX.long,
    rows: 3,
    key: "desc",
  });
  text.classList.remove("mb-4");
  row.append(title, text, copyRemoveButton(name));
  return row;
}

/**
 * @param {string} name
 * @param {string} addLabel
 * @param {unknown[]} items
 * @param {(item: unknown) => HTMLElement} renderItem
 */
export function listBlock(name, addLabel, items, renderItem) {
  const block = document.createElement("div");
  block.dataset.copyBlock = name;
  block.className = "mb-4";
  const list = document.createElement("div");
  list.dataset.copyList = name;
  items.forEach((item) => list.append(renderItem(item)));
  const add = document.createElement("button");
  add.type = "button";
  add.dataset.copyAdd = name;
  add.className =
    "rounded border border-border px-3 py-1.5 text-sm text-foreground hover:border-primary";
  add.textContent = addLabel;
  block.append(list, add);
  return block;
}

/** @param {string} path */
export function copyValue(path) {
  const el = document.querySelector(`[data-copy-path="${CSS.escape(path)}"]`);
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : "";
}

/** @param {string} name */
export function readCards(name) {
  return [...document.querySelectorAll(`[data-copy-item="${name}"]`)]
    .map((card) => {
      const title = card.querySelector('[data-copy-key="title"]');
      const desc = card.querySelector('[data-copy-key="desc"]');
      return {
        title: title instanceof HTMLInputElement ? title.value.trim() : "",
        desc: desc instanceof HTMLTextAreaElement ? desc.value.trim() : "",
      };
    })
    .filter((item) => item.title || item.desc);
}

export function readCopy() {
  const work = {};
  [
    "eyebrow",
    "headline",
    "headlineItalic",
    "lede",
    "note",
    "photoCaption",
    "offersEyebrow",
    "offersHeadline",
    "offersLede",
    "packagesEyebrow",
    "packagesHeadline",
    "packagesLede",
    "pricesNote",
    "closeHeadline",
    "closeLede",
  ].forEach((key) => {
    work[key] = copyValue(`work.${key}`).trim();
  });
  return {
    hero: {
      eyebrow: copyValue("hero.eyebrow").trim(),
      headline: copyValue("hero.headline").trim(),
      headlineItalic: copyValue("hero.headlineItalic").trim(),
      lede: copyValue("hero.lede").trim(),
    },
    about: {
      eyebrow: copyValue("about.eyebrow").trim(),
      headline: copyValue("about.headline").trim(),
      headlineItalic: copyValue("about.headlineItalic").trim(),
      imageAlt: copyValue("about.imageAlt").trim(),
      paragraphs: [
        ...document.querySelectorAll('[data-copy-item="paragraphs"] [data-copy-key="body"]'),
      ]
        .map((el) => (el instanceof HTMLTextAreaElement ? el.value.trim() : ""))
        .filter(Boolean),
    },
    workIntro: copyValue("workIntro").trim(),
    work,
    offers: readCards("offers"),
    packages: readCards("packages"),
    credentials: {
      title: copyValue("credentials.title").trim(),
      org: copyValue("credentials.org").trim(),
    },
  };
}
