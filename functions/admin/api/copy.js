import { filesWithActivity } from "./_lib/activity.js";
import { fail, json, readJson } from "./_lib/frontmatter.js";
import { commitFiles, fileExists, getTextFile } from "./_lib/github.js";
import { applySiteCopy, prepareCopySave, stringifySite } from "./_lib/site-copy.js";

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

    let prepared;
    try {
      prepared = prepareCopySave(site, body);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Check the page text" }, 400);
    }

    const content = stringifySite(prepared.next);
    const current = raw.endsWith("\n") ? raw : `${raw}\n`;
    if (content === current) return json({ ok: true, unchanged: true, image: prepared.next.about?.image || "" });

    const source = { ...body };
    delete source.aboutPhoto;
    const textChanged = stringifySite(applySiteCopy(site, source)) !== current;
    const activity = textChanged && prepared.photo
      ? {
          commit: "Admin: update pages",
          title: "Updated page text and the about photo",
          detail: "Home, About, and Work with me update after the site rebuilds (about a minute).",
        }
      : prepared.photo
        ? {
            commit: "Admin: update about photo",
            title: "Updated the about photo",
            detail: "About and Work with me show it after the site rebuilds (about a minute).",
          }
        : {
            commit: "Admin: update page text",
            title: "Updated page text",
            detail: "Home, About, and Work with me update after the site rebuilds (about a minute).",
          };

    const files = [{ path: SITE_FILE, content, encoding: "utf-8" }, ...prepared.uploads];
    for (const path of prepared.removals) {
      if (await fileExists(context.env, path)) files.push({ path, delete: true });
    }

    await commitFiles(
      context.env,
      activity.commit,
      await filesWithActivity(context.env, files, {
        type: "admin",
        title: activity.title,
        detail: activity.detail,
        by: context.data.email || "",
      }),
    );
    return json({ ok: true, image: prepared.next.about?.image || "" });
  } catch (error) {
    return fail(error);
  }
}
