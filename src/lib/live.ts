type LiveBook = {
  title: string;
  author: string;
  goodreadsId?: string;
  progress?: number | null;
};

type LiveFeed = {
  currentlyReading?: LiveBook[];
  upNext?: LiveBook[];
};

function baseTitle(value: string) {
  return value.toLowerCase().replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

export function liveProgress(live: LiveFeed, title: string, goodreadsId?: string) {
  const reading = live.currentlyReading || [];
  const byId = goodreadsId ? reading.find((book) => book.goodreadsId === goodreadsId) : undefined;
  if (typeof byId?.progress === "number") return byId.progress;
  const byTitle = reading.find(
    (book) => baseTitle(book.title) === baseTitle(title) || book.title.toLowerCase() === title.toLowerCase(),
  );
  return typeof byTitle?.progress === "number" ? byTitle.progress : null;
}
