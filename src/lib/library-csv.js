/** Goodreads library-export columns, then a few site-only columns. */
export const LIBRARY_CSV_COLUMNS = [
  "Book Id",
  "Title",
  "Author",
  "Author l-f",
  "Additional Authors",
  "ISBN",
  "ISBN13",
  "My Rating",
  "Average Rating",
  "Publisher",
  "Binding",
  "Number of Pages",
  "Year Published",
  "Original Publication Year",
  "Date Read",
  "Date Added",
  "Bookshelves",
  "Bookshelves with positions",
  "Exclusive Shelf",
  "My Review",
  "Spoiler",
  "Private Notes",
  "Read Count",
  "Owned Copies",
  "Slug",
  "Featured",
  "Cover",
];

function csvField(value) {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function authorLastFirst(author) {
  const name = String(author || "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name;
  const last = parts.pop();
  return `${last}, ${parts.join(" ")}`;
}

function goodreadsDate(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[1]}/${match[2]}/${match[3]}`;
}

/** Same Excel text formula Goodreads uses so ISBN-10 keeps a leading zero. */
function isbnExcel(value) {
  const digits = String(value || "").replace(/[^\dXx]/g, "");
  if (!digits) return "";
  return `="${digits}"`;
}

function optionalCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.trunc(n));
}

function ratingCell(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Math.trunc(n));
}

function rowFor(book) {
  return [
    book.goodreadsId || "",
    book.title || "",
    book.author || "",
    authorLastFirst(book.author),
    "",
    isbnExcel(book.isbn10),
    isbnExcel(book.isbn),
    ratingCell(book.rating),
    "",
    book.publisher || "",
    "",
    optionalCount(book.pages),
    optionalCount(book.yearPublished),
    optionalCount(book.originalYear),
    goodreadsDate(book.dateRead),
    goodreadsDate(book.dateAdded),
    book.genre || "",
    "",
    book.status || "",
    book.note || "",
    "",
    "",
    optionalCount(book.readCount),
    "",
    book.slug || "",
    book.featured ? "true" : "false",
    book.cover || "",
  ]
    .map(csvField)
    .join(",");
}

export function libraryCsv(books) {
  const rows = [...(books || [])].sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" }),
  );
  return `\uFEFF${[LIBRARY_CSV_COLUMNS.join(","), ...rows.map(rowFor)].join("\r\n")}\r\n`;
}

export function libraryCsvFilename(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `sashabookandbrush-library-${y}-${m}-${d}.csv`;
}
