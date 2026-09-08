export function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`;
}

export function upsertField(text, key, line) {
  if (new RegExp(`^${key}:`, "m").test(text)) {
    return text.replace(new RegExp(`^${key}:.*$`, "m"), line);
  }
  return text.replace(/\n---\s*$/, `\n${line}\n---`);
}

export function safeSlug(value) {
  const slug = String(value || "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
    throw new Error("Invalid book");
  }
  return slug;
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export function fail(error, status = 500) {
  const message = error instanceof Error ? error.message : "Server error";
  return json({ error: message }, status);
}

export async function readJson(request) {
  return request.json().catch(() => ({}));
}
