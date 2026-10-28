import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  ACTIVITY_FILE,
  appendActivity,
  describeReadingChanges,
  describeUpNextChanges,
  formatSyncDetail,
  parseActivityLog,
  stringifyActivity,
} from "./lib/activity.mjs";

const ROOT = process.cwd();
const site = JSON.parse(await readFile(path.join(ROOT, "src", "data", "site.json"), "utf8"));
const USER_ID = site.goodreads?.userId || "141471789";
const OUT = path.join(ROOT, "src", "data", "goodreads-live.json");
const PUBLIC_OUT = path.join(ROOT, "public", "data", "goodreads-live.json");
const ACTIVITY_PATH = path.join(ROOT, ACTIVITY_FILE);
const ALLOW_FAIL = process.argv.includes("--allow-fail");
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const CURL = process.platform === "win32" ? "curl.exe" : "curl";
const execFileP = promisify(execFile);

async function curlText(url) {
  try {
    const { stdout } = await execFileP(
      CURL,
      ["-L", "--fail", "-sS", "-A", BROWSER_UA, url],
      { encoding: "utf8", timeout: 45000, maxBuffer: 8_000_000 },
    );
    return stdout;
  } catch (error) {
    const stderr = typeof error?.stderr === "string" ? error.stderr : "";
    const status = stderr.match(/returned error:\s*(\d+)/)?.[1];
    const where = url.replace(/^https:\/\/www\.goodreads\.com/, "");
    if (status) throw new Error(`Goodreads returned HTTP ${status} for ${where}`);
    throw new Error(`Could not reach Goodreads (${where}).`);
  }
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'")
    .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits) => String.fromCodePoint(parseInt(digits, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, ""));
}

function largerCover(url) {
  return String(url || "").replace(/\._[A-Z]{2}\d+(?=\.(?:jpe?g|png)\b)/i, "");
}

function shelfCount(html, shelf) {
  const match = html.match(new RegExp(`shelf=${shelf}[^>]*>[^<]*\\((\\d+)\\)`, "i"));
  return match ? Number(match[1]) : null;
}

function percentIn(chunk) {
  const labeled = chunk.match(/\((\d{1,3})%\)/);
  const bar = chunk.match(/style="width:\s*(\d{1,3})%[^"]*"[^>]*class="graphBar"|class="graphBar"[^>]*style="width:\s*(\d{1,3})%/i);
  const raw = labeled?.[1] || bar?.[1] || bar?.[2];
  if (raw == null) return undefined;
  const percent = Number(raw);
  if (!Number.isFinite(percent)) return undefined;
  return Math.min(100, Math.max(0, percent));
}

// The public profile still lists currently-reading books. Shelf RSS routes return 404.
function booksFromProfile(html) {
  if (/<title>\s*Sign in\b/i.test(html)) {
    throw new Error("Goodreads asked for a sign-in instead of the public profile.");
  }
  const count = shelfCount(html, "currently-reading");
  const start = html.indexOf('id="currentlyReadingReviews"');
  if (start < 0) {
    if (count === 0) return [];
    throw new Error("Goodreads profile did not include the currently-reading shelf.");
  }
  const end = html.indexOf("bigBoxBottom", start);
  const block = html.slice(start, end === -1 ? undefined : end);
  const books = block
    .split(/<div class="Updates\b/i)
    .slice(1)
    .map((chunk) => {
      const titleMatch = chunk.match(
        /<a class="bookTitle" href="(?:https:\/\/www\.goodreads\.com)?\/book\/show\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
      );
      if (!titleMatch) return null;
      const authors = [...chunk.matchAll(/<a class="authorName"[^>]*>([\s\S]*?)<\/a>/gi)].map((match) =>
        stripTags(match[1]),
      );
      const image = chunk.match(/<img[^>]+src="(https:\/\/[^"]+)"/i)?.[1] || "";
      return {
        title: stripTags(titleMatch[2]),
        author: authors.filter(Boolean).join(", "),
        goodreadsId: titleMatch[1],
        isbn: "",
        image: largerCover(image),
        progress: percentIn(chunk),
      };
    })
    .filter((book) => book?.title && book.goodreadsId);
  if (count != null && books.length < count) {
    throw new Error(
      `Goodreads profile lists ${count} currently-reading books, but only ${books.length} could be read.`,
    );
  }
  return books;
}

