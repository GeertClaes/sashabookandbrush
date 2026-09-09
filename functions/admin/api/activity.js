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

export async function onRequestGet(context) {
  try {
    const [logText, liveText, pages] = await Promise.all([
      tryGetTextFile(context.env, ACTIVITY_FILE).catch(() => null),
      tryGetTextFile(context.env, "src/data/goodreads-live.json").catch(() => null),
      listDeployments(context.env).catch((error) => ({
        available: false,
        error: error instanceof Error ? error.message : "Could not load Pages deploys",
        deployments: [],
      })),
    ]);

    const live = parseLive(liveText);
    const log = parseActivityLog(logText);
    const site = summarizeDeployments(pages.deployments);

    return json({
      ok: true,
      sync: live.lastSync || {
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
      },
      events: log.events,
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
