// Load a Goodreads library CSV, match it to the books on disk, write
// markdown, and optionally download covers.
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseFrontmatter,
  upsertField,
  yamlString,
} from "../functions/admin/api/_lib/frontmatter.js";
import { downloadCover, existingLocalCover, fillMissingCovers } from "./lib/cover-fetch.mjs";
import { bookFromRow, normalizeTitle, parseCsv, pickNote, slugify } from "./lib/goodreads-csv.mjs";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const BOOKS_DIR = path.join(ROOT, "src", "content", "books");
const COVERS_DIR = path.join(ROOT, "src", "assets", "covers");
const PLACEHOLDER = "";
const DEFAULT_NAMES = ["goodreads_library_export.csv", "export.csv"];
const CURATED = new Set([
  "acotar.md",
  "acomaf.md",
  "acowar.md",
  "acosf.md",
  "fourth-wing.md",
  "iron-flame.md",
  "onyx-storm.md",
  "wild-reverence.md",
  "evelyn-hugo.md",
  "the-names.md",
]);

function parseArgs(argv) {
  const args = { csv: null, minRating: 1, dryRun: false, skipCovers: false, missingCovers: false };
  for (const part of argv) {
    if (part === "--dry-run" || part === "--check") args.dryRun = true;
    else if (part === "--skip-covers") args.skipCovers = true;
    else if (part === "--missing-covers") args.missingCovers = true;
    else if (part.startsWith("--min-rating=")) args.minRating = Number(part.slice(13));
    else if (!part.startsWith("-")) args.csv = path.resolve(part);
  }
  return args;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function resolveCsv(explicit) {
  if (explicit) return explicit;
  for (const name of DEFAULT_NAMES) {
    const file = path.join(DATA_DIR, name);
    if (await exists(file)) return file;
  }
  try {
    const files = (await readdir(DATA_DIR)).filter((name) => name.toLowerCase().endsWith(".csv"));
    if (files.length === 1) return path.join(DATA_DIR, files[0]);
  } catch {
    // no data directory yet
  }
  return path.join(DATA_DIR, DEFAULT_NAMES[0]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapLimit(items, limit, fn) {
  const results = Array.from({ length: items.length });
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function loadExistingLibrary() {
  const names = (await readdir(BOOKS_DIR)).filter((name) => name.endsWith(".md"));
  const byId = new Map();
  const byTitle = new Map();
  const files = [];
  for (const name of names) {
    const file = path.join(BOOKS_DIR, name);
    const text = await readFile(file, "utf8");
    const data = parseFrontmatter(text);
    const rec = { file, name, slug: path.basename(name, ".md"), data };
    files.push(rec);
    if (data.goodreadsId) byId.set(String(data.goodreadsId), rec);
    if (data.title) byTitle.set(normalizeTitle(data.title), rec);
  }
  return { byId, byTitle, files };
}

function isRealUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function genericGenre(value) {
  return !value || value === "Read" || value === "Currently reading";
}

function stripPlaceholderAffiliates(text) {
  return text.replace(/^(bookshop|amazon):\s*["']?#["']?\s*\r?\n/gm, "");
}

function extraYaml(book) {
  const lines = [`status: ${yamlString(book.status)}`];
  if (book.isbn) lines.push(`isbn: ${yamlString(book.isbn)}`);
  if (book.isbn10) lines.push(`isbn10: ${yamlString(book.isbn10)}`);
  if (book.goodreadsId) lines.push(`goodreadsId: ${yamlString(book.goodreadsId)}`);
  if (book.dateRead) lines.push(`dateRead: ${yamlString(book.dateRead)}`);
  if (book.dateAdded) lines.push(`dateAdded: ${yamlString(book.dateAdded)}`);
  if (book.pages) lines.push(`pages: ${book.pages}`);
  if (book.yearPublished) lines.push(`yearPublished: ${book.yearPublished}`);
  if (book.originalYear) lines.push(`originalYear: ${book.originalYear}`);
  if (book.publisher) lines.push(`publisher: ${yamlString(book.publisher)}`);
  if (book.readCount) lines.push(`readCount: ${book.readCount}`);
  return lines;
}

function bookMarkdown(book) {
  return `---
title: ${yamlString(book.title)}
author: ${yamlString(book.author)}
cover: ${yamlString(book.cover)}
note: ${yamlString(book.note)}
rating: ${book.rating}
genre: ${yamlString(book.genre)}
featured: false
order: ${book.order}
${extraYaml(book).join("\n")}
---
`;
}

async function mergeIntoExisting(file, book, existing = {}) {
  let text = await readFile(file, "utf8");
  const skip = new Set();
  if (existing.cover) skip.add("cover");
  if (existing.featured === "true" || existing.featured === true) {
    skip.add("featured");
    skip.add("order");
  }
  if (CURATED.has(path.basename(file))) skip.add("order");
  if (isRealUrl(existing.bookshop)) skip.add("bookshop");
  if (isRealUrl(existing.amazon)) skip.add("amazon");
  if (!genericGenre(existing.genre)) skip.add("genre");

  const note = pickNote(existing.note, book.note);
  const fields = [
    `title: ${yamlString(book.title)}`,
    `author: ${yamlString(book.author)}`,
    book.cover ? `cover: ${yamlString(book.cover)}` : null,
    `note: ${yamlString(note)}`,
    `rating: ${book.rating}`,
    `genre: ${yamlString(book.genre)}`,
    isRealUrl(existing.bookshop) ? `bookshop: ${yamlString(existing.bookshop)}` : null,
    isRealUrl(existing.amazon) ? `amazon: ${yamlString(existing.amazon)}` : null,
    `featured: ${existing.featured === "true" || existing.featured === true ? "true" : "false"}`,
    `order: ${book.order}`,
    ...extraYaml(book),
  ].filter(Boolean);

  for (const line of fields) {
    const key = line.split(":")[0];
    if (skip.has(key)) continue;
    text = upsertField(text, key, line);
  }
  text = stripPlaceholderAffiliates(text);
  await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

const args = parseArgs(process.argv.slice(2));

if (args.missingCovers) {
  await fillMissingCovers();
  process.exit(0);
}

const csvPath = await resolveCsv(args.csv);

if (!(await exists(csvPath))) {
  console.error(`No CSV found at ${csvPath}
Export from Goodreads (desktop): My Books → Import and export → Export Library
Save the file as data/export.csv then run:
  npm run import:goodreads`);
  process.exit(1);
}

const raw = await readFile(csvPath, "utf8");
const [header, ...rows] = parseCsv(raw);
const index = Object.fromEntries(header.map((name, i) => [name.trim(), i]));
const col = (row, name) => row[index[name]] ?? "";

await mkdir(BOOKS_DIR, { recursive: true });
await mkdir(COVERS_DIR, { recursive: true });

const library = await loadExistingLibrary();

const seen = new Set();
const toWrite = [];
let ignored = 0;
let merged = 0;
let duplicates = 0;

for (const row of rows) {
  const shelf = col(row, "Exclusive Shelf").trim().toLowerCase();
  const rating = Number(col(row, "My Rating") || 0);
  const isReading = shelf === "currently-reading";
  const isRead = shelf === "read" && rating >= args.minRating;
  if (!isReading && !isRead) {
    ignored += 1;
    continue;
  }

  const title = col(row, "Title").trim();
  const author = col(row, "Author").trim();
  if (!title || !author) {
    ignored += 1;
    continue;
  }

  const key = normalizeTitle(title);
  if (seen.has(key)) {
    duplicates += 1;
    continue;
  }
  seen.add(key);

  const goodreadsId = col(row, "Book Id").trim();
  const existing =
    (goodreadsId && library.byId.get(goodreadsId)) || library.byTitle.get(key) || null;
  const book = bookFromRow(row, col, {
    status: isReading ? "currently-reading" : "read",
    slug: existing?.slug || slugify(`${title}-${author}`),
  });
  book.existingFile = existing?.file || null;
  book.existingData = existing?.data || null;
  toWrite.push(book);
}

toWrite.sort((a, b) => {
  if (a.status !== b.status) return a.status === "currently-reading" ? -1 : 1;
  return (b.dateRead || b.dateAdded || "").localeCompare(a.dateRead || a.dateAdded || "");
});
toWrite.forEach((book, i) => {
  book.order = book.status === "currently-reading" ? i : 1000 + i;
});

const newCount = toWrite.filter((book) => !book.existingFile).length;
const mergeCount = toWrite.length - newCount;

if (args.dryRun) {
  console.log(
    `Dry run from ${path.relative(ROOT, csvPath)}: would merge ${mergeCount} existing books, add ${newCount} new, skip ${duplicates} duplicate titles, ignore ${ignored} unread/unrated. Existing files are kept.`,
  );
  process.exit(0);
}

let coversSaved = 0;
let coversMissing = 0;

await mapLimit(toWrite, 4, async (book, position) => {
  const cached = await existingLocalCover(book.slug);
  if (args.skipCovers) {
    book.cover = cached || book.existingData?.cover || PLACEHOLDER;
  } else {
    book.cover = await downloadCover(book);
    if (book.cover === PLACEHOLDER) coversMissing += 1;
    else coversSaved += 1;
    if ((position + 1) % 20 === 0 || position + 1 === toWrite.length) {
      console.log(`Covers ${position + 1}/${toWrite.length}`);
    }
    await sleep(80);
  }
  if (book.existingFile) {
    merged += 1;
    await mergeIntoExisting(book.existingFile, book, book.existingData);
  } else {
    await writeFile(path.join(BOOKS_DIR, `${book.slug}.md`), bookMarkdown(book), "utf8");
  }
});

console.log(
  `Imported from ${path.relative(ROOT, csvPath)}: merged ${merged} existing books, added ${toWrite.length - merged} new. Skipped ${duplicates} duplicate titles. Ignored ${ignored} TBR/unrated. Covers saved: ${coversSaved}. Still using placeholder: ${coversMissing}. Existing notes, covers, featured flags, and custom affiliate URLs were kept.`,
);
