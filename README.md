# sashabookandbrush

Personal site for [@sashabookandbrush](https://instagram.com/sashabookandbrush), live at [sashabookandbrush.com](https://sashabookandbrush.com): books, art, affiliate links, and a work-with-me page that points to Instagram.

**Goodreads is the diary; this site is the shop window.** She rates and logs progress on Goodreads. The site does not write back. The full TBR stays off the public Books page.

See [Plan.md](Plan.md) for remaining go-live and account work, and [WebsiteBuildPlan.md](WebsiteBuildPlan.md) for what is already in the repo.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321).

```bash
npm run build
npm run preview
```

## Environment configuration

Secrets never go in git. There are three places to set them.

| Where | What it is for |
| --- | --- |
| `.env` in this repo (copy from `.env.example`) | Local `npm run dev` / `npm run admin` only |
| **Workers & Pages → sashabookandbrush → Settings → Variables and secrets → Production** | Live site, `/admin` API, Overview rebuild status |
| **Cron Worker** (this repo: `workers/rebuild-pages/`; dashboard may show a different name) | The 6-hour rebuild trigger only |

After you change Pages variables, trigger a **new production deploy**. Functions and the build only see new values on the next build.

Cloudflare also injects `CF_PAGES` and `CF_PAGES_BRANCH` during Pages builds. Do not set those yourself.

### Local `.env`

```bash
cp .env.example .env
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | No | Password for local `/admin`. If empty, the local API is open on this machine only |
| `PUBLIC_ADMIN_URL` | No | Local editor API. Default `http://127.0.0.1:8787` |
| `ADMIN_PORT` | No | Port for `npm run admin`. Default `8787` |
| `PUBLIC_FORMSPREE_ID` | No | Shop waitlist form id (the part after `/f/` on Formspree). Without it, Shop links to Instagram |

Do not put GitHub or Cloudflare tokens in `.env` unless you are debugging Pages Functions locally.

### Cloudflare Pages (production)

**Workers & Pages** → click **sashabookandbrush** (the GitHub-connected Pages project, not the account list) → **Settings** → **Variables and secrets** → **Production**.

Mark tokens as **Secret**.

#### GitHub (admin saves)

1. On GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens** (your user settings, not the repo).
2. Resource owner: the user who owns `GeertClaes/sashabookandbrush`. Repository access: **Only select repositories** → this repo.
3. Permissions: **Contents → Read and write**.
4. Also in the repo: **Settings → Actions → General → Workflow permissions → Read and write** (CSV import Action commits back).

| Variable | Example | Purpose |
| --- | --- | --- |
| `ADMIN_GITHUB_TOKEN` | `github_pat_…` | Admin saves and cover uploads |
| `GITHUB_REPO` | `GeertClaes/sashabookandbrush` | Repo the admin API commits to |
| `GITHUB_BRANCH` | `main` | Branch to commit to |

Goodreads RSS is pulled during the Pages **build**. It updates the live site only. It does **not** commit back to GitHub, so those `[skip ci]` log commits should no longer appear on `main`.

#### Cloudflare Access (lock `/admin` to Google)

