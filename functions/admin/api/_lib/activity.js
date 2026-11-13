import { tryGetTextFile } from "./github.js";

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

export async function filesWithActivity(env, files, entry) {
  const text = await tryGetTextFile(env, ACTIVITY_FILE);
  const log = appendActivity(parseActivityLog(text), entry);
  return [
    ...files,
    {
      path: ACTIVITY_FILE,
      content: stringifyActivity(log),
      encoding: "utf-8",
    },
  ];
}
