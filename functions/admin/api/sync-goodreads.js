import { fail, json } from "./_lib/frontmatter.js";
import { commitFiles, dispatchWorkflow } from "./_lib/github.js";

const STARTED = "Sync started. GitHub is fetching the shelf. A changed shelf goes live on the next publish.";

export async function onRequestPost(context) {
  try {
    try {
      await dispatchWorkflow(context.env, "sync-goodreads.yml");
      return json({ ok: true, message: STARTED });
    } catch (error) {
      if (!error || error.status !== 403) throw error;
    }

    // The admin token is Contents-only unless Actions write is added. A commit of
    // this file starts the same workflow via its push path filter.
    await commitFiles(context.env, "Sync Goodreads now", [
      {
        path: ".github/goodreads-sync-request",
        content: `${new Date().toISOString()}\n`,
      },
    ]);
    return json({ ok: true, message: STARTED });
  } catch (error) {
    return fail(error);
  }
}
