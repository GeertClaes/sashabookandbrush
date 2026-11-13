// Download a book cover from Goodreads, Open Library, or Google Books and
// store it under src/assets/covers. No function here calls the network unless
// a caller asks for a cover.
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rename, unlink, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { readYamlField, yamlString } from "../../functions/admin/api/_lib/frontmatter.js";

const ROOT = process.cwd();
const BOOKS_DIR = path.join(ROOT, "src", "content", "books");
const COVERS_DIR = path.join(ROOT, "src", "assets", "covers");
const PLACEHOLDER = "";
const USER_AGENT = "SashaBookAndBrush/1.0 (https://sashabookandbrush.com; cover cache)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const execFileP = promisify(execFile);
const CURL = process.platform === "win32" ? "curl.exe" : "curl";

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
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

async function curlFile(url, dest) {
  await execFileP(CURL, ["-L", "--fail", "-sS", "-A", USER_AGENT, "-o", dest, url], {
    timeout: 45000,
  });
}

async function curlText(url, ua = USER_AGENT) {
  const { stdout } = await execFileP(CURL, ["-L", "--fail", "-sS", "-A", ua, url], {
    encoding: "utf8",
    timeout: 45000,
    maxBuffer: 8_000_000,
  });
  return stdout;
}

export function largerGoodreadsCover(url) {
  if (!url) return url;
  if (/nophoto|no-cover|nocover/i.test(url)) return "";
  return url.replace("http://", "https://").replace(/\._[A-Z]{2}\d+_(?=\.)/g, "._SX800_");
}

function shortTitle(value) {
  return String(value)
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
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

export async function existingLocalCover(slug) {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const file = path.join(COVERS_DIR, `${slug}${ext}`);
    if (await exists(file)) return `${slug}${ext}`;
  }
  return null;
}

export async function downloadCover({
  isbn,
  title,
  author,
  slug,
  goodreadsId,
  preferGoodreads = false,
}) {
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

export async function fillMissingCovers() {
  await mkdir(COVERS_DIR, { recursive: true });
  const names = (await readdir(BOOKS_DIR)).filter((name) => name.endsWith(".md"));
  const missing = [];
  for (const name of names) {
    const file = path.join(BOOKS_DIR, name);
    const text = await readFile(file, "utf8");
    const cover = readYamlField(text, "cover");
    const slug = path.basename(name, ".md");
    const cached = await existingLocalCover(slug);
    if (cover && cached && (cover === cached || cover.endsWith(`/${cached}`))) continue;
    if (cached && (!cover || cover.startsWith("/"))) {
      const updated = text.replace(/^cover:.*$/m, `cover: ${yamlString(cached)}`);
      await writeFile(file, updated.endsWith("\n") ? updated : `${updated}\n`, "utf8");
      missing.push({
        file,
        name,
        slug,
        text: updated,
        title: readYamlField(updated, "title"),
        already: cached,
      });
      continue;
    }
    missing.push({
      file,
      name,
      slug,
      text,
      title: readYamlField(text, "title"),
      author: readYamlField(text, "author"),
      isbn: readYamlField(text, "isbn"),
      goodreadsId: readYamlField(text, "goodreadsId"),
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
