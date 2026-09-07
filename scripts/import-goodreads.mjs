import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_CSV = path.join(ROOT, "data", "goodreads_library_export.csv");
const BOOKS_DIR = path.join(ROOT, "src", "content", "books");

function parseArgs(argv) {
  const args = { csv: DEFAULT_CSV, minRating: 1, force: false, dryRun: false };
  for (const part of argv) {
    if (part === "--force") args.force = true;
    else if (part === "--dry-run") args.dryRun = true;
    else if (part.startsWith("--csv=")) args.csv = path.resolve(part.slice(6));
    else if (part.startsWith("--min-rating=")) args.minRating = Number(part.slice(13));
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return slug || "book";
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`;
}

function cleanIsbn(value) {
  return String(value || "").replace(/[^\dXx]/g, "");
}

function genreFromShelves(shelves) {
  const skip = new Set([
    "read",
    "currently-reading",
    "to-read",
    "favorites",
    "favourites",
    "owned",
    "ebooks",
    "kindle",
    "dnf",
  ]);
  const names = String(shelves || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const match = names.find((name) => !skip.has(name.toLowerCase()));
  if (!match) return "Read";
  return match.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const args = parseArgs(process.argv.slice(2));

if (!(await exists(args.csv))) {
  console.error(`No CSV found at ${args.csv}
Export from Goodreads (desktop): My Books → Import and export → Export Library
Save the file as data/goodreads_library_export.csv then run:
  npm run import:goodreads`);
  process.exit(1);
}

const raw = await readFile(args.csv, "utf8");
const [header, ...rows] = parseCsv(raw);
const index = Object.fromEntries(header.map((name, i) => [name.trim(), i]));
const col = (row, name) => row[index[name]] ?? "";

await mkdir(BOOKS_DIR, { recursive: true });

let written = 0;
let skipped = 0;
let ignored = 0;

for (const row of rows) {
  const shelf = col(row, "Exclusive Shelf").trim().toLowerCase();
  const rating = Number(col(row, "My Rating") || 0);
  if (shelf !== "read" || rating < args.minRating) {
    ignored += 1;
    continue;
  }

  const title = col(row, "Title").trim();
  const author = col(row, "Author").trim();
  if (!title || !author) {
    ignored += 1;
    continue;
  }

  const isbn = cleanIsbn(col(row, "ISBN13") || col(row, "ISBN"));
  const note = col(row, "My Review").trim();
  const cover = isbn
    ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
    : "/images/covers/placeholder.svg";
  const slug = slugify(`${title}-${author}`);
  const file = path.join(BOOKS_DIR, `${slug}.md`);

  if (!args.force && (await exists(file))) {
    skipped += 1;
    continue;
  }

  const body = `---
title: ${yamlString(title)}
author: ${yamlString(author)}
cover: ${yamlString(cover)}
note: ${yamlString(note)}
rating: ${rating}
genre: ${yamlString(genreFromShelves(col(row, "Bookshelves")))}
bookshop: "#"
amazon: "#"
featured: false
order: ${1000 + written}
---
`;

  if (!args.dryRun) {
    await writeFile(file, body, "utf8");
  }
  written += 1;
}

console.log(
  args.dryRun
    ? `Dry run: would add ${written} rated/read books (${skipped} already exist, ${ignored} skipped).`
    : `Imported ${written} books. Skipped ${skipped} existing files. Ignored ${ignored} unread/unrated rows.`,
);
