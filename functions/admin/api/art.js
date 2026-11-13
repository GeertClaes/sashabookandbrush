import { handleContentPost } from "./_lib/content-commit.js";

export function onRequestPost(context) {
  return handleContentPost(context, "art");
}
