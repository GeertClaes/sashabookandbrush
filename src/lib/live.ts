type LiveBook = {
  title: string;
  author: string;
  goodreadsId?: string;
  isbn?: string;
  image?: string;
  progress?: number | null;
};

type LiveFeed = {
  currentlyReading?: LiveBook[];
  upNext?: LiveBook[];
};

function baseTitle(value: string) {
  return value.toLowerCase().replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

function titlesMatch(left: string, right: string) {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return true;
  return baseTitle(left) === baseTitle(right);
}

export function findLiveReading(live: LiveFeed, title: string, goodreadsId?: string) {
  const reading = live.currentlyReading || [];
  if (goodreadsId) {
    const byId = reading.find((book) => book.goodreadsId === goodreadsId);
    if (byId) return byId;
  }
  return reading.find((book) => titlesMatch(book.title, title));
}

export function findLocalForLive<T extends { data: { goodreadsId?: string; title: string } }>(
  item: { goodreadsId?: string; title: string },
  books: T[],
) {
  if (item.goodreadsId) {
    const byId = books.find((book) => book.data.goodreadsId === item.goodreadsId);
    if (byId) return byId;
  }
  return books.find((book) => titlesMatch(book.data.title, item.title));
}

export function isLiveCurrentlyReading(live: LiveFeed, title: string, goodreadsId?: string) {
  return Boolean(findLiveReading(live, title, goodreadsId));
}

export function liveReadingStatus(
  live: LiveFeed,
  title: string,
  goodreadsId: string | undefined,
  fallback: "read" | "currently-reading",
): "read" | "currently-reading" {
  if (!live.currentlyReading?.length) return fallback;
  return isLiveCurrentlyReading(live, title, goodreadsId) ? "currently-reading" : "read";
}

export function liveProgress(live: LiveFeed, title: string, goodreadsId?: string) {
  const book = findLiveReading(live, title, goodreadsId);
  return typeof book?.progress === "number" ? book.progress : null;
}
