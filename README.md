# sashabookandbrush

Personal site for [@sashabookandbrush](https://instagram.com/sashabookandbrush): books, art, affiliate links, and a simple work-with-me page.

See [Plan.md](Plan.md) and [WebsiteBuildPlan.md](WebsiteBuildPlan.md) for the full project plan.

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
bookshop: "https://bookshop.org/a/YOUR-ID/9781649374042"
amazon: "https://www.amazon.com/dp/1649374046?tag=YOUR-TAG"
featured: true
order: 1
isbn: "9781649374042"
dateRead: "2024-06-12"
---
```

3. Put the cover image in `src/assets/covers/` and set `cover` to the filename. Astro will optimize it.
4. Set `featured: true` to show it on the home page (aim for 4–9).
5. `status` is `read` or `currently-reading`. Use `order` only as a fallback; the Books page sorts by date, rating, title, and so on.
6. Rebuild or refresh the dev server.

Each book also gets a page at `/books/<filename>` (for example `/books/fourth-wing`) with the full note, ISBN, dates, and other Goodreads fields. Cards on Home and Books link there.

Genres on the Recommendations page are generated from whatever is in these files.

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

Rate books on Goodreads. The site editor is for a public note, a featured home card, a cover, or a CSV drop. It is not in the public nav — bookmark [sashabookandbrush.com/admin](https://sashabookandbrush.com/admin).

On the live site, Cloudflare Access asks for **Google sign-in** before `/admin` opens. Saves commit to GitHub; Pages rebuilds (usually about a minute). A CSV upload writes `data/export.csv`, then [`.github/workflows/import-csv.yml`](.github/workflows/import-csv.yml) runs `import-goodreads.mjs --skip-covers` and commits library files.

**One-time setup (Cloudflare Access + GitHub):**

1. [Zero Trust](https://one.dash.cloudflare.com) → **Access** → **Applications** → Add **Self-hosted**.
2. Domain `sashabookandbrush.com`, path `/admin*`. Repeat for the `*.pages.dev` hostname, or disable preview deployments so `/admin` is not public there.
3. Identity provider: **Google**. Policy: allow Sasha’s Gmail and yours.
4. Copy the application **AUD** tag and team domain (`your-team.cloudflareaccess.com`).
5. Create a GitHub fine-grained token with **Contents: Read and write** on this repo. Repo **Settings → Actions → General → Workflow permissions** must allow Actions to write (for the CSV import workflow).
6. In the Pages project → **Settings → Environment variables** (Production):

| Variable | Value |
| --- | --- |
| `ADMIN_GITHUB_TOKEN` | that GitHub token |
| `GITHUB_REPO` | `GeertClaes/sashabookandbrush` |
| `GITHUB_BRANCH` | `main` |
| `CF_ACCESS_TEAM_DOMAIN` | `your-team.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Access application AUD |
| `ADMIN_EMAILS` | comma-separated Google emails |

API writes fail closed until Access and the GitHub token are set. Do not put `/admin` in the public nav.

Locally:

```bash
npm run admin
```

Then open `/admin` on the dev server. Optional `ADMIN_PASSWORD` in `.env` (`PUBLIC_ADMIN_URL` only if the API is not on `http://127.0.0.1:8787`).

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

3. Put the photo in `public/images/art/` and point `image` at that path. Leave `image` out until you have one — the card will show the title on a blank panel.
4. Set `featured: true` to show it on the home page.

### Add or edit art supplies

1. Create a file in `src/content/supplies/` (one markdown file per item).
2. Fill in the frontmatter:

```yaml
---
title: "Liquitex Basics acrylics"
brand: "Liquitex"
category: "Paint"
note: "Why this one earns a spot on the desk."
amazon: "https://www.amazon.com/dp/EXAMPLE?tag=YOUR-TAG"
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
- `affiliates.amazonTag` — Amazon Associates tag (OneLink is configured on Amazon’s side)

Leave those blank until the accounts exist; buttons hide when there is no ISBN and no override. Per-book `bookshop` / `amazon` URLs still win if they are real `https://` links (special editions). Buttons show on book pages and featured home cards, not on the full list.

The footer already includes an affiliate disclosure.

### Currently reading

The home shelf and progress % come from public Goodreads RSS (`npm run sync:goodreads`). That also writes a short “Up next” TBR teaser. The full library (ratings, reviews, covers) still needs a CSV import.

`npm run build` runs the RSS sync first, then Astro. If Goodreads is down, the last `src/data/goodreads-live.json` is kept so the deploy still works. On production, a Cloudflare Worker cron triggers that rebuild.

### Cloudflare Pages

The production site is static. RSS cannot update the live HTML unless Pages rebuilds. Use a **Cloudflare Worker cron**, not GitHub Actions — Pages has no built-in schedule, and Worker cron is more reliable than Actions `on.schedule`.

1. Pages build command: `npm run build` (already includes the Goodreads RSS sync).
2. **Pages → Settings → Builds → Deploy hooks** → add a hook for `main`. Copy the URL. Do not put it in the repo.
3. Deploy [`workers/rebuild-pages/`](workers/rebuild-pages/) once (separate from the Pages site):

```bash
npx wrangler deploy --config workers/rebuild-pages/wrangler.toml
npx wrangler secret put CLOUDFLARE_PAGES_DEPLOY_HOOK --config workers/rebuild-pages/wrangler.toml
```

That Worker runs every 6 hours UTC (`0 */6 * * *`). Each run POSTs the hook; Pages rebuilds and refreshes currently reading / progress / up next. Free Pages is 500 builds/month; 6-hour cron is about 120. For daily instead, change the cron in `wrangler.toml` to `0 6 * * *` and redeploy.

Do not also schedule a GitHub Action against the same hook.

CSV can also be uploaded on `/admin`. That commits `data/export.csv`; GitHub Actions imports it with `--skip-covers` and Pages rebuilds again. New covers can be added in the editor afterwards, or run `node scripts/import-goodreads.mjs --missing-covers` locally.

### Site copy, stats, and packages

Edit `src/data/site.json` for:

- Hero text, About bio, Art page copy
- Work-with-me stats, offers, and packages
- Instagram URL
- Shop placeholder copy

### Contact form

1. Create a form at [Formspree](https://formspree.io).
2. Copy `.env.example` to `.env`.
3. Set `PUBLIC_FORMSPREE_ID` to the form id (the part after `/f/`).

Until that is set, the Work page points people to Instagram instead of a dead form.

## Docker (home server)

```bash
docker compose up --build -d
```

The site is served on port **8080**. Point your domain (and Caddy/Traefik HTTPS) at that port when the domain is ready.

## Design

Warm, bookish palette: cream background, burgundy primary, forest green secondary, rust accent. Headings use Fraunces; body uses DM Sans.

The home hero and About photo use `public/images/SashaHero.jpg` in light mode and `public/images/SashaHeroDark.jpg` in dark mode.