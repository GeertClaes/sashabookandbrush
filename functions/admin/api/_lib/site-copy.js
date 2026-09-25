const SHORT = 160;
const MEDIUM = 800;
const LONG = 2000;
const MAX_ITEMS = 8;

function clean(value) {
  return String(value ?? "").replace(/\u0000/g, "").trim();
}

function requireText(value, label, max) {
  const text = clean(value);
  if (!text) throw new Error(`${label} is empty.`);
  if (text.length > max) throw new Error(`${label} is too long (max ${max} characters).`);
  return text;
}

function optionalText(value, label, max) {
  const text = clean(value);
  if (text.length > max) throw new Error(`${label} is too long (max ${max} characters).`);
  return text;
}

function take(source, key, label, max, required) {
  if (!source || typeof source !== "object" || !Object.prototype.hasOwnProperty.call(source, key)) return undefined;
  return required ? requireText(source[key], label, max) : optionalText(source[key], label, max);
}

function assignPresent(target, source, specs) {
  for (const spec of specs) {
    const value = take(source, spec.key, spec.label, spec.max, spec.required);
    if (value !== undefined) target[spec.key] = value;
  }
}

const HERO_FIELDS = [
  { key: "eyebrow", label: "Home small line", max: SHORT },
  { key: "headline", label: "Home headline", max: SHORT, required: true },
  { key: "headlineItalic", label: "Home italic line", max: SHORT },
  { key: "lede", label: "Home intro", max: MEDIUM, required: true },
];

const ABOUT_FIELDS = [
  { key: "eyebrow", label: "About small line", max: SHORT },
  { key: "headline", label: "About headline", max: SHORT, required: true },
  { key: "headlineItalic", label: "About italic line", max: SHORT },
];

const WORK_FIELDS = [
  { key: "eyebrow", label: "Work with me small line", max: SHORT },
  { key: "headline", label: "Work with me headline", max: SHORT, required: true },
  { key: "headlineItalic", label: "Work with me italic line", max: SHORT },
  { key: "lede", label: "Work with me intro", max: LONG, required: true },
  { key: "note", label: "Work with me second paragraph", max: LONG },
  { key: "photoCaption", label: "Photo caption", max: MEDIUM },
  { key: "offersEyebrow", label: "Offers small line", max: SHORT },
  { key: "offersHeadline", label: "Offers heading", max: SHORT },
  { key: "offersLede", label: "Offers intro", max: LONG },
  { key: "packagesEyebrow", label: "Ways small line", max: SHORT },
  { key: "packagesHeadline", label: "Ways heading", max: SHORT },
  { key: "packagesLede", label: "Ways intro", max: LONG },
  { key: "pricesNote", label: "Prices note", max: MEDIUM },
  { key: "closeHeadline", label: "Closing heading", max: SHORT },
  { key: "closeLede", label: "Closing paragraph", max: LONG },
];

function cards(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} is missing.`);
  if (value.length > MAX_ITEMS) throw new Error(`Keep ${label.toLowerCase()} to ${MAX_ITEMS} or fewer.`);
  return value.map((item, index) => ({
    title: requireText(item?.title, `${label} ${index + 1} title`, SHORT),
    desc: optionalText(item?.desc, `${label} ${index + 1} text`, LONG),
  }));
}

function mergeCards(existing, incoming) {
  const prior = Array.isArray(existing) ? existing : [];
  return incoming.map((item, index) => ({
    ...(prior[index] && typeof prior[index] === "object" ? prior[index] : {}),
    title: item.title,
    desc: item.desc,
  }));
}

function paragraphs(value) {
  if (!Array.isArray(value)) throw new Error("About paragraphs are missing.");
  const cleaned = value.map((item) => clean(item)).filter(Boolean);
  if (!cleaned.length) throw new Error("About needs at least one paragraph.");
  if (cleaned.length > MAX_ITEMS) throw new Error(`Keep the about page to ${MAX_ITEMS} paragraphs.`);
  for (const paragraph of cleaned) {
    if (paragraph.length > LONG) throw new Error(`An about paragraph is too long (max ${LONG} characters).`);
  }
  return cleaned;
}

export function editableCopy(site) {
  const hero = site?.hero || {};
  const about = site?.about || {};
  const work = site?.work || {};
  const credentials = site?.credentials || {};
  return {
    hero: {
      eyebrow: hero.eyebrow || "",
      headline: hero.headline || "",
      headlineItalic: hero.headlineItalic || "",
      lede: hero.lede || "",
    },
    about: {
      eyebrow: about.eyebrow || "",
      headline: about.headline || "",
      headlineItalic: about.headlineItalic || "",
      paragraphs: Array.isArray(about.paragraphs) ? about.paragraphs : [],
    },
    workIntro: site?.workIntro || "",
    work: Object.fromEntries(WORK_FIELDS.map((field) => [field.key, work[field.key] || ""])),
    offers: (Array.isArray(site?.offers) ? site.offers : []).map((item) => ({
      title: item.title || "",
      desc: item.desc || "",
    })),
    packages: (Array.isArray(site?.packages) ? site.packages : []).map((item) => ({
      title: item.title || "",
      desc: item.desc || "",
    })),
    credentials: {
      title: credentials.title || "",
      org: credentials.org || "",
    },
  };
}

export function applySiteCopy(site, body) {
  if (!site || typeof site !== "object") throw new Error("Site file is missing.");
  const source = body && typeof body === "object" ? body : {};
  const next = structuredClone(site);

  if (source.hero && typeof source.hero === "object") {
    next.hero = { ...(next.hero || {}) };
    assignPresent(next.hero, source.hero, HERO_FIELDS);
  }

  if (source.about && typeof source.about === "object") {
    next.about = { ...(next.about || {}) };
    assignPresent(next.about, source.about, ABOUT_FIELDS);
    if (Object.prototype.hasOwnProperty.call(source.about, "paragraphs")) {
      next.about.paragraphs = paragraphs(source.about.paragraphs);
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, "workIntro")) {
    next.workIntro = optionalText(source.workIntro, "Work with me summary", MEDIUM);
  }

  if (source.work && typeof source.work === "object") {
    next.work = { ...(next.work || {}) };
    assignPresent(next.work, source.work, WORK_FIELDS);
  }

  if (Object.prototype.hasOwnProperty.call(source, "offers")) {
    next.offers = mergeCards(site.offers, cards(source.offers, "Offer"));
  }
  if (Object.prototype.hasOwnProperty.call(source, "packages")) {
    next.packages = mergeCards(site.packages, cards(source.packages, "Way of working"));
  }

  if (source.credentials && typeof source.credentials === "object") {
    next.credentials = { ...(next.credentials || {}) };
    assignPresent(next.credentials, source.credentials, [
      { key: "title", label: "Also heading", max: SHORT },
      { key: "org", label: "Also text", max: LONG },
    ]);
  }

  return next;
}

export function stringifySite(site) {
  return `${JSON.stringify(site, null, 2)}\n`;
}
