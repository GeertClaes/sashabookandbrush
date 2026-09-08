export function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`;
}

export function upsertField(text, key, line) {
  if (new RegExp(`^${key}:`, "m").test(text)) {
    return text.replace(new RegExp(`^${key}:.*$`, "m"), line);
  }
  return text.replace(/\n---\s*$/, `\n${line}\n---`);
}

export function applyYamlFields(text, updates) {
  let next = text;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (typeof value === "boolean" || typeof value === "number") {
      next = upsertField(next, key, `${key}: ${value}`);
    } else {
      next = upsertField(next, key, `${key}: ${yamlString(value)}`);
    }
  }
  return next;
}

export function safeSlug(value) {
  const slug = String(value || "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
    throw new Error("Invalid name");
  }
  return slug;
}

export function slugFromTitle(title) {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safeSlug(slug);
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
