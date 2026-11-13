export {
  ACTIVITY_FILE,
  MAX_EVENTS,
  activityEntry,
  appendActivity,
  parseActivityLog,
  stringifyActivity,
} from "../../functions/admin/api/_lib/activity.js";

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

  const sameBooks =
    previous.length === next.length && previous.every((book) => nextMap.has(bookKey(book)));
  const orderChanged =
    previous.map((book) => bookKey(book)).join("|") !== next.map((book) => bookKey(book)).join("|");
  if (sameBooks && orderChanged) changes.push("Up next order changed.");
  return changes;
}

export function formatSyncDetail({
  currentlyReading = [],
  upNext = [],
  changes = [],
  ok = true,
  warning = "",
  error = "",
}) {
  if (!ok) {
    const lines = [warning || error || "Goodreads shelf sync had a problem."];
    if (currentlyReading.length || upNext.length) lines.push("The previous shelf was kept.");
    return lines.join("\n");
  }
  const reading = currentlyReading.map((book) => {
    const percent = typeof book.progress === "number" ? ` (${book.progress}%)` : "";
    return `${book.title}${percent}`;
  });
  const next = upNext.map((book) => book.title).filter(Boolean);
  const lines = [
    "Now reading",
    ...(reading.length ? reading : ["None"]),
    "Up next",
    ...(next.length ? next : ["None"]),
  ];
  lines.push("Changes", ...(changes.length ? changes : ["No changes since the previous shelf."]));
  if (warning) lines.push("Note", warning);
  return lines.join("\n");
}
