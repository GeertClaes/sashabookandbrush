export function syncFromLive(live = {}, { source = "file" } = {}) {
  const shelf = live && typeof live === "object" ? live : {};
  const recorded = shelf.lastSync || {};
  const reading = recorded.reading?.length
    ? recorded.reading
    : (shelf.currentlyReading || []).map((book) => ({
        title: book.title,
        progress: book.progress ?? null,
      }));
  const upNext = (shelf.upNext || []).map((book) => ({ title: book.title }));
  return {
    at: recorded.at || shelf.updated || "",
    ok: recorded.at ? Boolean(recorded.ok) : Boolean(shelf.updated),
    source: recorded.source || source,
    readingCount: recorded.readingCount ?? reading.length,
    upNextCount: recorded.upNextCount ?? upNext.length,
    changes: recorded.changes || [],
    warning:
      recorded.warning ?? (shelf.updated ? null : "No Goodreads sync has been recorded yet."),
    error: recorded.error ?? null,
    reading,
    upNext,
  };
}
