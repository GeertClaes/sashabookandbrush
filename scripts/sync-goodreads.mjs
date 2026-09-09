import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  ACTIVITY_FILE,
  appendActivity,
  describeReadingChanges,
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
  const { stdout } = await execFileP(
    CURL,
    ["-L", "--fail", "-sS", "-A", BROWSER_UA, url],
    { encoding: "utf8", timeout: 45000, maxBuffer: 8_000_000 },
  );
  return stdout;
}

function tagValue(chunk, tag) {
  const match = chunk.match(
    new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`, "i"),
  );
  return (match?.[1] || match?.[2] || "").trim();
}

function rssItems(xml) {
  return xml
    .split(/<item[\s>]/i)
    .slice(1)
    .map((chunk) => ({
      title: tagValue(chunk, "title").replace(/\s+/g, " ").trim(),
      author: tagValue(chunk, "author_name"),
      goodreadsId: tagValue(chunk, "book_id"),
      isbn: tagValue(chunk, "isbn").replace(/[^\dXx]/g, ""),
      image: tagValue(chunk, "book_large_image_url") || tagValue(chunk, "book_image_url"),
    }))
    .filter((item) => item.title);
}

function progressFromUpdates(xml) {
  const progress = {};
  const titles = [...xml.matchAll(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/g)].map((match) =>
    match[1].replace(/\s+/g, " ").trim(),
  );
  for (const title of titles) {
    const match = title.match(/is\s+(\d+)%\s+done with\s+(.+)$/i);
    if (match) progress[match[2].trim().toLowerCase()] = Number(match[1]);
  }
  return progress;
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
const source = process.env.CF_PAGES === "1" ? "pages-build" : "local";

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
  };
}

try {
  const [readingXml, tbrXml, updatesXml] = await Promise.all([
    curlText(`https://www.goodreads.com/review/list_rss/${USER_ID}?shelf=currently-reading`),
    curlText(`https://www.goodreads.com/review/list_rss/${USER_ID}?shelf=to-read`),
    curlText(`https://www.goodreads.com/user/updates_rss/${USER_ID}`),
  ]);

  const progress = progressFromUpdates(updatesXml);
  const currentlyReading = rssItems(readingXml).map((book) => {
    const percent =
      progress[book.title.toLowerCase()] ??
      progress[baseTitle(book.title)] ??
      Object.entries(progress).find(
        ([name]) =>
          baseTitle(book.title).includes(baseTitle(name)) || baseTitle(name).includes(baseTitle(book.title)),
      )?.[1];
    return { ...book, progress: typeof percent === "number" ? percent : null };
  });

  const upNext = rssItems(tbrXml).slice(0, 8);

  if (currentlyReading.length === 0 && previous.currentlyReading?.length) {
    const warning = "Goodreads RSS returned no currently-reading books; kept the previous shelf.";
    console.warn(warning);
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
      type: "goodreads",
      ok: false,
      title: "Goodreads RSS sync",
      detail: warning,
      by: source,
    });
    process.exit(0);
  }

  const changes = describeReadingChanges(previous.currentlyReading || [], currentlyReading);
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

  await writeLive(payload);
  const changeText = changes.length ? changes.join("; ") : "No changes to currently reading.";
  await writeActivity({
    type: "goodreads",
    ok: true,
    title: "Goodreads RSS sync",
    detail: `${currentlyReading.length} currently reading, ${upNext.length} up next. ${changeText}`,
    by: source,
  });
  console.log(
    `Wrote ${path.relative(ROOT, OUT)}: ${currentlyReading.length} currently reading, ${upNext.length} up next.`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
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
    type: "goodreads",
    ok: false,
    title: "Goodreads RSS sync failed",
    detail: message,
    by: source,
  });
  if (ALLOW_FAIL) {
    console.warn(`Goodreads sync skipped (${message}). Using the last committed live file.`);
    process.exit(0);
  }
  throw error;
}
