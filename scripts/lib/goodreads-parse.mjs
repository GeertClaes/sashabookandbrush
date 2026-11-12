// Pure HTML/string parsing for the Goodreads profile + to-read widget pages.
// Extracted from sync-goodreads.mjs (no network, no filesystem) so the
// regex-heavy scraping logic — the most fragile part of the sync pipeline —
// can be exercised with fixed HTML fixtures in tests.

export function decodeEntities(value) {
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

export function stripTags(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, ""));
}

export function largerCover(url) {
  // Goodreads' real thumbnail suffix includes a trailing underscore before the
  // extension (e.g. "._SX98_.jpg") — this used to be missing, so largerCover()
  // silently never stripped it and covers stayed at thumbnail size.
  return String(url || "").replace(/\._[A-Z]{2}\d+_?(?=\.(?:jpe?g|png)\b)/i, "");
}

export function shelfCount(html, shelf) {
  const match = html.match(new RegExp(`shelf=${shelf}[^>]*>[^<]*\\((\\d+)\\)`, "i"));
  return match ? Number(match[1]) : null;
}

export function percentIn(chunk) {
  const labeled = chunk.match(/\((\d{1,3})%\)/);
  const bar = chunk.match(
    /style="width:\s*(\d{1,3})%[^"]*"[^>]*class="graphBar"|class="graphBar"[^>]*style="width:\s*(\d{1,3})%/i,
  );
  const raw = labeled?.[1] || bar?.[1] || bar?.[2];
  if (raw == null) return undefined;
  const percent = Number(raw);
  if (!Number.isFinite(percent)) return undefined;
  return Math.min(100, Math.max(0, percent));
}

// The public profile still lists currently-reading books. Shelf RSS routes return 404.
export function booksFromProfile(html) {
  if (/<title>\s*Sign in\b/i.test(html)) {
    throw new Error("Goodreads asked for a sign-in instead of the public profile.");
  }
  const count = shelfCount(html, "currently-reading");
  const start = html.indexOf('id="currentlyReadingReviews"');
  if (start < 0) {
    if (count === 0) return { books: [], count: 0 };
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
      const authors = [...chunk.matchAll(/<a class="authorName"[^>]*>([\s\S]*?)<\/a>/gi)].map(
        (match) => stripTags(match[1]),
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
  // Goodreads' profile only shows recent "is currently reading" updates, so a book
  // shelved a while ago without a new update can be missing even though it still
  // counts toward the shelf total. Let the caller merge in what it already knows.
  if (books.length === 0 && count > 0) {
    throw new Error("Goodreads profile did not list any currently-reading books.");
  }
  return { books, count };
}

export function widgetHtml(source) {
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
export function booksFromWidget(source) {
  const html = widgetHtml(source);
  if (html == null) throw new Error("Goodreads to-read widget did not return a book list.");
  const books = [];
  const pattern =
    /<a title="([^"]*)"[^>]*href="https:\/\/www\.goodreads\.com\/review\/show\/\d+[^"]*"[^>]*>\s*<img\b([^>]*)>/gi;
  for (const match of html.matchAll(pattern)) {
    const img = match[2];
    const src = img.match(/\bsrc="([^"]+)"/i)?.[1] || "";
    const goodreadsId = src.match(/\/(\d+)(?:\._[A-Z]{2}\d+_)?\.(?:jpe?g|png)\b/i)?.[1] || "";
    const title =
      decodeEntities(match[1]) || decodeEntities(img.match(/\balt="([^"]*)"/i)?.[1] || "");
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
