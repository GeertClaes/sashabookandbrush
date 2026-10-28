import { json, fail } from "./_lib/frontmatter.js";
import { tryGetTextFile } from "./_lib/github.js";
import { ACTIVITY_FILE, parseActivityLog } from "./_lib/activity.js";
import { listDeployments, summarizeDeployments } from "./_lib/pages.js";

function parseLive(text) {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return {};
  }
}

function shelfTitles(books, withProgress) {
  return (books || []).map((book) => {
    if (!withProgress) return book.title;
    const percent = typeof book.progress === "number" ? ` (${book.progress}%)` : "";
    return `${book.title}${percent}`;
  });
}

function syncFromLive(live) {
  const recorded = live.lastSync || {};
  const reading = recorded.reading?.length
    ? recorded.reading
    : (live.currentlyReading || []).map((book) => ({
        title: book.title,
        progress: book.progress ?? null,
      }));
  const upNext = (live.upNext || []).map((book) => ({ title: book.title }));
  return {
    at: recorded.at || live.updated || "",
    ok: recorded.at ? Boolean(recorded.ok) : Boolean(live.updated),
    source: recorded.source || "file",
    readingCount: recorded.readingCount ?? reading.length,
    upNextCount: recorded.upNextCount ?? upNext.length,
    changes: recorded.changes || [],
    warning: recorded.warning ?? (live.updated ? null : "No Goodreads sync has been recorded yet."),
    error: recorded.error ?? null,
    reading,
    upNext,
  };
}

function syncDetail(sync) {
  const reading = shelfTitles(sync.reading, true);
  const next = shelfTitles(sync.upNext, false).filter(Boolean);
  const lines = ["Now reading", ...(reading.length ? reading : ["None"]), "Up next", ...(next.length ? next : ["None"])];
  if (!sync.ok) {
    lines.push(sync.warning || sync.error || "Goodreads shelf sync had a problem.");
    return lines.join("\n");
  }
  const changes = sync.changes || [];
  lines.push("Changes", ...(changes.length ? changes : ["No changes since the previous shelf."]));
  return lines.join("\n");
}

function eventFromSync(sync) {
  if (!sync?.at) return null;
  return {
    at: sync.at,
    type: "goodreads",
    ok: Boolean(sync.ok),
    title: sync.ok ? "Goodreads shelf sync" : "Goodreads shelf sync failed",
    detail: syncDetail(sync),
    by: sync.source || "pages-build",
  };
}

function sameSync(left, right) {
  const a = Date.parse(left || "");
  const b = Date.parse(right || "");
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 5000;
}

async function fetchDeployedLive(request) {
  const url = new URL("/data/goodreads-live.json", request.url);
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return parseLive(await response.text());
}

export async function onRequestGet(context) {
  try {
    const [logText, gitLiveText, deployedLive, pages] = await Promise.all([
      tryGetTextFile(context.env, ACTIVITY_FILE).catch(() => null),
      tryGetTextFile(context.env, "src/data/goodreads-live.json").catch(() => null),
      fetchDeployedLive(context.request).catch(() => null),
      listDeployments(context.env).catch((error) => ({
        available: false,
        error: error instanceof Error ? error.message : "Could not load Pages deploys",
        deployments: [],
      })),
    ]);

    const live =
      deployedLive && (deployedLive.lastSync || deployedLive.updated || deployedLive.currentlyReading)
        ? deployedLive
        : parseLive(gitLiveText);
    const sync = syncFromLive(live);
    const log = parseActivityLog(logText);
    const fromSync = eventFromSync(sync);
    const events = fromSync
      ? [fromSync, ...log.events.filter((event) => event.type !== "goodreads" || !sameSync(event.at, fromSync.at))]
      : log.events;
    const site = summarizeDeployments(pages.deployments);

    return json({
      ok: true,
      sync,
      events,
      site: {
        ...site,
        deploymentsAvailable: Boolean(pages.available),
        deploymentsError: pages.error || "",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