1. [Zero Trust](https://one.dash.cloudflare.com) → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. Domain `sashabookandbrush.com`, path `/admin*`. Repeat for `*.pages.dev`, or turn off preview deployments so `/admin` is not public there.
3. Identity: **Google**. Policy: allow Sasha’s Gmail and yours.
4. Copy the application **AUD** and team domain (`something.cloudflareaccess.com`).

| Variable | Example | Purpose |
| --- | --- | --- |
| `CF_ACCESS_TEAM_DOMAIN` | `your-team.cloudflareaccess.com` | Validates the Access JWT |
| `CF_ACCESS_AUD` | the AUD tag from the Access app | Same |
| `ADMIN_EMAILS` | `sasha@gmail.com,you@gmail.com` | Extra allow-list after Google sign-in |

#### Overview rebuild status (optional)

Needed only if `/admin` → **Overview** should show “Site is live” / “Rebuild in progress”. Saves and Goodreads sync work without these.

**Account ID:** [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**. Copy **Account ID** from the right sidebar.

**API token:**

1. **Manage account → Account API tokens** → **Create Token**.
2. **Start from scratch** (this UI’s name for a custom token).
3. Scope the policy to the **KWOKAH account**, not only the `sashabookandbrush.com` domain. Pages APIs are account-level.
4. **Developer Platform** (or search `Pages`) → **Cloudflare Pages → Read**.
5. **Review token** → create → copy the secret once.

| Variable | Example | Purpose |
| --- | --- | --- |
| `CF_ACCOUNT_ID` | `a8451fd1…` | Account that owns the Pages project |
| `CF_API_TOKEN` | the token you just created | Lists recent Pages deployments |
| `CF_PAGES_PROJECT` | `sashabookandbrush` | Only set this if the Pages project name is different |

#### Shop waitlist (optional)

| Variable | Purpose |
| --- | --- |
| `PUBLIC_FORMSPREE_ID` | Same as local. Set on Pages if you want the live Shop form |

`PUBLIC_` variables are baked into the static HTML at **build** time.

### Cron Worker (Goodreads rebuild)

This is a **separate** Worker from the Pages project. It only needs one secret.

1. Pages project → **Settings → Builds → Deploy hooks** → hook for `main`. Copy the URL. Do not put it in the repo.
2. Deploy the Worker from this repo (once):

```bash
npx wrangler deploy --config workers/rebuild-pages/wrangler.toml
npx wrangler secret put CLOUDFLARE_PAGES_DEPLOY_HOOK --config workers/rebuild-pages/wrangler.toml
```

| Variable | Where | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_PAGES_DEPLOY_HOOK` | Worker secret (`wrangler secret put`) | POSTed every 6 hours so Pages rebuilds and refreshes currently reading |

Do not add the deploy-hook URL to the Pages env vars list.

### Quick check

| You want | Must be set |
| --- | --- |
| Local site | none |
| Local `/admin` | `npm run admin`; optional `ADMIN_PASSWORD` |
| Live `/admin` saves | Access app + `ADMIN_GITHUB_TOKEN`, `GITHUB_REPO`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` |
| Goodreads log on Overview | None extra — it is written during the Pages build |
| Live rebuild spinner on Overview | `CF_ACCOUNT_ID` + `CF_API_TOKEN` |
| Cron currently-reading refresh | Worker secret `CLOUDFLARE_PAGES_DEPLOY_HOOK` |
| Shop email waitlist | `PUBLIC_FORMSPREE_ID` on Pages (and locally if you test it) |

## How to update content

You do not need to touch the page templates for ordinary updates.

### Add or edit a book

1. Create or edit a file in `src/content/books/` (one markdown file per book).
2. Fill in the frontmatter:

```yaml
---
title: "Fourth Wing"
author: "Rebecca Yarros"
cover: "fourth-wing.jpg"
note: "A short personal note — a couple of sentences is enough."
rating: 5
genre: "Romantasy"
status: "read"
featured: true
order: 1
isbn: "9781649374042"
dateRead: "2024-06-12"
---
```

Leave `bookshop` / `amazon` out unless you need a special-edition URL. Buy buttons are built from ISBN plus the IDs in `src/data/site.json`.

3. Put the cover image in `src/assets/covers/` and set `cover` to the filename. Astro will optimize it.
4. Set `featured: true` to show it on the home page (aim for 4–9).
5. `status` is `read` or `currently-reading`. Use `order` only as a fallback; the Books page sorts by date, rating, title, and so on.
6. Rebuild or refresh the dev server.

Each book also gets a page at `/books/<filename>` (for example `/books/fourth-wing`) with the note, rating, publisher/year, added and read dates, a page-length phrase, rereads, ISBN, and buy buttons. Cards on Home and Books link there.

The Books page (`/recommendations`) has three views: a five-star wall, the full library (shelf, rating, genre, year, search), and series stacks. Genres are generated from these files. On small screens the view tabs are icon-only.

### Import from Goodreads

Copy-paste will not work for hundreds of books. Goodreads has an official CSV export (desktop browser only):

1. Log in at [goodreads.com](https://www.goodreads.com) on a computer.
2. Go to **My Books** → **Import and export** (under Tools in the left sidebar). Direct: [goodreads.com/review/import](https://www.goodreads.com/review/import).
3. Click **Export Library** and wait for the download link (a large shelf can take a few minutes).
4. Save the file as `data/export.csv` (or `data/goodreads_library_export.csv`) in this repo.
5. Run:

```bash
npm run import:goodreads
```

That imports **read books with a rating of 1–5** plus anything on the **currently-reading** shelf (Goodreads allows more than one). TBR/`to-read` rows stay off the site. Existing files are **merged**, not rewritten: notes, covers, `featured`, custom affiliate URLs, and curated slugs are kept. ISBN, dates, rating, and shelf status update from Goodreads.

On Windows, extra flags after `npm run` can get eaten by npm. Prefer:

```bash
npm run import:goodreads
node scripts/import-goodreads.mjs --check
node scripts/import-goodreads.mjs --skip-covers
node scripts/import-goodreads.mjs --missing-covers
node scripts/import-goodreads.mjs --min-rating=4
node scripts/import-goodreads.mjs "C:\path\to\export.csv"
npm run sync:goodreads
```

`npm run sync:goodreads` pulls public RSS (currently reading, progress, a short TBR) into `src/data/goodreads-live.json` without a CSV. Production uses the Cloudflare Worker cron below.

Then refresh the Books page. Shelf, rating, genre, year read, and sort are independent. Covers are downloaded into `src/assets/covers/` so Astro can optimize them. Review HTML such as `<br/>` is turned into real line breaks.

### Library editor (`/admin`)

Rate books on Goodreads. The studio editor at `/admin` is for a public note, a featured home card, a cover, a painting, a recommended tool, or a CSV drop. Tabs are **Overview**, **Books**, **Art**, and **Tools**. You can delete a painting or a tool (with a confirm). Books stay until a CSV import removes them. The page is not in the public nav — bookmark [sashabookandbrush.com/admin](https://sashabookandbrush.com/admin).

On the live site, Cloudflare Access asks for **Google sign-in** before `/admin` opens. Saves commit to GitHub; Pages rebuilds (usually about a minute). A CSV upload writes `data/export.csv`, then [`.github/workflows/import-csv.yml`](.github/workflows/import-csv.yml) runs `import-goodreads.mjs --skip-covers` and commits library files.

Set Access, GitHub, and optional rebuild-status variables as described in [Environment configuration](#environment-configuration). API writes fail closed until Access and the GitHub token are set.

**Overview** shows the last Goodreads RSS sync (success/fail, currently reading, what changed) and a log of editor saves. Saves hit GitHub immediately; the public site updates when Pages finishes rebuilding (usually about a minute).

Locally:

```bash
npm run admin
```

Then open `/admin` on the dev server. Optional `ADMIN_PASSWORD` in `.env`.

### Add or edit art

1. Create a file in `src/content/art/` (one markdown file per piece).
2. Fill in the frontmatter:

```yaml
---
title: "Mountain study"
medium: "Acrylic"
image: "/images/art/mountain-study.jpg"
note: "A short note about the piece."
featured: true
order: 1
---
```

3. Put the photo in `public/images/art/` and point `image` at that path. Leave `image` out until you have one — the card uses a branded placeholder until the photo is up.
4. Set `featured: true` to show it on the home page.

### Add or edit art supplies

The usual way is **Studio editor → Tools** at `/admin` (title, brand, category, note, affiliate links, featured, order). You can still edit files directly:

1. Create a file in `src/content/supplies/` (one markdown file per item).
2. Fill in the frontmatter:

```yaml
---
title: "Liquitex Basics acrylics"
brand: "Liquitex"
category: "Paint"
note: "Why this one earns a spot on the desk."
amazon: "https://www.amazon.co.uk/dp/EXAMPLE?tag=YOUR-TAG-21"
shop: "https://www.jacksonsart.com/..."
shopLabel: "Jackson's"
featured: true
order: 1
---
```

3. `amazon` is the primary button. `shop` / `shopLabel` are optional (Jackson's, Cass Art, etc.).
4. Set `featured: true` to show it on the home page.

### Dark mode

The sun/moon button in the header toggles light and dark. The choice is saved in the browser. Dark mode uses `public/images/SashaHeroDark.jpg` for the home hero and About photo.

### Affiliate links

Buy buttons are built from ISBN plus IDs in `src/data/site.json`:

- `affiliates.bookshopUkId` — Bookshop.org UK (primary)
- `affiliates.amazonTag` — Amazon.co.uk Associates tracking ID (usually ends in `-21`)

Leave those blank until the accounts exist; buttons hide when there is no ISBN and no override. Amazon links go to `amazon.co.uk`. Per-book `bookshop` / `amazon` fields are optional — only add them for special editions. Buttons show on book pages and featured home cards, not on the full list.

The footer already includes an affiliate disclosure.

### Currently reading

The home shelf and progress % come from public Goodreads RSS (`npm run sync:goodreads`). That also writes a short “Up next” TBR teaser. The full library (ratings, reviews, covers) still needs a CSV import.

`npm run build` runs the RSS sync first, then Astro. If Goodreads is down, the last `src/data/goodreads-live.json` is kept so the deploy still works. The result is baked into the site (and `/data/goodreads-live.json` for Overview). It is not committed to git. On production, a Cloudflare Worker cron triggers that rebuild.

### Cloudflare Pages

The production site is static. RSS cannot update the live HTML unless Pages rebuilds. Use a **Cloudflare Worker cron**, not GitHub Actions.

Build command: `npm run build` (includes the Goodreads RSS sync). Create the deploy hook and Worker secret as in [Environment configuration](#environment-configuration) → **Cron Worker**.

The Worker runs every 6 hours UTC (`0 */6 * * *`). Each run POSTs the hook; Pages rebuilds currently reading / progress / up next. Free Pages is 500 builds/month; 6-hour cron is about 120. For daily instead, change the cron in `wrangler.toml` to `0 6 * * *` and redeploy.

Do not also schedule a GitHub Action against the same hook.

CSV can also be uploaded on `/admin`. That commits `data/export.csv`; GitHub Actions imports it with `--skip-covers` and Pages rebuilds again. New covers can be added in the editor afterwards, or run `node scripts/import-goodreads.mjs --missing-covers` locally.

### Site copy and stats

Edit `src/data/site.json` for:

- Hero text, About bio, Art page copy
- Instagram URL and Goodreads profile
- Shop placeholder copy
- Follower / library stats on About

`offers` and `packages` in that file are unused for now. `/work` is Instagram-only.

### Shop waitlist

Create a form at [Formspree](https://formspree.io) and set `PUBLIC_FORMSPREE_ID` as in [Environment configuration](#environment-configuration). Until that is set, Shop links to Instagram. Collaborations also go through Instagram (`/work`).

### Favicon and share card

The mark is a cream tile, navy book, gold italic **S**, and a diagonal brush (`public/favicon.svg`, `public/icon.svg`, `public/images/og.svg`). Cover and art placeholders use the same drawing.

After editing those SVGs, regenerate the PNGs:

```bash
node scripts/render-brand-assets.mjs
```

## Docker (home server)

```bash
docker compose up --build -d
```

The site is served on port **8080**. Production is Cloudflare Pages; this compose file is only a home-server fallback.

## Design

Warm, bookish palette: cream background (`#F5EFE4`), burgundy primary, forest green secondary, rust accent. Headings use Fraunces; body uses DM Sans. Header and footer wordmark: `SashaBook&Brush`.

The favicon and share image use a navy book and gold **S** on a cream tile (see above). The home hero and About photo use `public/images/SashaHero.jpg` in light mode and `public/images/SashaHeroDark.jpg` in dark mode.