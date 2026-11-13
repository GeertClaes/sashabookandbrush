import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTIVITY_FILE,
  appendActivity,
  parseActivityLog,
  stringifyActivity,
} from "./lib/activity.mjs";
import {
  featuredSaveDetail,
  planFeaturedBoard,
  planReorder,
  reorderSaveDetail,
} from "../functions/admin/api/_lib/board-save.js";
import {
  contentSaveDetail,
  planContentSave,
  resolveContentWrite,
} from "../functions/admin/api/_lib/content-save.js";
import {
  applyYamlFields,
  readYamlField,
  safeSlug,
} from "../functions/admin/api/_lib/frontmatter.js";
import { syncFromLive } from "../functions/admin/api/_lib/sync-summary.js";
import { deriveBookUpdates } from "../functions/admin/api/_lib/book.js";
import { parseImageUpload } from "../functions/admin/api/_lib/photo.js";
import {
  applySiteCopy,
  prepareCopySave,
  stringifySite,
} from "../functions/admin/api/_lib/site-copy.js";

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
const ART_IMAGES_DIR = path.join(ROOT, "src", "assets", "art");
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.ADMIN_PORT || 8787);
const SITE = String(process.env.PUBLIC_SITE_URL || "http://127.0.0.1:4321").replace(/\/$/, "");
const PASSWORD = process.env.ADMIN_PASSWORD || "";
const TOKEN = createHash("sha256")
  .update(`sbb:${PASSWORD || "local"}`)
  .digest("hex");

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(body));
}

