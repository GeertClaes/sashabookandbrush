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
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
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

async function curlText(url, ua = USER_AGENT) {
  const { stdout } = await execFileP(
    CURL,
    ["-L", "--fail", "-sS", "-A", ua, url],
    { encoding: "utf8", timeout: 45000, maxBuffer: 8_000_000 },
  );
  return stdout;
}

function largerGoodreadsCover(url) {
  if (!url) return url;
  if (/nophoto|no-cover|nocover/i.test(url)) return "";
  return url
    .replace("http://", "https://")
    .replace(/\._[A-Z]{2}\d+_(?=\.)/g, "._SX800_");
}

async function goodreadsCoverUrl(id) {
  if (!id) return null;
  try {
    const html = await curlText(`https://www.goodreads.com/book/show/${id}`, BROWSER_UA);
    const og =
      html.match(/property="og:image"\s+content="([^"]+)"/i) ||
      html.match(/content="([^"]+)"\s+property="og:image"/i);
    let url = og?.[1] || "";
    if (!url) {
      const img = html.match(
        /https:\/\/[^"'\s]+compressed\.photo\.goodreads\.com\/books\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/i,
      );
      url = img?.[0] || "";
    }
    url = largerGoodreadsCover(url);
    return url || null;
  } catch {
    return null;
  }
}

function unescapeYaml(value) {
  return String(value)
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function frontField(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return "";
  let value = match[1].trim();
  if (value === "true" || value === "false") return value;
  if (/^-?\d+$/.test(value)) return value;
  if (value.startsWith('"') && value.endsWith('"')) {
    return unescapeYaml(value.slice(1, -1));
  }
  return value;
}

function parseFrontmatter(text) {
  const block = text.match(/^---\n([\s\S]*?)\n---/);
  if (!block) return {};
  const data = {};
  for (const line of block[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    data[key] = frontField(`---\n${line}\n---`, key);
  }
  return data;
}

function isRealUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function pickNote(siteNote, goodreadsNote) {
  const site = String(siteNote || "").trim();
  const incoming = String(goodreadsNote || "").trim();
  if (!site) return incoming;
  if (!incoming) return site;
  if (site === incoming) return site;
  if (site.length >= incoming.length) return site;
  return incoming;
}

function genericGenre(value) {
  return !value || value === "Read" || value === "Currently reading";
}

function upsertField(text, key, line) {
  if (new RegExp(`^${key}:`, "m").test(text)) {
    return text.replace(new RegExp(`^${key}:.*$`, "m"), line);
  }
  return text.replace(/\n---\s*$/, `\n${line}\n---`);
}

function stripPlaceholderAffiliates(text) {
  return text.replace(/^(bookshop|amazon):\s*["']?#["']?\s*\r?\n/gm, "");
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

async function downloadCover({ isbn, title, author, slug, goodreadsId, preferGoodreads = false }) {
  const cached = await existingLocalCover(slug);
  if (cached) return cached;

  const destBase = path.join(COVERS_DIR, slug);

  async function fromGoodreads() {
    const url = await goodreadsCoverUrl(goodreadsId);
    if (!url) return null;
    return trySaveImage(url, destBase);
  }

  if (preferGoodreads) {
    const saved = await fromGoodreads();
    if (saved) return saved;
  }

  if (isbn) {
    const fromIsbn = await trySaveImage(
      `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
      destBase,
    );
    if (fromIsbn) return fromIsbn;
  }

  if (!preferGoodreads) {
    const saved = await fromGoodreads();
    if (saved) return saved;
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

async function fillMissingCovers() {
  await mkdir(COVERS_DIR, { recursive: true });
  const names = (await readdir(BOOKS_DIR)).filter((name) => name.endsWith(".md"));
  const missing = [];
  for (const name of names) {
    const file = path.join(BOOKS_DIR, name);
    const text = await readFile(file, "utf8");
    const cover = frontField(text, "cover");
    const slug = path.basename(name, ".md");
    const cached = await existingLocalCover(slug);
    if (cover && cached && (cover === cached || cover.endsWith(`/${cached}`))) continue;
    if (cached && (!cover || cover.startsWith("/"))) {
      const updated = text.replace(/^cover:.*$/m, `cover: ${yamlString(cached)}`);
      await writeFile(file, updated.endsWith("\n") ? updated : `${updated}\n`, "utf8");
      missing.push({ file, name, slug, text: updated, title: frontField(updated, "title"), already: cached });
      continue;
    }
    missing.push({
      file,
      name,
      slug,
      text,
      title: frontField(text, "title"),
      author: frontField(text, "author"),
      isbn: frontField(text, "isbn"),
      goodreadsId: frontField(text, "goodreadsId"),
      already: null,
    });
  }

  const toFetch = missing.filter((book) => !book.already);
  console.log(`Missing covers: ${toFetch.length}. Checking Goodreads…`);

  let saved = 0;
  let stillMissing = 0;
  await mapLimit(toFetch, 2, async (book, index) => {
    const cover = await downloadCover({ ...book, preferGoodreads: true });
    if (cover) {
      const updated = book.text.replace(/^cover:.*$/m, `cover: ${yamlString(cover)}`);
      await writeFile(book.file, updated.endsWith("\n") ? updated : `${updated}\n`, "utf8");
      saved += 1;
      console.log(`  got ${book.title}`);
    } else {
      stillMissing += 1;
      console.log(`  no cover for ${book.title}`);
    }
    if ((index + 1) % 10 === 0 || index + 1 === toFetch.length) {
      console.log(`Covers ${index + 1}/${toFetch.length}`);
    }
    await sleep(250);
  });

  const relinked = missing.filter((book) => book.already).length;
  console.log(
    `Goodreads cover pass: saved ${saved}, already on disk ${relinked}, still missing ${stillMissing}.`,
  );
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

  const isbn13 = cleanIsbn(col(row, "ISBN13"));
  const isbn10 = cleanIsbn(col(row, "ISBN"));
  const isbn = isbn13.length === 13 ? isbn13 : isbn10 || isbn13;
  const status = isReading ? "currently-reading" : "read";
  const goodreadsId = col(row, "Book Id").trim();
  const existing = (goodreadsId && library.byId.get(goodreadsId)) || library.byTitle.get(key) || null;
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
    goodreadsId,
    dateRead: parseGoodreadsDate(col(row, "Date Read")),
    dateAdded: parseGoodreadsDate(col(row, "Date Added")),
    pages: Number(col(row, "Number of Pages")) || 0,
    yearPublished: parseYear(col(row, "Year Published")),
    originalYear: parseYear(col(row, "Original Publication Year")),
    publisher: col(row, "Publisher").trim(),
    readCount: Number(col(row, "Read Count")) || 0,
    slug: existing?.slug || slugify(`${title}-${author}`),
    existingFile: existing?.file || null,
    existingData: existing?.data || null,
  };

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

await mapLimit(toWrite, 4, async (book, index) => {
  const cached = await existingLocalCover(book.slug);
  if (args.skipCovers) {
    book.cover = cached || book.existingData?.cover || PLACEHOLDER;
  } else {
    book.cover = await downloadCover(book);
    if (book.cover === PLACEHOLDER) coversMissing += 1;
    else coversSaved += 1;
    if ((index + 1) % 20 === 0 || index + 1 === toWrite.length) {
      console.log(`Covers ${index + 1}/${toWrite.length}`);
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
