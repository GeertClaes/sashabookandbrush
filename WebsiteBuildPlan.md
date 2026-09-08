# Website Build Plan – sashabookandbrush

**Status (Sep 2026):** The site is built and live at **[sashabookandbrush.com](https://sashabookandbrush.com)** on Cloudflare Pages. Remaining work is Access for `/admin`, the RSS rebuild Worker, and affiliate accounts — see [Plan.md §10](Plan.md).

## Project Overview
Clean, fast, mobile-first personal site for Bookstagrammer @sashabookandbrush.

Primary goals:
- Professional home for her book recommendations
- Easy affiliate monetization
- Simple “Work with me” presence (Instagram)
- Future-proof for digital products and email list

**Operating principle:** Goodreads is the diary. The site is the shop window. She rates, logs progress, and reviews on Goodreads. The site does not write back. Affiliates are Amazon OneLink + Bookshop.org UK. The full TBR stays off the public Books page.

Aesthetic direction:
- Cozy, warm, bookish (cream, burgundy, forest in the UI)
- Clean typography, generous whitespace
- Book covers as the visual focus
- Mark: cream tile, navy book, gold italic S, diagonal brush

## Tech stack (as built)

- **Astro 5 + Tailwind 4**, static
- Content: markdown in `src/content/` (`books`, `art`, `supplies`) plus `src/data/site.json`
- Covers in `src/assets/covers/` (Astro image pipeline)
- **Production:** Cloudflare Pages (`npm run build` → `dist`) at `sashabookandbrush.com`
- **RSS sync:** `scripts/sync-goodreads.mjs` runs at build time → `src/data/goodreads-live.json`
- **CSV import:** merge-safe `scripts/import-goodreads.mjs` (keeps notes, covers, featured, affiliate overrides)
- **Admin:** `/admin` (not in nav). Tabs: Books, Art, Tools. Art and tools can be deleted. Local: `npm run admin`. Production: Pages Functions commit via GitHub; Cloudflare Access + Google (dashboard setup remaining)
- **Scheduled rebuild:** Worker at `workers/rebuild-pages/` POSTs a Pages deploy hook (6 hours). Not GitHub Actions. **Not deployed yet**
- **Brand assets:** `public/favicon.svg` / `icon.svg` / `images/og.svg`; run `node scripts/render-brand-assets.mjs` to refresh PNGs
- **Optional:** Docker Compose on the home server (port 8080)

## Site structure

| Page | Status |
| --- | --- |
| Home — hero, currently reading + progress, Up next TBR teaser, featured books/art | **Built** |
| Books `/recommendations` — five-star wall, library (year/genre/search), series stacks | **Built** |
| Book detail `/books/<slug>` — note, rating, dates, page length, rereads, ISBN, affiliates | **Built** |
| Art — paintings + recommended tools | **Built** (content still thin) |
| About — bio, Dobby, year chips, Goodreads | **Built** |
| Work with me | **Built** (Instagram DM only; no form or packages on the page) |
| Shop | **Placeholder** (Formspree waitlist if `PUBLIC_FORMSPREE_ID` is set; otherwise Instagram) |
| `/admin` | **Built**; live Google login not configured yet |
| 404 | **Built** |

Optional later: blog, newsletter.

## Key features

| Feature | Status |
| --- | --- |
| Book cards, covers, notes, ratings | Done |
| Affiliate buttons from ISBN + `site.json` IDs | Done; **IDs empty** until accounts exist |
| Dark / light mode | Done |
| SEO, canonical, OG, favicon, apple-touch, web manifest | Done |
| Umami analytics | Done |
| Shop waitlist (Formspree) | Wired; **id not set** |
| Work-with-me contact | Instagram only |
| Merge-safe Goodreads CSV | Done |
| Live RSS (currently reading, %, short TBR) | Done at build; **Worker cron not deployed** |
| Admin: notes, covers, featured, art, tools, CSV; delete art/tools | Done in repo |
| Cloudflare Access `/admin` | Code in repo; **dashboard setup remaining** |

## Content

- Library imported from Goodreads (user `141471789`, rated/read + currently reading)
- Featured set and public notes still need Sasha’s eye (4–9 on home)
- A few art pieces and supply items exist; both still need her eye
- Hero / About photos: `public/images/SashaHero.jpg` and `SashaHeroDark.jpg`

## Design notes
- Headings: Fraunces. Body: DM Sans
- UI: cream `#F5EFE4`, burgundy `#8C3340`, forest `#3D5246`, rust `#A65C2E`
- Soft shadows, rounded cards, covers first
- Brand in header/footer: `SashaBook&Brush`
- Favicon / OG / placeholders: navy book (`#253D5B`), gold Georgia italic S, brush with a red paint tip

## Deployment

- Domain: `sashabookandbrush.com` (live)
- Host: Cloudflare Pages, not the home server as primary
- HTTPS via Cloudflare
- Rebuilds: git push, admin saves, CSV import Action, and (once deployed) the 6-hour Worker cron
- Docker Compose remains documented for a home fallback

## Deliverables

1. Working static site — **live**
2. Easy updates — markdown + `/admin` + README — **done in repo**
3. README for books, import, admin, Access, Worker, brand assets — **done**
4. Access, Worker, affiliate IDs, media kit, Instagram bio — **parent to-do** ([Plan.md §10](Plan.md))

## Priority (original → now)

1. Home + Recommendations — **done**
2. About + Work with me — **done** (Work is Instagram, not a form)
3. Affiliate integration — **code done; accounts remaining**
4. Polish, admin, Goodreads sync — **code done; Cloudflare/GitHub config remaining**
5. Shop / digital products — later
