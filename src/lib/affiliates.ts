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

export function realUrl(value?: string) {
  const raw = String(value || "").trim();
  if (!raw || raw === "#") return "";
  return /^https?:\/\//i.test(raw) ? raw : "";
}

export function taggedAmazon(value?: string, tag = site.affiliates?.amazonTag || "") {
  const raw = realUrl(value);
  if (!raw) return "";
  if (!tag) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "amazon.co.uk" && host !== "amazon.com") return raw;
  const match = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  if (match) {
    const domain = host === "amazon.com" ? "www.amazon.com" : "www.amazon.co.uk";
    return `https://${domain}/dp/${match[1]}/ref=nosim?tag=${encodeURIComponent(tag)}`;
  }
  url.searchParams.set("tag", tag);
  return url.toString();
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
  const asin = isbn10 || isbn13;
  const amazon =
    taggedAmazon(overrideAmazon, tag) ||
    (tag && asin ? `https://www.amazon.co.uk/dp/${asin}/ref=nosim?tag=${encodeURIComponent(tag)}` : "");

  return { bookshop, amazon };
}
