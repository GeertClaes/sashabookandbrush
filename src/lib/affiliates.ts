import site from "../data/site.json";

type AffiliateInput = {
  isbn?: string;
  isbn10?: string;
  bookshop?: string;
  amazon?: string;
};

function cleanIsbn(value?: string) {
  return String(value || "").replace(/[^\dXx]/g, "");
}

function realUrl(value?: string) {
  const raw = String(value || "").trim();
  if (!raw || raw === "#") return "";
  return /^https?:\/\//i.test(raw) ? raw : "";
}

export function affiliateLinks(book: AffiliateInput) {
  const overrideBookshop = realUrl(book.bookshop);
  const overrideAmazon = realUrl(book.amazon);
  const isbn13 = cleanIsbn(book.isbn);
  const isbn10 = cleanIsbn(book.isbn10);
  const tag = site.affiliates?.amazonTag || "";
  const shopId = site.affiliates?.bookshopUkId || "";

  const bookshop =
    overrideBookshop ||
    (shopId && isbn13 ? `https://uk.bookshop.org/a/${shopId}/${isbn13}` : "");
  const amazon =
    overrideAmazon ||
    (tag && (isbn10 || isbn13) ? `https://www.amazon.com/dp/${isbn10 || isbn13}?tag=${encodeURIComponent(tag)}` : "");

  return { bookshop, amazon };
}
