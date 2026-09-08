import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const ROOT = process.cwd();
const site = JSON.parse(await readFile(path.join(ROOT, "src", "data", "site.json"), "utf8"));
const USER_ID = site.goodreads?.userId || "141471789";
const OUT = path.join(ROOT, "src", "data", "goodreads-live.json");
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

  if (currentlyReading.length === 0) {
    let previous = { currentlyReading: [] };
    try {
      previous = JSON.parse(await readFile(OUT, "utf8"));
    } catch {
      // first run
    }
    if (previous.currentlyReading?.length) {
      console.warn("Goodreads RSS returned no currently-reading books; keeping the previous live file.");
      process.exit(0);
    }
  }

  const payload = {
    updated: new Date().toISOString(),
    currentlyReading,
    upNext,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${path.relative(ROOT, OUT)}: ${currentlyReading.length} currently reading, ${upNext.length} up next.`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (ALLOW_FAIL) {
    console.warn(`Goodreads sync skipped (${message}). Using the last committed live file.`);
    process.exit(0);
  }
  throw error;
}
