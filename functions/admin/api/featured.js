import { featuredSaveDetail, planFeaturedBoard } from "./_lib/board-save.js";
import { filesWithActivity } from "./_lib/activity.js";
import { fail, json, readJson, safeSlug } from "./_lib/frontmatter.js";
import { commitFiles, tryGetTextFile } from "./_lib/github.js";

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const rows = Array.isArray(body.books) ? body.books : [];
    const filesBySlug = {};
    if (rows.length > 0 && rows.length <= 20) {
      for (const row of rows) {
        const slug = safeSlug(row?.slug);
        if (!(slug in filesBySlug)) {
          filesBySlug[slug] = await tryGetTextFile(context.env, `src/content/books/${slug}.md`);
        }
      }
    }
    const plan = planFeaturedBoard(rows, filesBySlug);
    if (plan.error) return json({ error: plan.error }, plan.status);

    await commitFiles(
      context.env,
      plan.message,
      await filesWithActivity(context.env, plan.files, {
        type: "admin",
        title: plan.activity.title,
        detail: featuredSaveDetail(),
        by: context.data.email || "",
      }),
    );
    return json(plan.result);
  } catch (error) {
    return fail(error, error instanceof Error && /invalid name/i.test(error.message) ? 400 : 500);
  }
}
