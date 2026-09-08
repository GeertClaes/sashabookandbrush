import { assertAccess } from "./_lib/access.js";
import { json } from "./_lib/frontmatter.js";

export async function onRequest(context) {
  try {
    const result = await assertAccess(context.request, context.env, {
      requireGithub: context.request.method !== "GET",
    });
    if (!result.ok) {
      return json({ error: result.error || "Unauthorized" }, 401);
    }
    context.data.email = result.email;
    return context.next();
  } catch {
    return json({ error: "Unauthorized" }, 401);
  }
}
