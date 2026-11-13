import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFrontmatter, readYamlField, unescapeYaml, upsertField } from "./frontmatter.js";

describe("unescapeYaml", () => {
  it("turns escaped quotes, backslashes, and newlines back into characters", () => {
    expect(unescapeYaml(String.raw`line\n\"quote\" and \\`)).toBe('line\n"quote" and \\');
  });
});

describe("readYamlField", () => {
  const text = [
    "---",
    "title: Garden bridge",
    'note: "first line\\nsecond \\"line\\""',
    "featured: true",
    "order: 7",
    "---",
    "",
  ].join("\n");

  it("returns a plain value", () => {
    expect(readYamlField(text, "title")).toBe("Garden bridge");
  });

  it("unescapes a quoted value", () => {
    expect(readYamlField(text, "note")).toBe('first line\nsecond "line"');
  });

  it("leaves booleans and numbers as text", () => {
    expect(readYamlField(text, "featured")).toBe("true");
    expect(readYamlField(text, "order")).toBe("7");
  });

  it("returns an empty string when the key is missing", () => {
    expect(readYamlField(text, "shop")).toBe("");
    expect(readYamlField("", "title")).toBe("");
  });
});

describe("parseFrontmatter", () => {
  it("reads every field in a block", () => {
    const text = '---\ntitle: "Garden bridge"\nmedium: "Acrylic"\norder: 7\nfeatured: true\n---\n';
    expect(parseFrontmatter(text)).toEqual({
      title: "Garden bridge",
      medium: "Acrylic",
      order: "7",
      featured: "true",
    });
  });

  it("reads a CRLF block", () => {
    const text = '---\r\ntitle: "Garden bridge"\nnote: "hi\\nthere"\r\n---\r\n';
    expect(parseFrontmatter(text).title).toBe("Garden bridge");
    expect(parseFrontmatter(text).note).toBe("hi\nthere");
  });

  it("returns an empty object when there is no block", () => {
    expect(parseFrontmatter("title: outside")).toEqual({});
  });

  it("reads a real book file", () => {
    const file = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../src/content/books/acotar.md",
    );
    const data = parseFrontmatter(readFileSync(file, "utf8"));
    expect(data.title).toBe("A Court of Thorns and Roses (A Court of Thorns and Roses, #1)");
    expect(data.note).toContain("more than one edition");
    expect(data.rating).toBe("5");
  });
});

describe("upsertField", () => {
  it("replaces an existing line and inserts a missing field before the closing mark", () => {
    const text = '---\ntitle: "Old"\n---\n';
    const replaced = upsertField(text, "title", 'title: "New"');
    expect(replaced).toBe('---\ntitle: "New"\n---\n');
    const inserted = upsertField(replaced, "note", 'note: "Hello"');
    expect(inserted).toBe('---\ntitle: "New"\nnote: "Hello"\n---');
  });
});
