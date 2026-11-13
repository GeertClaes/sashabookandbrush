// Pages tab: build the copy form, the about photo control, and the dirty check.
// Field widgets live in admin-copy-ui.js. This module owns the page assembly.
import {
  COPY_MAX,
  cardRow,
  copySection,
  copySubhead,
  labelledField,
  listBlock,
  paragraphRow,
  readCopy,
} from "./admin-copy-ui.js";

let copySnapshot = "";

export function copyState() {
  const root = document.querySelector("[data-copy-root]");
  if (!root || !root.childElementCount) return "";
  return JSON.stringify(readCopy());
}

export function aboutPhotoPending() {
  return Boolean(document.querySelector("[data-about-image]")?.files?.[0]);
}

export function isCopyDirty() {
  return Boolean(copySnapshot) && (copyState() !== copySnapshot || aboutPhotoPending());
}

export function copyTextChanged() {
  return copyState() !== copySnapshot;
}

export function acceptCopySnapshot() {
  copySnapshot = copyState();
}

function onCopyClick(event, setBanner) {
  const add = event.target.closest("[data-copy-add]");
  const remove = event.target.closest("[data-copy-remove]");
  if (add) {
    const name = add.dataset.copyAdd;
    const list = add.closest("[data-copy-block]")?.querySelector("[data-copy-list]");
    if (!list) return;
    if (list.children.length >= COPY_MAX.items) {
      setBanner("error", "That's as many as this page can hold.");
      return;
    }
    list.append(name === "paragraphs" ? paragraphRow("") : cardRow(name, { title: "", desc: "" }));
    return;
  }
  if (!remove) return;
  const card = remove.closest("[data-copy-item]");
  if (remove.dataset.copyRemove === "paragraphs" && card?.parentElement?.children.length <= 1) {
    setBanner("error", "About needs at least one paragraph.");
    return;
  }
  card?.remove();
}

function aboutPhotoControl(about) {
  const wrap = document.createElement("div");
  wrap.className = "mb-4";
  const heading = document.createElement("p");
  heading.className = "mb-2 text-sm font-medium text-foreground";
  heading.textContent = "Photo";
  const drop = document.createElement("button");
  drop.type = "button";
  drop.dataset.aboutDrop = "";
  drop.className =
    "mb-2 flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground hover:border-primary";
  const preview = document.createElement("img");
  preview.dataset.aboutPreview = "";
  preview.alt = "";
  preview.className = "hidden max-h-72 rounded object-cover shadow";
  const label = document.createElement("span");
  label.dataset.aboutDropLabel = "";
  label.textContent = "Drop a photo here, or click to choose. Large phone photos are resized.";
  drop.append(preview, label);
  const input = document.createElement("input");
  input.type = "file";
  input.dataset.aboutImage = "";
  input.accept = "image/jpeg,image/png,image/webp,image/heic,image/heif";
  input.className = "hidden";
  const hint = document.createElement("p");
  hint.className = "mt-2 text-xs font-normal text-muted-foreground";
  hint.textContent =
    "This portrait is on About and on Work with me. A new photo is used in light and dark. The home photo stays as it is.";
  const alt = labelledField("Photo description", about.imageAlt, {
    path: "about.imageAlt",
    hint: "A short line for someone who cannot see the photo.",
  });
  alt.classList.remove("mb-4");
  wrap.append(heading, drop, input, hint, alt);
  return wrap;
}

