import { mkdir, readFile, readdir, writeFile, access, unlink, rename } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const BOOKS_DIR = path.join(ROOT, "src", "content", "books");
const COVERS_DIR = path.join(ROOT, "src", "assets", "covers");
const PLACEHOLDER = "";
const USER_AGENT = "SashaBookAndBrush/1.0 (https://sashabookandbrush.com; cover cache)";
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
  const args = { csv: null, minRating: 1, dryRun: false, skipCovers: false };
  for (const part of argv) {
    if (part === "--dry-run" || part === "--check") args.dryRun = true;
    else if (part === "--skip-covers") args.skipCovers = true;
    else if (part.startsWith("--min-rating=")) args.minRating = Number(part.slice(13));
    else if (!part.startsWith("-")) args.csv = path.resolve(part);
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

function normalizeTitle(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function shortTitle(value) {
  return String(value)
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
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

function parseGoodreadsDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.replace(/\//g, "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function parseYear(value) {
  const match = String(value || "").match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function cleanReview(text) {
  let value = String(text || "");
  value = value.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  value = value.replace(/<\s*\/\s*p\s*>/gi, "\n\n");
  value = value.replace(/<\s*p(?:\s[^>]*)?>/gi, "");
  value = value.replace(/<\s*\/?\s*div[^>]*>/gi, "\n");
  value = value.replace(/<[^>]+>/g, "");
  value = decodeEntities(value);
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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

const execFileP = promisify(execFile);
const CURL = process.platform === "win32" ? "curl.exe" : "curl";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
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

async function curlFile(url, dest) {
  await execFileP(CURL, ["-L", "--fail", "-sS", "-A", USER_AGENT, "-o", dest, url], { timeout: 45000 });
}

async function curlText(url) {
  const { stdout } = await execFileP(
    CURL,
    ["-L", "--fail", "-sS", "-A", USER_AGENT, url],
    { encoding: "utf8", timeout: 30000, maxBuffer: 8_000_000 },
  );
  return stdout;
}

async function trySaveImage(url, destBase) {
  const tmp = `${destBase}.download`;
  try {
    await curlFile(url, tmp);
    const buffer = await readFile(tmp);
    if (buffer.length < 2500) return null;
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return null;
    let ext = ".jpg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50) ext = ".png";
    else if (buffer[0] === 0x52 && buffer[1] === 0x49) ext = ".webp";
    const dest = `${destBase}${ext}`;
    if (await exists(dest)) await unlink(dest);
    await rename(tmp, dest);
    return path.basename(dest);
  } catch {
    return null;
  } finally {
    if (await exists(tmp)) await unlink(tmp).catch(() => {});
  }
}

async function googleCoverUrl(isbn, title, author) {
  const queries = [];
  if (isbn) queries.push(`isbn:${isbn}`);
  queries.push(`intitle:${shortTitle(title)} inauthor:${author}`);
  for (const query of queries) {
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`;
      const data = JSON.parse(await curlText(url));
      const links = data.items?.[0]?.volumeInfo?.imageLinks;
      const raw =
        links?.extraLarge ||
        links?.large ||
        links?.medium ||
        links?.thumbnail ||
        links?.smallThumbnail;
      if (!raw) continue;
      return raw
        .replace("http://", "https://")
        .replace("&edge=curl", "")
        .replace("zoom=5", "zoom=2")
        .replace("zoom=1", "zoom=2");
    } catch {
      // try next query
    }
  }
  return null;
}

async function openLibrarySearchCover(title, author) {
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(shortTitle(title))}&author=${encodeURIComponent(author)}&limit=1`;
    const data = JSON.parse(await curlText(url));
    const coverId = data.docs?.[0]?.cover_i;
    if (!coverId) return null;
    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`;
  } catch {
    return null;
  }
}

async function existingLocalCover(slug) {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const file = path.join(COVERS_DIR, `${slug}${ext}`);
    if (await exists(file)) return `${slug}${ext}`;
  }
  return null;
}

async function downloadCover({ isbn, title, author, slug }) {
  const cached = await existingLocalCover(slug);
  if (cached) return cached;

  const destBase = path.join(COVERS_DIR, slug);
  if (isbn) {
    const fromIsbn = await trySaveImage(
      `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
      destBase,
    );
    if (fromIsbn) return fromIsbn;
  }

  const fromSearch = await openLibrarySearchCover(title, author);
  if (fromSearch) {
    const saved = await trySaveImage(fromSearch, destBase);
    if (saved) return saved;
  }

  const fromGoogle = await googleCoverUrl(isbn, title, author);
  if (fromGoogle) {
    const saved = await trySaveImage(fromGoogle, destBase);
    if (saved) return saved;
  }

  return PLACEHOLDER;
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
bookshop: "#"
amazon: "#"
featured: false
order: ${book.order}
${extraYaml(book).join("\n")}
---
`;
}

async function mergeIntoCurated(file, book) {
  let text = await readFile(file, "utf8");
  const fields = extraYaml(book);
  if (book.cover) fields.unshift(`cover: ${yamlString(book.cover)}`);
  for (const line of fields) {
    const key = line.split(":")[0];
    if (new RegExp(`^${key}:`, "m").test(text)) {
      text = text.replace(new RegExp(`^${key}:.*$`, "m"), line);
    } else {
      text = text.replace(/\n---\s*$/, `\n${line}\n---`);
    }
  }
  await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

const args = parseArgs(process.argv.slice(2));
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

const curatedByTitle = new Map();
for (const name of CURATED) {
  const file = path.join(BOOKS_DIR, name);
  if (!(await exists(file))) continue;
  const text = await readFile(file, "utf8");
  const match = text.match(/^title:\s*"((?:\\.|[^"])*)"/m);
  if (match) curatedByTitle.set(normalizeTitle(match[1].replace(/\\"/g, '"')), file);
}

const seen = new Set();
const toWrite = [];
let ignored = 0;
let curated = 0;
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

  const isbn13 = cleanIsbn(col(row, "ISBN13"));
  const isbn10 = cleanIsbn(col(row, "ISBN"));
  const isbn = isbn13.length === 13 ? isbn13 : isbn10 || isbn13;
  const status = isReading ? "currently-reading" : "read";
  const book = {
    title,
    author,
    note: cleanReview(col(row, "My Review")),
    rating,
    genre: isReading && !col(row, "Bookshelves").replace(/currently-reading/gi, "").trim()
      ? "Currently reading"
      : genreFromShelves(col(row, "Bookshelves")),
    status,
    isbn,
    isbn10: isbn10.length === 10 ? isbn10 : "",
    goodreadsId: col(row, "Book Id").trim(),
    dateRead: parseGoodreadsDate(col(row, "Date Read")),
    dateAdded: parseGoodreadsDate(col(row, "Date Added")),
    pages: Number(col(row, "Number of Pages")) || 0,
    yearPublished: parseYear(col(row, "Year Published")),
    originalYear: parseYear(col(row, "Original Publication Year")),
    publisher: col(row, "Publisher").trim(),
    readCount: Number(col(row, "Read Count")) || 0,
    slug: slugify(`${title}-${author}`),
    curatedFile: curatedByTitle.get(key) || null,
  };

  if (book.curatedFile) {
    curated += 1;
    book.slug = path.basename(book.curatedFile, ".md");
    if (!args.dryRun) {
      book.cover = args.skipCovers ? (await existingLocalCover(book.slug)) || "" : await downloadCover(book);
      await mergeIntoCurated(book.curatedFile, book);
    }
    continue;
  }

  toWrite.push(book);
}

if (!args.dryRun) {
  const existing = await readdir(BOOKS_DIR);
  for (const name of existing) {
    if (name.endsWith(".md") && !CURATED.has(name)) {
      await unlink(path.join(BOOKS_DIR, name));
    }
  }
}

toWrite.sort((a, b) => {
  if (a.status !== b.status) return a.status === "currently-reading" ? -1 : 1;
  return (b.dateRead || b.dateAdded || "").localeCompare(a.dateRead || a.dateAdded || "");
});
toWrite.forEach((book, i) => {
  book.order = book.status === "currently-reading" ? i : 1000 + i;
});

if (args.dryRun) {
  console.log(
    `Dry run from ${path.relative(ROOT, csvPath)}: would import ${toWrite.length} books, update ${curated} existing picks, skip ${duplicates} duplicate titles, ignore ${ignored} unread/unrated.`,
  );
  process.exit(0);
}

let coversSaved = 0;
let coversMissing = 0;

await mapLimit(toWrite, 4, async (book, index) => {
  if (args.skipCovers) {
    book.cover = PLACEHOLDER;
  } else {
    book.cover = await downloadCover(book);
    if (book.cover === PLACEHOLDER) coversMissing += 1;
    else coversSaved += 1;
    if ((index + 1) % 20 === 0 || index + 1 === toWrite.length) {
      console.log(`Covers ${index + 1}/${toWrite.length}`);
    }
    await sleep(80);
  }
  await writeFile(path.join(BOOKS_DIR, `${book.slug}.md`), bookMarkdown(book), "utf8");
});

console.log(
  `Imported ${toWrite.length} books from ${path.relative(ROOT, csvPath)}. Updated ${curated} existing picks with ISBN/dates/status. Skipped ${duplicates} duplicate titles. Ignored ${ignored} TBR/unrated. Covers saved: ${coversSaved}. Still using placeholder: ${coversMissing}.`,
);
