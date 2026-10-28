export const ACTIVITY_FILE = "src/data/activity-log.json";
export const MAX_EVENTS = 40;

export function parseActivityLog(text) {
  try {
    const data = JSON.parse(text || "{}");
    return { events: Array.isArray(data.events) ? data.events : [] };
  } catch {
    return { events: [] };
  }
}

export function activityEntry({ at, type, ok = true, title, detail = "", by = "" }) {
  return {
    at: at || new Date().toISOString(),
    type,
    ok: Boolean(ok),
    title: String(title || "Update"),
    detail: String(detail || ""),
    by: String(by || ""),
  };
}

export function appendActivity(log, entry) {
  const events = [activityEntry(entry), ...(log?.events || [])];
  return { events: events.slice(0, MAX_EVENTS) };
}

export function stringifyActivity(log) {
  return `${JSON.stringify(log, null, 2)}\n`;
}

export function bookKey(book) {
  return String(book?.goodreadsId || book?.title || "").trim();
}

export function describeReadingChanges(previous = [], next = []) {
  const changes = [];
  const prevMap = new Map(previous.map((book) => [bookKey(book), book]));
  const nextMap = new Map(next.map((book) => [bookKey(book), book]));

  for (const book of next) {
    const old = prevMap.get(bookKey(book));
    if (!old) {
      changes.push(`Started ${book.title}`);
      continue;
    }
    if (old.progress !== book.progress && typeof book.progress === "number") {
      const from = typeof old.progress === "number" ? `${old.progress}%` : "—";
      changes.push(`${book.title}: ${from} → ${book.progress}%`);
    }
  }

  for (const book of previous) {
    if (!nextMap.has(bookKey(book))) changes.push(`Left currently reading: ${book.title}`);
  }

  return changes;
}

export function describeUpNextChanges(previous = [], next = []) {
  const changes = [];
  const prevKeys = new Set(previous.map((book) => bookKey(book)));
  const nextMap = new Map(next.map((book) => [bookKey(book), book]));

  for (const book of next) {
    if (!prevKeys.has(bookKey(book))) changes.push(`Up next: ${book.title}`);
  }
  for (const book of previous) {
    if (!nextMap.has(bookKey(book))) changes.push(`Left up next: ${book.title}`);
  }

  const sameBooks = previous.length === next.length && previous.every((book) => nextMap.has(bookKey(book)));
  const orderChanged = previous.map((book) => bookKey(book)).join("|") !== next.map((book) => bookKey(book)).join("|");
  if (sameBooks && orderChanged) changes.push("Up next order changed.");
  return changes;
}

export function formatSyncDetail({ currentlyReading = [], upNext = [], changes = [], ok = true, warning = "", error = "" }) {
  const reading = currentlyReading.map((book) => {
    const percent = typeof book.progress === "number" ? ` (${book.progress}%)` : "";
    return `${book.title}${percent}`;
  });
  const next = upNext.map((book) => book.title).filter(Boolean);
  const lines = ["Now reading", ...(reading.length ? reading : ["None"]), "Up next", ...(next.length ? next : ["None"])];
  if (!ok) {
    lines.push(warning || error || "Goodreads shelf sync had a problem.");
    return lines.join("\n");
  }
  lines.push("Changes", ...(changes.length ? changes : ["No changes since the previous shelf."]));
  return lines.join("\n");
}
