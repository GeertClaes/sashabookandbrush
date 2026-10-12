const LINK = /\[([^\]\n]+)\]\((https?:\/\/(?:\([^\s)]*\)|[^\s)])+)\)/g;

export type InlinePart = { text: string } | { label: string; href: string };

function httpUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function linkParts(value: string): InlinePart[] {
  const source = String(value ?? "");
  const parts: InlinePart[] = [];
  let cursor = 0;
  for (const match of source.matchAll(LINK)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: source.slice(cursor, index) });
    const label = match[1].trim();
    const href = httpUrl(match[2]);
    parts.push(label && href ? { label, href } : { text: match[0] });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) parts.push({ text: source.slice(cursor) });
  return parts;
}

export function plainInline(value: string) {
  return linkParts(value)
    .map((part) => ("href" in part ? part.label : part.text))
    .join("");
}
