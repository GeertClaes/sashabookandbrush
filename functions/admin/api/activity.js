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

function syncFromLive(live) {
  return (
    live.lastSync || {
      at: live.updated || "",
      ok: Boolean(live.updated),
      source: "file",
      readingCount: live.currentlyReading?.length || 0,
      upNextCount: live.upNext?.length || 0,
      changes: [],
      warning: live.updated ? null : "No Goodreads sync has been recorded yet.",
      error: null,
      reading: (live.currentlyReading || []).map((book) => ({
        title: book.title,
        progress: book.progress ?? null,
      })),
    }
  );
}

function eventFromSync(sync) {
  if (!sync?.at) return null;
  const changes = (sync.changes || []).join("; ");
  const extra = sync.warning || sync.error || "";
  const counts = `${sync.readingCount || 0} currently reading, ${sync.upNextCount || 0} up next.`;
  const detail = sync.ok
    ? `${counts} ${changes || "No changes to currently reading."}`.trim()
    : extra || "Goodreads RSS sync had a problem.";
  return {
    at: sync.at,
    type: "goodreads",
    ok: Boolean(sync.ok),
    title: sync.ok ? "Goodreads RSS sync" : "Goodreads RSS sync failed",
    detail,
    by: sync.source || "pages-build",
  };
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
      ? [fromSync, ...log.events.filter((event) => event.type !== "goodreads" || event.at !== fromSync.at)]
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