export function renderCopyPage(pageCopy, { copyPageLink, setBanner, bindDrop, resetDrop }) {
  const root = document.querySelector("[data-copy-root]");
  if (!root || root.childElementCount) {
    if (!copySnapshot) copySnapshot = copyState();
    return;
  }
  const hero = pageCopy.hero || {};
  const about = pageCopy.about || {};
  const work = pageCopy.work || {};
  const credentials = pageCopy.credentials || {};

  const home = copySection(
    "Home",
    "The big words on the first screen. The buttons stay as they are.",
    "home",
    copyPageLink,
  );
  home.append(
    labelledField("Small line above the title", hero.eyebrow, { path: "hero.eyebrow" }),
    labelledField("Headline", hero.headline, { path: "hero.headline" }),
    labelledField("Italic line", hero.headlineItalic, { path: "hero.headlineItalic" }),
    labelledField("Intro", hero.lede, {
      path: "hero.lede",
      long: true,
      max: COPY_MAX.medium,
      rows: 4,
    }),
  );

  const aboutSection = copySection(
    "About",
    "The portrait and the bio. Each box is its own paragraph. Fact chips stay as they are.",
    "about",
    copyPageLink,
  );
  aboutSection.append(
    aboutPhotoControl(about),
    labelledField("Small line above the title", about.eyebrow, { path: "about.eyebrow" }),
    labelledField("Headline", about.headline, { path: "about.headline" }),
    labelledField("Italic line", about.headlineItalic, { path: "about.headlineItalic" }),
    listBlock(
      "paragraphs",
      "Add paragraph",
      about.paragraphs?.length ? about.paragraphs : [""],
      (value) => paragraphRow(value),
    ),
  );

  const workSection = copySection(
    "Work with me",
    "The words on Work with me. The Instagram buttons stay as they are.",
    "work",
    copyPageLink,
  );
  workSection.append(
    labelledField("Short summary", pageCopy.workIntro || "", {
      path: "workIntro",
      long: true,
      max: COPY_MAX.medium,
      rows: 3,
      hint: "Used for search and link previews. It does not show as a heading on the page.",
    }),
    labelledField("Small line above the title", work.eyebrow, { path: "work.eyebrow" }),
    labelledField("Headline", work.headline, { path: "work.headline" }),
    labelledField("Italic line", work.headlineItalic, { path: "work.headlineItalic" }),
    labelledField("Intro", work.lede, {
      path: "work.lede",
      long: true,
      max: COPY_MAX.long,
      rows: 4,
    }),
    labelledField("Second paragraph", work.note, {
      path: "work.note",
      long: true,
      max: COPY_MAX.long,
      rows: 4,
    }),
    labelledField("Line under the photo", work.photoCaption, {
      path: "work.photoCaption",
      long: true,
      max: COPY_MAX.medium,
      rows: 2,
    }),
    copySubhead("What I like making"),
    labelledField("Small line", work.offersEyebrow, { path: "work.offersEyebrow" }),
    labelledField("Heading", work.offersHeadline, { path: "work.offersHeadline" }),
    labelledField("Intro", work.offersLede, {
      path: "work.offersLede",
      long: true,
      max: COPY_MAX.long,
      rows: 3,
    }),
    listBlock("offers", "Add offer", pageCopy.offers || [], (item) => cardRow("offers", item)),
    copySubhead("Ways it can look"),
    labelledField("Small line", work.packagesEyebrow, { path: "work.packagesEyebrow" }),
    labelledField("Heading", work.packagesHeadline, { path: "work.packagesHeadline" }),
    labelledField("Intro", work.packagesLede, {
      path: "work.packagesLede",
      long: true,
      max: COPY_MAX.long,
      rows: 3,
    }),
    listBlock("packages", "Add a way of working", pageCopy.packages || [], (item) =>
      cardRow("packages", item),
    ),
    labelledField("Note under those cards", work.pricesNote, {
      path: "work.pricesNote",
      long: true,
      max: COPY_MAX.medium,
      rows: 2,
    }),
    copySubhead("Also"),
    labelledField("Small heading", credentials.title, { path: "credentials.title" }),
    labelledField("Text", credentials.org, {
      path: "credentials.org",
      long: true,
      max: COPY_MAX.long,
      rows: 3,
    }),
    copySubhead("Closing"),
    labelledField("Heading", work.closeHeadline, { path: "work.closeHeadline" }),
    labelledField("Paragraph", work.closeLede, {
      path: "work.closeLede",
      long: true,
      max: COPY_MAX.long,
      rows: 4,
    }),
  );

  root.append(home, aboutSection, workSection);
  root.addEventListener("click", (event) => onCopyClick(event, setBanner));
  bindDrop("about");
  const samePhoto = about.image && about.image === about.imageDark;
  resetDrop(
    "about",
    about.image || "",
    samePhoto
      ? "Drop a new photo to replace it."
      : "Drop a new photo to replace the light and dark portraits.",
  );
  copySnapshot = copyState();
}
