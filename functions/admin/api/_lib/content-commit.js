import { filesWithActivity } from "./activity.js";
import {
  contentCommitMessage,
  contentSaveDetail,
  planContentSave,
  resolveContentWrite,
} from "./content-save.js";
import { fail, json, readJson } from "./frontmatter.js";
import { commitFiles, fileExists, tryGetTextFile } from "./github.js";

export async function handleContentPost(context, kind) {
  try {
    const body = await readJson(context.request);
    const target = resolveContentWrite(kind, body);
    if (target.error) return json({ error: target.error }, target.status);

    const existingText = await tryGetTextFile(context.env, target.filePath);
    const plan = planContentSave({ kind, body, existingText });
    if (plan.error) return json({ error: plan.error }, plan.status);

    const files = [];
    for (const file of plan.files) {
      if (
        file.delete &&
        !file.path.endsWith(".md") &&
        !(await fileExists(context.env, file.path))
      ) {
        continue;
      }
      files.push(file);
    }

    await commitFiles(
      context.env,
      contentCommitMessage(plan),
      await filesWithActivity(context.env, files, {
        type: "admin",
        title: plan.activity.title,
        detail: contentSaveDetail(plan),
        by: context.data.email || "",
      }),
    );
    return json(plan.result);
  } catch (error) {
    return fail(error, error instanceof Error && /invalid name/i.test(error.message) ? 400 : 500);
  }
}
