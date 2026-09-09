import { readFile } from "node:fs/promises";
import path from "node:path";
import { commitFilesFromEnv } from "./lib/github-commit.mjs";

const ROOT = process.cwd();
const FILES = ["src/data/goodreads-live.json", "src/data/activity-log.json"];

if (process.env.CF_PAGES !== "1") {
  process.exit(0);
}

const branch = process.env.CF_PAGES_BRANCH || process.env.GITHUB_BRANCH || "main";
if (branch !== "main") {
  console.log(`Skipping sync log commit on branch ${branch}.`);
  process.exit(0);
}

if (!(process.env.ADMIN_GITHUB_TOKEN || process.env.GITHUB_TOKEN) || !process.env.GITHUB_REPO) {
  console.warn("Skipping sync log commit: ADMIN_GITHUB_TOKEN / GITHUB_REPO not set on Pages.");
  process.exit(0);
}

try {
  const files = [];
  for (const filePath of FILES) {
    files.push({
      path: filePath,
      content: await readFile(path.join(ROOT, filePath), "utf8"),
      encoding: "utf-8",
    });
  }
  const sha = await commitFilesFromEnv(process.env, "Goodreads RSS sync [skip ci]", files);
  console.log(`Recorded Goodreads sync on GitHub (${sha.slice(0, 7)}).`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Could not record Goodreads sync on GitHub (${message}).`);
}
