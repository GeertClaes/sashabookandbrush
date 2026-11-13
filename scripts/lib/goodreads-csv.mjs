// Goodreads library-export CSV: parse rows and normalise the fields the
// importer writes into book markdown. This is not the HTML shelf parser.

export function parseCsv(text) {
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

export function normalizeTitle(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function slugify(value) {
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

export function cleanIsbn(value) {
  return String(value || "").replace(/[^\dXx]/g, "");
}

export function parseGoodreadsDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.replace(/\//g, "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

export function parseYear(value) {
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

export function cleanReview(text) {
  let value = String(text || "");
  value = value.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  value = value.replace(/<\s*\/\s*p\s*>/gi, "\n\n");
  value = value.replace(/<\s*p(?:\s[^>]*)?>/gi, "");
  value = value.replace(/<\s*\/?\s*div[^>]*>/gi, "\n");
  value = value.replace(/<[^>]+>/g, "");
  value = decodeEntities(value);
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function genreFromShelves(shelves) {
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

export function pickNote(siteNote, goodreadsNote) {
  const site = String(siteNote || "").trim();
  const incoming = String(goodreadsNote || "").trim();
  if (!site) return incoming;
  if (!incoming) return site;
  if (site === incoming) return site;
  if (site.length >= incoming.length) return site;
  return incoming;
}

export function bookFromRow(row, col, { status, slug }) {
  const title = col(row, "Title").trim();
  const author = col(row, "Author").trim();
  const isbn13 = cleanIsbn(col(row, "ISBN13"));
  const isbn10 = cleanIsbn(col(row, "ISBN"));
  const shelves = col(row, "Bookshelves");
  const isReading = status === "currently-reading";
  return {
    title,
    author,
    note: cleanReview(col(row, "My Review")),
    rating: Number(col(row, "My Rating") || 0),
    genre:
      isReading && !shelves.replace(/currently-reading/gi, "").trim()
        ? "Currently reading"
        : genreFromShelves(shelves),
    status,
    isbn: isbn13.length === 13 ? isbn13 : isbn10 || isbn13,
    isbn10: isbn10.length === 10 ? isbn10 : "",
    goodreadsId: col(row, "Book Id").trim(),
    dateRead: parseGoodreadsDate(col(row, "Date Read")),
    dateAdded: parseGoodreadsDate(col(row, "Date Added")),
    pages: Number(col(row, "Number of Pages")) || 0,
    yearPublished: parseYear(col(row, "Year Published")),
    originalYear: parseYear(col(row, "Original Publication Year")),
    publisher: col(row, "Publisher").trim(),
    readCount: Number(col(row, "Read Count")) || 0,
    slug,
  };
}
