import { filesWithActivity } from "./_lib/activity.js";
import { fail, json, readJson } from "./_lib/frontmatter.js";
import { commitFiles, getTextFile } from "./_lib/github.js";
import { applySiteCopy, stringifySite } from "./_lib/site-copy.js";

const SITE_FILE = "src/data/site.json";

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const raw = await getTextFile(context.env, SITE_FILE);
    let site;
    try {
      site = JSON.parse(raw);
    } catch {
      return json({ error: "Site file could not be read" }, 500);
    }

    let next;
    try {
      next = applySiteCopy(site, body);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Check the page text" }, 400);
    }

    const content = stringifySite(next);
    const current = raw.endsWith("\n") ? raw : `${raw}\n`;
    if (content === current) return json({ ok: true, unchanged: true });

    await commitFiles(
      context.env,
      "Admin: update page text",
      await filesWithActivity(context.env, [{ path: SITE_FILE, content, encoding: "utf-8" }], {
        type: "admin",
        title: "Updated page text",
        detail: "Home, About, and Work with me update after the site rebuilds (about a minute).",
        by: context.data.email || "",
      }),
    );
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