function widgetHtml(source) {
  const marker = "var widget_code = '";
  const start = source.indexOf(marker);
  if (start < 0) return null;
  let html = "";
  let i = start + marker.length;
  while (i < source.length) {
    const char = source[i];
    if (char === "\\") {
      const next = source[i + 1];
      if (next === "n") html += "\n";
      else if (next === "r") html += "\r";
      else if (next === "t") html += "\t";
      else if (next === "u" && /^[0-9a-fA-F]{4}/.test(source.slice(i + 2, i + 6))) {
        html += String.fromCharCode(parseInt(source.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      } else html += next || "";
      i += 2;
      continue;
    }
    if (char === "'") return html;
    html += char;
    i += 1;
  }
  return null;
}

// The to-read shelf page asks for a sign-in. The public grid widget still returns the books.
function booksFromWidget(source) {
  const html = widgetHtml(source);
  if (html == null) throw new Error("Goodreads to-read widget did not return a book list.");
  const books = [];
  const pattern =
    /<a title="([^"]*)"[^>]*href="https:\/\/www\.goodreads\.com\/review\/show\/\d+[^"]*"[^>]*>\s*<img\b([^>]*)>/gi;
  for (const match of html.matchAll(pattern)) {
    const img = match[2];
    const src = img.match(/\bsrc="([^"]+)"/i)?.[1] || "";
    const goodreadsId = src.match(/\/(\d+)(?:\._[A-Z]{2}\d+_)?\.(?:jpe?g|png)\b/i)?.[1] || "";
    const title = decodeEntities(match[1]) || decodeEntities(img.match(/\balt="([^"]*)"/i)?.[1] || "");
    if (!title || !goodreadsId) continue;
    books.push({
      title,
      author: "",
      goodreadsId,
      isbn: "",
      image: largerCover(src),
    });
  }
  return books;
}

function knownBooks(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const book of list || []) {
      if (book?.goodreadsId) map.set(String(book.goodreadsId), book);
    }
  }
  return map;
}

async function bookMeta(id) {
  const html = await curlText(`https://www.goodreads.com/book/show/${id}`);
  const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) return {};
  try {
    const data = JSON.parse(decodeEntities(raw));
    const authors = Array.isArray(data.author) ? data.author : data.author ? [data.author] : [];
    return {
      title: decodeEntities(data.name || ""),
      author: authors
        .map((author) => decodeEntities(author?.name || ""))
        .filter(Boolean)
        .join(", "),
      isbn: String(data.isbn || "").replace(/[^\dXx]/g, ""),
      image: typeof data.image === "string" ? data.image : "",
    };
  } catch {
    return {};
  }
}

async function fillMissing(book, known) {
  const prev = known.get(String(book.goodreadsId || ""));
  let title = book.title || prev?.title || "";
  let author = book.author || prev?.author || "";
  let isbn = book.isbn || prev?.isbn || "";
  let image = prev?.image || book.image || "";
  if ((!author || !title) && book.goodreadsId) {
    const meta = await bookMeta(book.goodreadsId);
    title = title || meta.title || "";
    author = author || meta.author || "";
    isbn = isbn || meta.isbn || "";
    image = image || largerCover(meta.image || "");
  }
  return { title, author, isbn, image };
}

function previousProgress(previousBooks, book) {
  const list = previousBooks || [];
  const prev =
    (book.goodreadsId && list.find((item) => item.goodreadsId === book.goodreadsId)) ||
    list.find(
      (item) => baseTitle(item.title) === baseTitle(book.title) || item.title.toLowerCase() === book.title.toLowerCase(),
    );
  return typeof prev?.progress === "number" ? prev.progress : undefined;
}

function baseTitle(value) {
  return String(value)
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

function readingSummary(books = []) {
  return books.map((book) => ({
    title: book.title,
    progress: typeof book.progress === "number" ? book.progress : null,
  }));
}

async function writeActivity(entry) {
  if (process.env.CF_PAGES === "1") return;
  const log = parseActivityLog(await readFile(ACTIVITY_PATH, "utf8").catch(() => ""));
  await mkdir(path.dirname(ACTIVITY_PATH), { recursive: true });
  await writeFile(ACTIVITY_PATH, stringifyActivity(appendActivity(log, entry)), "utf8");
}

async function writeLive(payload) {
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, text, "utf8");
  await mkdir(path.dirname(PUBLIC_OUT), { recursive: true });
  await writeFile(PUBLIC_OUT, text, "utf8");
}

const previous = await readJson(OUT, { currentlyReading: [], upNext: [] });
const source =
  process.env.GITHUB_ACTIONS === "true" ? "github-actions" : process.env.CF_PAGES === "1" ? "pages-build" : "local";

function shelfSnapshot(data) {
  return JSON.stringify({
    currentlyReading: data?.currentlyReading || [],
    upNext: data?.upNext || [],
  });
}

// Cloudflare's build network is rejected by Goodreads' CloudFront (HTTP 403).
// The scheduled GitHub Action fetches the feeds and commits this file.
// The Pages build only publishes that committed copy.
if (process.env.CF_PAGES === "1") {
  try {
    const text = await readFile(OUT, "utf8");
    await mkdir(path.dirname(PUBLIC_OUT), { recursive: true });
    await writeFile(PUBLIC_OUT, text.endsWith("\n") ? text : `${text}\n`, "utf8");
    console.log("Using the committed Goodreads shelf.");
  } catch {
    console.warn("No committed Goodreads shelf to publish.");
  }
  process.exit(0);
}

function lastSyncFields({ ok, changes = [], warning = "", error = "", currentlyReading, upNext }) {
  return {
    at: new Date().toISOString(),
    ok,
    source,
    readingCount: currentlyReading.length,
    upNextCount: upNext.length,
    changes,
    warning: warning || null,
    error: error || null,
    reading: readingSummary(currentlyReading),
    upNext: (upNext || []).map((book) => ({ title: book.title })),
  };
}

