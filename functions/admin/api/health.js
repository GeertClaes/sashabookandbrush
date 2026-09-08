import { json } from "./_lib/frontmatter.js";

export async function onRequestGet(context) {
  return json({
    ok: true,
    email: context.data.email || "",
  });
}
