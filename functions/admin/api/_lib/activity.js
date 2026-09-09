import { tryGetTextFile } from "./github.js";

export const ACTIVITY_FILE = "src/data/activity-log.json";
const MAX_EVENTS = 40;

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

export async function filesWithActivity(env, files, entry) {
  const text = await tryGetTextFile(env, ACTIVITY_FILE);
  const log = parseActivityLog(text);
  log.events = [activityEntry(entry), ...log.events].slice(0, MAX_EVENTS);
  return [
    ...files,
    {
      path: ACTIVITY_FILE,
      content: `${JSON.stringify(log, null, 2)}\n`,
      encoding: "utf-8",
    },
  ];
}