try {
  const profileUrl = site.goodreads?.profile || `https://www.goodreads.com/user/show/${USER_ID}`;
  const widgetUrl =
    `https://www.goodreads.com/review/grid_widget/${USER_ID}` +
    "?cover_size=medium&num_books=8&order=d&shelf=to-read&sort=date_added&widget_id=1";
  const [profileHtml, widgetSource] = await Promise.all([curlText(profileUrl), curlText(widgetUrl)]);
  const known = knownBooks([previous.currentlyReading, previous.upNext]);
  const parsedReading = booksFromProfile(profileHtml);
  const currentlyReading = [];
  for (const book of parsedReading) {
    const prev = known.get(String(book.goodreadsId));
    const details = prev
      ? {
          title: prev.title || book.title,
          author: book.author || prev.author || "",
          isbn: prev.isbn || "",
          image: prev.image || book.image,
        }
      : await fillMissing(book, known);
    const percent = book.progress ?? previousProgress(previous.currentlyReading, book);
    currentlyReading.push({
      title: details.title,
      author: details.author,
      goodreadsId: String(book.goodreadsId),
      isbn: details.isbn || "",
      image: details.image,
      progress: typeof percent === "number" ? percent : null,
    });
  }

  const parsedNext = booksFromWidget(widgetSource).slice(0, 8);
  if (parsedNext.length === 0 && previous.upNext?.length) {
    throw new Error("Goodreads to-read widget returned no books.");
  }
  const upNext = [];
  for (const book of parsedNext) {
    const prev = known.get(String(book.goodreadsId));
    if (prev) {
      upNext.push({
        title: prev.title || book.title,
        author: prev.author || book.author,
        goodreadsId: String(book.goodreadsId),
        isbn: prev.isbn || "",
        image: prev.image || book.image,
      });
      continue;
    }
    const details = await fillMissing(book, known);
    upNext.push({
      title: details.title,
      author: details.author,
      goodreadsId: String(book.goodreadsId),
      isbn: details.isbn || "",
      image: details.image,
    });
  }

  if (currentlyReading.length === 0 && previous.currentlyReading?.length) {
    const warning = "Goodreads returned no currently-reading books; kept the previous shelf.";
    console.warn(warning);
    if (previous.lastSync?.ok === false && previous.lastSync?.warning === warning) process.exit(0);
    const lastSync = lastSyncFields({
      ok: false,
      warning,
      currentlyReading: previous.currentlyReading,
      upNext: previous.upNext || [],
      changes: [],
    });
    await writeLive({
      ...previous,
      updated: previous.updated || lastSync.at,
      lastSync,
    });
    await writeActivity({
      at: lastSync.at,
      type: "goodreads",
      ok: false,
      title: "Goodreads shelf sync",
      detail: formatSyncDetail({
        currentlyReading: previous.currentlyReading,
        upNext: previous.upNext || [],
        ok: false,
        warning,
      }),
      by: source,
    });
    process.exit(0);
  }

  const changes = [
    ...describeReadingChanges(previous.currentlyReading || [], currentlyReading),
    ...describeUpNextChanges(previous.upNext || [], upNext),
  ];
  const lastSync = lastSyncFields({
    ok: true,
    changes,
    currentlyReading,
    upNext,
  });
  const payload = {
    updated: lastSync.at,
    lastSync,
    currentlyReading,
    upNext,
  };

  if (shelfSnapshot(previous) === shelfSnapshot(payload) && previous.lastSync?.ok !== false) {
    console.log("Goodreads shelf unchanged.");
    process.exit(0);
  }

  await writeLive(payload);
  await writeActivity({
    at: lastSync.at,
    type: "goodreads",
    ok: true,
    title: "Goodreads shelf sync",
    detail: formatSyncDetail({ currentlyReading, upNext, changes, ok: true }),
    by: source,
  });
  console.log(
    `Wrote ${path.relative(ROOT, OUT)}: ${currentlyReading.length} currently reading, ${upNext.length} up next.`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (previous.lastSync?.ok === false && previous.lastSync?.error === message) {
    console.warn(`Goodreads sync failed again (${message}).`);
    if (ALLOW_FAIL) process.exit(0);
    process.exit(1);
  }
  const lastSync = lastSyncFields({
    ok: false,
    error: message,
    currentlyReading: previous.currentlyReading || [],
    upNext: previous.upNext || [],
    changes: [],
  });
  await writeLive({
    ...previous,
    updated: previous.updated || lastSync.at,
    lastSync,
  });
  await writeActivity({
    at: lastSync.at,
    type: "goodreads",
    ok: false,
    title: "Goodreads shelf sync failed",
    detail: formatSyncDetail({
      currentlyReading: previous.currentlyReading || [],
      upNext: previous.upNext || [],
      ok: false,
      error: message,
    }),
    by: source,
  });
  if (ALLOW_FAIL) {
    console.warn(`Goodreads sync skipped (${message}). Using the last committed live file.`);
    process.exit(0);
  }
  throw error;
}
