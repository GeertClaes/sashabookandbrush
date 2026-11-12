import { emptyAffiliateUrl } from "./frontmatter.js";

export const BOOK_MAX_NOTE = 8000;

// Validates and derives the frontmatter field updates for a book save from
// the raw request body. Shared by the Cloudflare Pages function (book.js)
// and the local dev admin server so both enforce the same rules (e.g. the
// note-length limit) instead of drifting apart.
export function deriveBookUpdates(body) {
  if (typeof body.note === "string" && body.note.length > BOOK_MAX_NOTE) {
    return { error: "That note is too long" };
  }

  const updates = {};
  if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
  if (typeof body.author === "string" && body.author.trim()) updates.author = body.author.trim();
  if (typeof body.genre === "string") updates.genre = body.genre.trim() || "Read";
  if (typeof body.note === "string") updates.note = body.note;
  if (typeof body.featured === "boolean") updates.featured = body.featured;
  if (body.featured !== false && Number.isFinite(Number(body.order))) {
    updates.order = Number(body.order);
  }
  if (typeof body.isbn === "string") updates.isbn = String(body.isbn).replace(/[^\dXx]/g, "");
  if (typeof body.isbn10 === "string") {
    updates.isbn10 = String(body.isbn10).replace(/[^\dXx]/g, "");
  }
  if (typeof body.bookshop === "string") updates.bookshop = emptyAffiliateUrl(body.bookshop);
  if (typeof body.amazon === "string") updates.amazon = emptyAffiliateUrl(body.amazon);

  return { updates };
}
