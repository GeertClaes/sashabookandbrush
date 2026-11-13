import { filesWithActivity } from "./_lib/activity.js";
import { planReorder, reorderSaveDetail } from "./_lib/board-save.js";
import { fail, json, readJson, safeSlug } from "./_lib/frontmatter.js";
import { commitFiles, tryGetTextFile } from "./_lib/github.js";

const DIRS = {
  art: "src/content/art",
  supply: "src/content/supplies",
};

export async function onRequestPost(context) {
  try {
    const body = await readJson(context.request);
    const slugs = Array.isArray(body.slugs) ? body.slugs : [];
    const filesBySlug = {};
    if (DIRS[body.kind] && slugs.length > 0 && slugs.length <= 40) {
      for (const raw of slugs) {
        const slug = safeSlug(raw);
        if (!(slug in filesBySlug)) {
          filesBySlug[slug] = await tryGetTextFile(context.env, `${DIRS[body.kind]}/${slug}.md`);
        }
      }
    }
    const plan = planReorder({ kind: body.kind, slugs, filesBySlug });
    if (plan.error) return json({ error: plan.error }, plan.status);

    await commitFiles(
      context.env,
      plan.message,
      await filesWithActivity(context.env, plan.files, {
        type: "admin",
        title: plan.activity.title,
        detail: reorderSaveDetail(),
        by: context.data.email || "",
      }),
    );
    return json(plan.result);
  } catch (error) {
    return fail(error, error instanceof Error && /invalid name/i.test(error.message) ? 400 : 500);
  }
}
