# AGENTS.md

Technical notes for an AI coding agent (or anyone else) working in this repo.
Read this before making a change that touches the admin editor, the Goodreads
sync, or the shared `_lib`/`lib` modules. See [README.md](README.md) for
what the site is and how to run it; this file is about how the code is put
together and the non-obvious things worth knowing first.

## The shape of the project

- **Public site**: Astro, static output, served by Cloudflare Pages. No
  server renders a request live.
- **Content**: every book, painting, and tool is a markdown file with
  frontmatter under `src/content/{books,art,supplies}`. Site-wide copy and
  small config/state live in JSON under `src/data/`. There is no database —
  git history is the data store and the audit log.
- **Admin editor** (`/admin`, `src/pages/admin.astro`): a single hand-rolled
  page, no UI framework. It saves by writing directly to those same content
  files, through one of two backends:
  - **Production**: `functions/admin/api/*.js`, Cloudflare Pages Functions
    that write via GitHub's REST/Git Data API.
  - **Local dev**: `scripts/admin-server.mjs`, a plain Node HTTP server
    (`npm run admin`) that writes to the filesystem directly, so the editor
    works fully offline.

## The pure-function + thin-adapter pattern (read this before touching a save route)

Every admin save/delete/reorder route follows the same shape, and it's the
single most important convention in this codebase:

1. A **pure function** in `functions/admin/api/_lib/` decides *what* a save
   should do: validate the body, compute the slug, build the new YAML/
   markdown, decide which files to write/delete, and what the activity-log
   entry should say. It never calls `fetch`, touches `fs`, or reads
   `process.env`/`context.env`. It takes plain data in and returns plain
   data out (a plan: `{ files, result, activity, ... }`, or `{ error, status }`).
2. Two thin **adapters** call that pure function and perform the actual I/O:
   - The Cloudflare Function (`functions/admin/api/art.js`, `supply.js`,
     `featured.js`, `order.js`, ...) turns the plan into GitHub blob/tree/
     commit calls via `_lib/github.js`'s `commitFiles`.
   - `scripts/admin-server.mjs` turns the same plan into `fs.writeFile`/
     `fs.unlink` calls.

The key files for this pattern:

| File | What it decides |
| --- | --- |
| `functions/admin/api/_lib/content-save.js` | Create/update/delete a painting or tool (`planContentSave`), including when to delete its photo |
| `functions/admin/api/_lib/board-save.js` | The featured-books board and the art/tool reorder list (`planFeaturedBoard`, `planReorder`) |
| `functions/admin/api/_lib/book.js` | Field validation for a book update (`deriveBookUpdates`) |
| `functions/admin/api/_lib/art.js`, `supply.js` | Field validation + YAML templates for a painting/tool (`deriveArtFields`/`artMarkdown`, `deriveSupplyFields`/`supplyMarkdown`) |
| `functions/admin/api/_lib/frontmatter.js` | Generic YAML read/write: `readYamlField`, `parseFrontmatter`, `applyYamlFields`, `safeSlug`, `slugFromTitle`, `emptyAffiliateUrl`, `firstHttpUrl`, `taggedAmazonUrl` |
| `functions/admin/api/_lib/photo.js` | Validates an uploaded photo and returns one `repoPath` for the given `kind` ("art"/"book"/"supply"/"about") |
| `functions/admin/api/_lib/activity.js` | The activity-log core: `parseActivityLog`, `activityEntry`, `appendActivity`, `MAX_EVENTS` (also re-exported by `scripts/lib/activity.mjs`, which adds Goodreads-diff-only helpers on top) |
| `functions/admin/api/_lib/sync-summary.js` | Builds the Overview page's `sync` object from `goodreads-live.json` (`syncFromLive`) — used by both backends |
| `functions/admin/api/_lib/github.js` | The one GitHub commit implementation (`commitFiles`: blob → tree → commit → ref update) |
| `functions/admin/api/_lib/content-commit.js` | The Cloudflare-side adapter that turns a `content-save.js` plan into a GitHub commit (`handleContentPost`) |

**If you need to change what a save does** (a new field, a new validation
rule, a new piece of the activity-log message), change the pure function in
`_lib/`, not the two adapters — and check both `functions/admin/api/*.js`
*and* `scripts/admin-server.mjs` still call it the same way. **If you need
to change *how* a save happens** (e.g. a new GitHub API call shape), that's
adapter-only.

This pattern intentionally does **not** extend to covering every last
difference: local saves always say "Saved on this computer. Refresh the
site to see it."; production saves describe the GitHub commit and
Cloudflare rebuild. Don't try to unify those strings — see
`contentSaveDetail`/`featuredSaveDetail`/`reorderSaveDetail` for the
pattern of keeping one string per environment next to the shared plan.

## admin.astro: shell + extracted modules

`src/pages/admin.astro` is the shell: the Astro frontmatter (content
collection queries, building the JSON payloads passed to the client script),
the HTML template, and a client `<script>` that owns the actual mutable
editor state (`currentBook`, `currentArt`, `currentSupply`, the book
queue/search state, drag-reorder). Logic that doesn't need that shared
state lives in `src/lib/`:

