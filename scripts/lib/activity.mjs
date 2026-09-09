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

export function activityEntry({ type, ok = true, title, detail = "", by = "" }) {
  return {
    at: new Date().toISOString(),
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