function cors(req, res) {
  const origin = req.headers.origin || "";
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin)) {
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

async function recordLocalActivity(entry) {
  try {
    const file = path.join(ROOT, ACTIVITY_FILE);
    const log = parseActivityLog(await readFile(file, "utf8").catch(() => ""));
    await writeFile(
      file,
      stringifyActivity(appendActivity(log, { ...entry, by: "local" })),
      "utf8",
    );
  } catch {
    // Local activity log is best-effort.
  }
}

async function removeFile(file) {
  try {
    await unlink(file);
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
  }
}

async function readOptional(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function filesForSlugs(dir, slugs) {
  const files = {};
  for (const raw of slugs) {
    let slug;
    try {
      slug = safeSlug(raw);
    } catch (error) {
      if (error instanceof Error && /invalid name/i.test(error.message)) {
        return { error: "Invalid name", status: 400 };
      }
      throw error;
    }
    if (!(slug in files)) files[slug] = await readOptional(path.join(dir, `${slug}.md`));
  }
  return { files };
}

async function writePlan(res, plan, detail) {
  if (plan.error) {
    json(res, plan.status, { error: plan.error });
    return;
  }
  for (const file of plan.files) {
    const abs = path.join(ROOT, file.path);
    if (file.delete) {
      await removeFile(abs);
      continue;
    }
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(
      abs,
      file.encoding === "base64" ? Buffer.from(file.content, "base64") : file.content,
    );
  }
  await recordLocalActivity({
    type: "admin",
    title: plan.activity.title,
    detail,
  });
  json(res, 200, plan.result);
}

async function saveContent(res, kind, body) {
  const target = resolveContentWrite(kind, body);
  if (target.error) {
    json(res, target.status, { error: target.error });
    return;
  }
  const plan = planContentSave({
    kind,
    body,
    existingText: await readOptional(path.join(ROOT, target.filePath)),
  });
  await writePlan(res, plan, contentSaveDetail(plan, { local: true }));
}

async function listBooks() {
  const names = (await readdir(BOOKS_DIR)).filter((name) => name.endsWith(".md"));
  const books = [];
  for (const name of names) {
    const text = await readFile(path.join(BOOKS_DIR, name), "utf8");
    books.push({
      slug: path.basename(name, ".md"),
      title: readYamlField(text, "title"),
      author: readYamlField(text, "author"),
      note: readYamlField(text, "note"),
      featured: readYamlField(text, "featured") === "true",
      cover: readYamlField(text, "cover"),
      rating: Number(readYamlField(text, "rating") || 0),
      status: readYamlField(text, "status") || "read",
    });
  }
  return books.toSorted((a, b) => a.title.localeCompare(b.title));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function lastOutputLine(output) {
  const line = String(output || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) return "";
  return line.length > 240 ? `${line.slice(0, 240)}…` : line;
}

function syncSuccessMessage(output) {
  if (/shelf unchanged/i.test(output)) return "Goodreads shelf is already up to date.";
  if (/kept the previous shelf/i.test(output))
    return "Goodreads returned an empty shelf. The previous one was kept.";
  if (/^Wrote /m.test(output)) return "Goodreads shelf updated on this computer.";
  return "Goodreads sync finished.";
}

function runGoodreadsSync() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/sync-goodreads.mjs"], {
      cwd: ROOT,
      env: { ...process.env, GOODREADS_SYNC_MANUAL: "1" },
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
      else reject(new Error(lastOutputLine(out) || `Goodreads sync exited ${code}`));
    });
  });
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
    if (
      req.method === "GET" &&
      (pathname === "/" || pathname === "/admin" || pathname === "/admin/")
    ) {
      const dest = new URL("/admin", SITE);
      dest.search = url.search;
      res.writeHead(302, {
        Location: dest.href,
        "Content-Type": "text/html; charset=utf-8",
      });
      res.end(
        `<!doctype html><p>The studio editor is at <a href="${dest.href}">${dest.href}</a>. This port is the save API only.</p>`,
      );
      return;
    }

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

    if ((pathname === "/activity" || pathname === "/api/activity") && req.method === "GET") {
      const live = JSON.parse(
        await readFile(path.join(ROOT, "src", "data", "goodreads-live.json"), "utf8").catch(
          () => "{}",
        ),
      );
      const log = parseActivityLog(
        await readFile(path.join(ROOT, ACTIVITY_FILE), "utf8").catch(() => ""),
      );
      json(res, 200, {
        ok: true,
        sync: syncFromLive(live, { source: "local" }),
        events: log.events,
        site: {
          state: "local",
          label: "Local editor — refresh the site to see file changes",
          at: "",
          trigger: "this computer",
          live: true,
          building: false,
          deploymentsAvailable: false,
        },
      });
      return;
    }

    if (pathname === "/api/books" && req.method === "GET") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      const books = await listBooks();
      json(res, 200, {
        books: q
          ? books
              .filter((book) =>
                `${book.title} ${book.author} ${book.slug}`.toLowerCase().includes(q),
              )
              .slice(0, 40)
          : books.slice(0, 40),
      });
      return;
    }

    if (pathname === "/api/book" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const file = path.join(BOOKS_DIR, `${path.basename(body.slug)}.md`);
      let text = await readFile(file, "utf8");
      const { error, updates } = deriveBookUpdates(body);
      if (error) {
        json(res, 400, { error });
        return;
      }
      text = applyYamlFields(text, updates);
      await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
      await recordLocalActivity({
        type: "admin",
        title: `Updated ${updates.title || body.slug}`,
        detail: "Saved on this computer. Refresh the site to see it.",
      });
      json(res, 200, { ok: true });
      return;
    }

    if (pathname === "/api/featured" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const rows = Array.isArray(body.books) ? body.books : [];
      const loaded =
        rows.length > 0 && rows.length <= 20
          ? await filesForSlugs(
              BOOKS_DIR,
              rows.map((row) => row?.slug),
            )
          : { files: {} };
      if (loaded.error) {
        json(res, loaded.status, { error: loaded.error });
        return;
      }
      const plan = planFeaturedBoard(rows, loaded.files);
      await writePlan(res, plan, featuredSaveDetail({ local: true }));
      return;
    }

    if (pathname === "/api/order" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const slugs = Array.isArray(body.slugs) ? body.slugs : [];
      const dir = body.kind === "art" ? ART_DIR : body.kind === "supply" ? SUPPLIES_DIR : "";
      const loaded =
        dir && slugs.length > 0 && slugs.length <= 40
          ? await filesForSlugs(dir, slugs)
          : { files: {} };
      if (loaded.error) {
        json(res, loaded.status, { error: loaded.error });
        return;
      }
      const plan = planReorder({ kind: body.kind, slugs, filesBySlug: loaded.files });
      await writePlan(res, plan, reorderSaveDetail({ local: true }));
      return;
    }

    if (pathname === "/api/art" && req.method === "POST") {
      await saveContent(res, "art", JSON.parse((await readBody(req)) || "{}"));
      return;
    }

    if (pathname === "/api/supply" && req.method === "POST") {
      await saveContent(res, "supply", JSON.parse((await readBody(req)) || "{}"));
      return;
    }

    if (pathname === "/api/cover" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const kind = body.kind === "art" ? "art" : "book";
      const slug = path.basename(body.slug);
      const parsed = parseImageUpload(body, slug, kind);
      if (!parsed.ok) {
        json(res, 400, { error: parsed.error });
        return;
      }
      if (!parsed.photo) {
        json(res, 400, { error: "Missing image" });
        return;
      }
      const photo = parsed.photo;
      if (kind === "art") {
        await mkdir(ART_IMAGES_DIR, { recursive: true });
        await writeFile(
          path.join(ART_IMAGES_DIR, photo.filename),
          Buffer.from(photo.contentBase64, "base64"),
        );
        const file = path.join(ART_DIR, `${slug}.md`);
        let text = await readFile(file, "utf8");
        text = applyYamlFields(text, { image: photo.publicPath });
        await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
        json(res, 200, { ok: true, image: photo.publicPath });
        return;
      }
      await writeFile(
        path.join(COVERS_DIR, photo.filename),
        Buffer.from(photo.contentBase64, "base64"),
      );
      const file = path.join(BOOKS_DIR, `${slug}.md`);
      let text = await readFile(file, "utf8");
      text = applyYamlFields(text, { cover: photo.filename });
      await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
      json(res, 200, { ok: true, cover: photo.filename });
      return;
    }

    if (pathname === "/api/copy" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const file = path.join(ROOT, "src", "data", "site.json");
      const raw = await readFile(file, "utf8");
      const site = JSON.parse(raw);
      let prepared;
      try {
        prepared = prepareCopySave(site, body);
      } catch (error) {
        json(res, 400, { error: error instanceof Error ? error.message : "Check the page text" });
        return;
      }
      const content = stringifySite(prepared.next);
      const current = raw.endsWith("\n") ? raw : `${raw}\n`;
      if (content !== current) {
        for (const upload of prepared.uploads) {
          const dest = path.join(ROOT, upload.path);
          await mkdir(path.dirname(dest), { recursive: true });
          await writeFile(dest, Buffer.from(upload.content, "base64"));
        }
        await writeFile(file, content, "utf8");
        for (const oldPath of prepared.removals) {
          await removeFile(path.join(ROOT, oldPath));
        }
        const source = { ...body };
        delete source.aboutPhoto;
        const textChanged = stringifySite(applySiteCopy(site, source)) !== current;
        await recordLocalActivity({
          type: "admin",
          title:
            textChanged && prepared.photo
              ? "Updated page text and the about photo"
              : prepared.photo
                ? "Updated the about photo"
                : "Updated page text",
          detail: prepared.photo
            ? "Saved on this computer. Refresh About and Work with me to see the photo."
            : "Saved on this computer. Refresh Home, About, and Work with me to see it.",
        });
      }
      json(res, 200, {
        ok: true,
        unchanged: content === current,
        image: prepared.next.about?.image || "",
      });
      return;
    }

    if (pathname === "/api/sync-goodreads" && req.method === "POST") {
      const output = await runGoodreadsSync();
      json(res, 200, { ok: true, message: syncSuccessMessage(output) });
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
  console.log(`Admin API on http://127.0.0.1:${PORT}`);
  console.log(`Open the studio at ${SITE}/admin (npm run dev). This port is the save API only.`);
});
