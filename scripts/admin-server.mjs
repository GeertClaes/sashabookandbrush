import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  const text = readFileSync(path.join(ROOT, ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  // Local .env is optional.
}
const BOOKS_DIR = path.join(ROOT, "src", "content", "books");
const ART_DIR = path.join(ROOT, "src", "content", "art");
const SUPPLIES_DIR = path.join(ROOT, "src", "content", "supplies");
const COVERS_DIR = path.join(ROOT, "src", "assets", "covers");
const ART_IMAGES_DIR = path.join(ROOT, "public", "images", "art");
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.ADMIN_PORT || 8787);
const PASSWORD = process.env.ADMIN_PASSWORD || "";
const TOKEN = createHash("sha256").update(`sbb:${PASSWORD || "local"}`).digest("hex");

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(body));
}

function cors(req, res) {
  const origin = req.headers.origin || "";
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function authorized(req) {
  if (!PASSWORD) return true;
  const cookie = String(req.headers.cookie || "");
  const match = cookie.match(/sbb_admin=([^;]+)/);
  return match?.[1] === TOKEN;
}

function unescapeYaml(value) {
  return String(value).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`;
}

function frontField(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return "";
  let value = match[1].trim();
  if (value.startsWith('"') && value.endsWith('"')) return unescapeYaml(value.slice(1, -1));
  return value;
}

function upsertField(text, key, line) {
  if (new RegExp(`^${key}:`, "m").test(text)) {
    return text.replace(new RegExp(`^${key}:.*$`, "m"), line);
  }
  return text.replace(/\n---\s*$/, `\n${line}\n---`);
}

function removeField(text, key) {
  return text.replace(new RegExp(`^${key}:.*\\r?\\n`, "m"), "");
}

function applyYamlFields(text, updates) {
  let next = text;
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (value === "" || value === null) {
      next = removeField(next, key);
      continue;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      next = upsertField(next, key, `${key}: ${value}`);
    } else {
      next = upsertField(next, key, `${key}: ${yamlString(value)}`);
    }
  }
  return next;
}

function affiliateValue(value) {
  return String(value || "").trim();
}

function slugFromTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function removeFile(file) {
  try {
    await unlink(file);
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
  }
}

function artPhotoFile(image) {
  const value = String(image || "").trim();
  const match = value.match(/^\/images\/art\/([a-z0-9._-]+)$/i);
  return match ? path.join(ART_IMAGES_DIR, match[1]) : "";
}

async function listBooks() {
  const names = (await readdir(BOOKS_DIR)).filter((name) => name.endsWith(".md"));
  const books = [];
  for (const name of names) {
    const text = await readFile(path.join(BOOKS_DIR, name), "utf8");
    books.push({
      slug: path.basename(name, ".md"),
      title: frontField(text, "title"),
      author: frontField(text, "author"),
      note: frontField(text, "note"),
      featured: frontField(text, "featured") === "true",
      cover: frontField(text, "cover"),
      rating: Number(frontField(text, "rating") || 0),
      status: frontField(text, "status") || "read",
    });
  }
  return books.sort((a, b) => a.title.localeCompare(b.title));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function runImport() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/import-goodreads.mjs", "--skip-covers"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (data) => {
      out += data;
    });
    child.stderr.on("data", (data) => {
      out += data;
    });
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(out.trim() || `import exited ${code}`));
    });
  });
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname.replace(/^\/admin(?=\/)/, "") || "/";

  try {
    if ((pathname === "/health" || pathname === "/api/health") && req.method === "GET") {
      json(res, 200, { ok: true, email: "local", auth: Boolean(PASSWORD) || "localhost-open" });
      return;
    }

    if ((pathname === "/login" || pathname === "/api/login") && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const ok = PASSWORD ? body.password === PASSWORD : true;
      if (!ok) {
        json(res, 401, { error: "Wrong password" });
        return;
      }
      res.setHeader("Set-Cookie", `sbb_admin=${TOKEN}; HttpOnly; Path=/; SameSite=Lax`);
      json(res, 200, { ok: true });
      return;
    }

    if (!authorized(req)) {
      json(res, 401, { error: "Sign in first" });
      return;
    }

    if (pathname === "/api/books" && req.method === "GET") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const books = await listBooks();
      json(res, 200, {
        books: q
          ? books.filter((book) => `${book.title} ${book.author} ${book.slug}`.toLowerCase().includes(q)).slice(0, 40)
          : books.slice(0, 40),
      });
      return;
    }

    if (pathname === "/api/book" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const file = path.join(BOOKS_DIR, `${path.basename(body.slug)}.md`);
      let text = await readFile(file, "utf8");
      const updates = {};
      if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
      if (typeof body.author === "string" && body.author.trim()) updates.author = body.author.trim();
      if (typeof body.genre === "string") updates.genre = body.genre.trim() || "Read";
      if (typeof body.note === "string") updates.note = body.note;
      if (typeof body.featured === "boolean") updates.featured = body.featured;
      if (typeof body.bookshop === "string") updates.bookshop = affiliateValue(body.bookshop);
      if (typeof body.amazon === "string") updates.amazon = affiliateValue(body.amazon);
      text = applyYamlFields(text, updates);
      await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/art" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (body.delete) {
        const slug = path.basename(String(body.slug || ""));
        if (!slug) {
          json(res, 400, { error: "Missing name" });
          return;
        }
        const file = path.join(ART_DIR, `${slug}.md`);
        let existing = null;
        try {
          existing = await readFile(file, "utf8");
        } catch {
          json(res, 404, { error: "Painting not found" });
          return;
        }
        const photo = artPhotoFile(frontField(existing, "image"));
        await removeFile(file);
        if (photo) await removeFile(photo);
        json(res, 200, { ok: true, slug, deleted: true });
        return;
      }
      const title = String(body.title || "").trim();
      if (!title) {
        json(res, 400, { error: "Title is required" });
        return;
      }
      const slug = path.basename(body.slug || slugFromTitle(title));
      const file = path.join(ART_DIR, `${slug}.md`);
      let existing = null;
      try {
        existing = await readFile(file, "utf8");
      } catch {
        existing = null;
      }
      if (body.create && existing) {
        json(res, 409, { error: "A painting with that name already exists" });
        return;
      }
      if (!body.create && !existing) {
        json(res, 404, { error: "Painting not found" });
        return;
      }
      const medium = String(body.medium || "Acrylic").trim() || "Acrylic";
      const note = typeof body.note === "string" ? body.note : "";
      const featured = Boolean(body.featured);
      const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0;
      const image = typeof body.image === "string" ? body.image.trim() : "";
      let text = existing;
      if (!text) {
        text = `---
title: ${yamlString(title)}
medium: ${yamlString(medium)}
note: ${yamlString(note)}
featured: ${featured}
order: ${order}
${image ? `image: ${yamlString(image)}\n` : ""}---
`;
      } else {
        const updates = { title, medium, note, featured, order };
        if (image) updates.image = image;
        text = applyYamlFields(text, updates);
      }
      await mkdir(ART_DIR, { recursive: true });
      await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
      json(res, 200, { ok: true, slug });
      return;
    }

    if (pathname === "/api/supply" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (body.delete) {
        const slug = path.basename(String(body.slug || ""));
        if (!slug) {
          json(res, 400, { error: "Missing name" });
          return;
        }
        const file = path.join(SUPPLIES_DIR, `${slug}.md`);
        try {
          await unlink(file);
        } catch {
          json(res, 404, { error: "Tool not found" });
          return;
        }
        json(res, 200, { ok: true, slug, deleted: true });
        return;
      }
      const title = String(body.title || "").trim();
      if (!title) {
        json(res, 400, { error: "Title is required" });
        return;
      }
      const slug = path.basename(body.slug || slugFromTitle(title));
      const file = path.join(SUPPLIES_DIR, `${slug}.md`);
      let existing = null;
      try {
        existing = await readFile(file, "utf8");
      } catch {
        existing = null;
      }
      if (body.create && existing) {
        json(res, 409, { error: "A tool with that name already exists" });
        return;
      }
      if (!body.create && !existing) {
        json(res, 404, { error: "Tool not found" });
        return;
      }
      const brand = String(body.brand || "").trim();
      const category = String(body.category || "Studio").trim() || "Studio";
      const note = typeof body.note === "string" ? body.note : "";
      const amazon = affiliateValue(body.amazon);
      const shop = String(body.shop || "").trim();
      const shopLabel = String(body.shopLabel || "").trim();
      const featured = Boolean(body.featured);
      const order = Number.isFinite(Number(body.order)) ? Number(body.order) : 0;
      let text = existing;
      if (!text) {
        text = `---
title: ${yamlString(title)}
brand: ${yamlString(brand)}
category: ${yamlString(category)}
note: ${yamlString(note)}
amazon: ${yamlString(amazon)}
${shop ? `shop: ${yamlString(shop)}\nshopLabel: ${yamlString(shopLabel || "Shop")}\n` : ""}featured: ${featured}
order: ${order}
---
`;
      } else {
        text = applyYamlFields(text, {
          title,
          brand,
          category,
          note,
          amazon,
          shop,
          shopLabel,
          featured,
          order,
        });
      }
      await mkdir(SUPPLIES_DIR, { recursive: true });
      await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
      json(res, 200, { ok: true, slug });
      return;
    }

    if (pathname === "/api/cover" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const kind = body.kind === "art" ? "art" : "book";
      const slug = path.basename(body.slug);
      const ext = path.extname(body.filename || ".jpg").toLowerCase() || ".jpg";
      const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
      const filename = `${slug}${safeExt}`;
      if (kind === "art") {
        await mkdir(ART_IMAGES_DIR, { recursive: true });
        await writeFile(path.join(ART_IMAGES_DIR, filename), Buffer.from(body.contentBase64, "base64"));
        const file = path.join(ART_DIR, `${slug}.md`);
        let text = await readFile(file, "utf8");
        text = applyYamlFields(text, { image: `/images/art/${filename}` });
        await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
        json(res, 200, { ok: true, image: `/images/art/${filename}` });
        return;
      }
      await writeFile(path.join(COVERS_DIR, filename), Buffer.from(body.contentBase64, "base64"));
      const file = path.join(BOOKS_DIR, `${slug}.md`);
      let text = await readFile(file, "utf8");
      text = applyYamlFields(text, { cover: filename });
      await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
      json(res, 200, { ok: true, cover: filename });
      return;
    }

    if (pathname === "/api/csv" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      await writeFile(path.join(DATA_DIR, "export.csv"), Buffer.from(body.contentBase64, "base64"));
      const log = await runImport();
      json(res, 200, { ok: true, log });
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : "Server error" });
  }
});

if (!PASSWORD) {
  console.warn("ADMIN_PASSWORD is not set. Admin is open on this machine only.");
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Admin API on http://127.0.0.1:${PORT} — open /admin on the site while this is running.`);
});