| Module | What it has |
| --- | --- |
| `src/lib/admin-format.js` | `escapeHtml`, `formatWhen`, `formatTimeline`, `shortSyncProblem`, `toBase64` |
| `src/lib/sync-timeline.js` | Merges the Goodreads sync + site-build status into the Recent timeline's event list |
| `src/lib/admin-timeline-ui.js` | Renders the step-panel (save/sync progress) and the Recent timeline's HTML |
| `src/lib/admin-copy-ui.js` | The Pages/Copy tab's field-widget DOM builders (`labelledField`, `copySection`, `cardRow`, ...) and the reverse: reading the rendered form back into a plain object (`readCopy`) |
| `src/lib/admin-copy-page.js` | Assembles the Copy tab from the widgets above, plus the about-photo control and the dirty-check (`isCopyDirty`) |
| `src/lib/admin-books-ui.js` | Book search/queue filtering, the featured board, the book-row template |
| `src/lib/admin-lists.js` | One renderer (`renderKindList`) and one comparator (`sortByOrderThenTitle`) shared by the art and tool lists — a per-kind config supplies the flag labels/thumbnail/chips/draggable-ness |
| `src/lib/admin-save-ui.js` | `createSaveUi()`: a factory wrapping the save/rebuild-watching step panel (`withSave`, `watchRebuild`) and its local `saving`/`saveWatch` state |
| `src/lib/affiliates.ts` | `realUrl`, `taggedAmazon`, `tagAmazonUrl` — used by both the public site and (via `tagAmazonUrl`) the admin page |

The main `<script>` in admin.astro has `// @ts-nocheck` at the top. That's
not a project-wide policy — it's there because that specific script predates
strict typing and has a lot of unguarded `document.querySelector(...).value`
style code and untyped state variables. **New modules extracted from it
should be typed properly (JSDoc `@param`/`@type`, `instanceof` guards on
DOM lookups) and should not need `@ts-nocheck`** — `admin-copy-ui.js`,
`admin-lists.js`, etc. all typecheck cleanly without it. If you're about to
add `@ts-nocheck` to a new file, that's a signal to add the types instead.

DOM-returning functions (e.g. `renderKindList`) are still unit tested: pass
a plain `{ innerHTML: "" }` object instead of a real element and assert on
the resulting HTML string — no jsdom dependency needed. See
`src/lib/admin-lists.test.js` for the pattern.

## Gotchas worth knowing before you hit them

- **`<script define:vars={...}>` is always inline and can't `import`.** If a
  client script needs to `import` from `src/lib/`, it must be a plain
  `<script>` (no `define:vars`), and server data has to be passed through a
  separate `<script type="application/json" id="...">` tag that the client
  script parses (see `admin-config`, `book-catalog`, etc. in admin.astro).
  A plain `<script>` is *also* then type-checked by the project's strict
  tsconfig, unlike an inline one — see the `@ts-nocheck` note above.
- **Astro 7's compiler does not collapse whitespace** between two adjacent
  `{expr}` expressions separated only by a newline the way Astro 5 did —
  `{a}\n{b}` in a text context can render as `ab` with no space. Check for
  this pattern after any future Astro upgrade.
- **Oxfmt has no native Astro formatter.** `npm run format`/`format:check`
  intentionally exclude `.astro` files (see `package.json`'s glob) — adding
  real `.astro` formatting means pulling in `prettier-plugin-astro` (and
  therefore Prettier) as a dependency, which was explicitly decided against.
  Oxlint still lints the JS/TS inside `.astro` files; it just isn't
  reformatted.
- **TypeScript is intentionally pinned below 7.0** (`^5.9.x` in
  `package.json`). TS 7 is a native-Go rewrite that drops the old
  programmatic compiler API Astro's tooling still depends on.
- **`Array#sort()` mutates in place; `toSorted()` doesn't.** Oxlint flags
  bare `.sort()` calls. Before converting one to `.toSorted()`, check
  whether the code relies on the mutation (e.g. a shared array that other
  code reads after the sort) — there's at least one intentional in-place
  `.sort()` left in admin.astro (after pushing/updating a tool) that must
  stay a mutation.
- **Local dev needs two servers running together**: `npm run dev` (the
  Astro site, port 4321) and `npm run admin` (the save API, port 8787). On
  first load (or shortly after a reload), the editor can show "Checking the
  editor…" if the admin server wasn't fully up yet — reload once more. This
  is a harmless timing quirk, not a bug.
- **Live-testing Sync Now, book/art/tool saves, or reorder writes real
  files**: `src/data/activity-log.json`, `src/data/goodreads-live.json`,
  and the touched `src/content/**/*.md` order/fields. Always `git checkout
  --` these back after a manual/browser test so they don't end up in a
  commit.
- **Some files show as modified in `git status` with zero real diff**
  (currently `functions/admin/api/{art,book,supply}.js`,
  `scripts/admin-server.mjs`) purely from CRLF/LF normalization on a
  Windows checkout. Run `git diff <file>` before adding one of these to a
  commit — if it's empty, leave the file out.
- **`scripts/lib/goodreads-parse.mjs`** (the Goodreads *HTML shelf widget*
  parser used by `sync-goodreads.mjs`) and **`scripts/lib/goodreads-csv.mjs`**
  (the Goodreads *CSV export* parser used by `import-goodreads.mjs`) are
  deliberately separate modules — they parse two different documents for
  two different workflows (the nightly sync vs. a one-off bulk import).
  Don't merge them.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Astro dev server (public site + admin page), port 4321 |
| `npm run admin` | Local admin save API, port 8787 — run alongside `dev` |
| `npm run lint` / `lint:fix` | Oxlint |
| `npm run format` / `format:check` | Oxfmt (`.ts`/`.js` only, see Gotchas) |
| `npm run test` | Vitest, all `*.test.{js,mjs,ts}` files |
| `npm run build` | Full production build (fetches Goodreads data first) |
| `npm run build:ci` | Plain `astro build`, no network — what CI runs |

Before committing a change, run the smallest relevant subset of
`lint` / `format:check` / `test` / `build:ci`, and if you touched the admin
editor's save path or UI, smoke-test it live with `dev` + `admin` running
together (see the Gotchas above about reverting any data files that test
touches).
