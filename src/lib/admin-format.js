// General-purpose formatting helpers used throughout the admin editor's
// client script. Kept dependency-free (no DOM) so they're unit testable.

export function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

// "12 Nov 2026, 10:23" style — used for one-line timestamps (e.g. "Goodreads
// synced ...", "Checked ...").
export function formatWhen(value) {
  if (!value) return "not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  });
}

// Splits a timestamp into the day-heading and time-of-day used by the
// Recent timeline, which groups events under a shared day heading.
export function formatTimeline(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return { day: "Unknown date", time: "" };
  return {
    day: date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    }),
    time: date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    }),
  };
}

// Goodreads/curl failures can surface as long, technical error text (HTTP
// status codes, curl exit codes). Reduce those to one plain-English line
// instead of showing the raw error to a non-technical editor.
export function shortSyncProblem(text) {
  const value = String(text || "");
  const status = value.match(/returned error:\s*(\d+)/) || value.match(/HTTP (\d+)/);
  if (status) return `Goodreads returned HTTP ${status[1]}. The previous shelf was kept.`;
  return value;
}

// Converts an ArrayBuffer (e.g. from a cover photo upload) to a base64
// string in chunks, since spreading a very large Uint8Array directly into
// String.fromCharCode can exceed the engine's argument limit.
export function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
