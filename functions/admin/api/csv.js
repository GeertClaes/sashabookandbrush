import { fail, json, readJson } from "./_lib/frontmatter.js";
import { filesWithActivity } from "./_lib/activity.js";
import { commitFiles } from "./_lib/github.js";

const MAX_BYTES = 8 * 1024 * 1024;

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const contentBase64 = String(body.contentBase64 || "").replace(/\s/g, "");
    if (!contentBase64) return json({ error: "Missing CSV" }, 400);

    const bytes = Math.floor((contentBase64.length * 3) / 4);
    if (bytes > MAX_BYTES) return json({ error: "CSV is too large" }, 400);

    await commitFiles(
      context.env,
      "Admin: Goodreads CSV export",
      await filesWithActivity(
        context.env,
        [{ path: "data/export.csv", content: contentBase64, encoding: "base64" }],
        {
          type: "admin",
          title: "Goodreads CSV uploaded",
          detail: "GitHub will import ratings, then the site rebuilds. New covers can be added afterwards.",
          by: context.data.email || "",
        },
      ),
    );

    return json({
      ok: true,
      log: "Export saved. GitHub will import ratings in a minute, then the site rebuilds. New covers can be added here afterwards.",
    });
  } catch (error) {
    return fail(error);
  }
}
