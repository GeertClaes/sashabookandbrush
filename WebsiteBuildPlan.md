# Website Build Plan – sashabookandbrush

**Status (Sep 2026):** Core site is built in the repo. Production host is **Cloudflare Pages**. Remaining work is go-live, Access, the rebuild Worker, and affiliate accounts — see [Plan.md §10](Plan.md).

## Project Overview
Clean, fast, mobile-first personal site for Bookstagrammer @sashabookandbrush.

Primary goals:
- Professional home for her book recommendations
- Easy affiliate monetization
- Simple media kit / “Work with me” presence
- Future-proof for digital products and email list

**Operating principle:** Goodreads is the diary. The site is the shop window. She rates, logs progress, and reviews on Goodreads. The site does not write back. Affiliates are Amazon OneLink + Bookshop.org UK. The full TBR stays off the public Books page.

Aesthetic direction:
- Cozy, warm, bookish (cream, burgundy, forest)
- Clean typography, generous whitespace
- Book covers as the visual focus

## Tech stack (as built)

- **Astro 5 + Tailwind 4**, static
- Content: markdown in `src/content/` (`books`, `art`, `supplies`) plus `src/data/site.json`
- Covers in `src/assets/covers/` (Astro image pipeline)
- **Production:** Cloudflare Pages (`npm run build` → `dist`)
- **RSS sync:** `scripts/sync-goodreads.mjs` runs at build time → `src/data/goodreads-live.json`
- **CSV import:** merge-safe `scripts/import-goodreads.mjs` (keeps notes, covers, featured, affiliate overrides)
- **Admin:** `/admin` (not in nav). Local: `npm run admin`. Production: Pages Functions commit via GitHub; Cloudflare Access + Google
- **Scheduled rebuild:** Worker at `workers/rebuild-pages/` POSTs a Pages deploy hook (6 hours). Not GitHub Actions
- **Optional:** Docker Compose on the home server (port 8080)

## Site structure

| Page | Status |
| --- | --- |
| Home — hero, currently reading + progress, Up next TBR teaser, featured | **Built** |
| Books `/recommendations` — year filter, series rows, five-star wall, search | **Built** |
| Book detail `/books/<slug>` — note, rating, affiliates | **Built** |
| Art | **Built** (content still thin) |
| About — bio, Dobby, year chips, Goodreads | **Built** |
| Work with me | **Built** (Formspree id still empty) |
| Shop | **Placeholder** |
| `/admin` | **Built**; live Google login not configured yet |
| 404 | **Built** |

Optional later: blog, newsletter.

## Key features

| Feature | Status |
| --- | --- |
| Book cards, covers, notes, ratings | Done |
| Affiliate buttons from ISBN + `site.json` IDs | Done; **IDs empty** until accounts exist |
| Dark / light mode | Done |
| SEO basics, canonical, OG | Done |
| Umami analytics | Done |
| Contact form (Formspree) | Wired; **id not set** |
| Merge-safe Goodreads CSV | Done |
| Live RSS (currently reading, %, short TBR) | Done at build; **Worker cron not deployed** |
| Cloudflare Access `/admin` | Code in repo; **dashboard setup remaining** |

## Content

- Library imported from Goodreads (user `141471789`, ~rated/read + currently reading)
- Featured set and public notes still need Sasha’s eye (4–9 on home)
- Hero / About photos: `public/images/SashaHero.jpg` and `SashaHeroDark.jpg`

## Design notes
- Headings: Fraunces. Body: DM Sans
- Soft shadows, rounded cards, covers first
- Brand in header/footer: `SashaBook&Brush`

## Deployment

- Domain: `sashabookandbrush.com`
- Host: Cloudflare Pages, not the home server as primary
- HTTPS via Cloudflare
- Rebuilds: git push, admin saves, CSV import Action, and the 6-hour Worker cron
- Docker Compose remains documented for a home fallback

## Deliverables

1. Working static site — **done in repo**
2. Easy updates — markdown + `/admin` + README — **done in repo**
3. README for books, import, admin, Access, Worker — **done**
4. Live domain, Access, Worker, affiliate IDs — **parent to-do** ([Plan.md §10](Plan.md))

## Priority (original → now)

1. Home + Recommendations — **done**
2. About + Work with me — **done**
3. Affiliate integration — **code done; accounts remaining**
4. Polish, admin, Goodreads sync — **code done; Cloudflare/GitHub config remaining**
5. Shop / digital products — later
