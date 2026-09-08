# Project Plan: sashabookandbrush

**Owner:** Parent (tech, setup, maintenance)  
**Creator:** Sasha (@sashabookandbrush)  
**Status:** Site live at sashabookandbrush.com; Access, rebuild Worker, and affiliate accounts still open  
**Timeline:** 3–6 months  
**Related:** [Website Build Plan](WebsiteBuildPlan.md) — stack, pages, and what is already in the repo

---

## 1. Purpose

Help Sasha generate consistent monthly side-hustle revenue and grow her audience, while keeping everything low-pressure and authentic to her style.

This is support work, not a takeover. Sasha remains the voice of the brand. Parent handles technical setup, maintenance, and optional gifted costs.

---

## 2. Success Criteria

| Horizon | Target |
| --- | --- |
| **3–6 months** | **$150–500+/month** combined from affiliates, small paid/gifted deals, and first digital products |
| **Audience** | Steady, organic growth — no pressure to post more than feels natural |
| **Tone** | Everything stays authentic to her existing Bookstagram style |

### Revenue mix (first win → later)

| Stream | Near-term goal | Notes |
| --- | --- | --- |
| Affiliate (Bookshop.org + Amazon) | **$50–150/month** once links are consistent | Easiest first win |
| Paid / gifted collabs | **1–3 deals per month** | Media kit + clear packages |
| Digital products | First listings live | Higher margin; website shop later |
| Author services | Optional, after she is comfortable | Graphics, ARC coordination, promo |

---

## 3. Roles

| Role | Does | Does not |
| --- | --- | --- |
| **Parent** | Website, hosting, domain, affiliate account setup, media kit draft, content updates she sends, tech support | Post, DM brands, or speak for her unless she asks |
| **Sasha** | Content, brand voice, collab decisions, what she wants featured | Technical maintenance |

**Ongoing parent commitments**

- Handle all technical maintenance of the website
- Update the site when she sends new favourite books or products
- Celebrate small wins without pressure
- Cover small costs (domain, Canva Pro, etc.) as a gift if helpful
- Stay available as tech support only

---

## 4. Phases & Workstreams

### Phase A — Immediate setup

*Parent does most of this work.* Goal: she has a professional home base and working affiliate links.

| # | Task | Owner | Status |
| --- | --- | --- | --- |
| A1 | Build a clean personal website | Parent | **Done in repo** (Astro). Live host is **Cloudflare Pages**, not the home server. Docker remains as an optional fallback. |
| A2 | Domain `sashabookandbrush.com` | Parent | **Done.** Cloudflare registrar + Pages custom domain. |
| A3 | Bookshop.org UK + Amazon Associates | Parent | **Done in `site.json`:** Amazon `sashabookandb-21`, Bookshop UK `18142`. Confirm buttons on a live book page after deploy. |
| A4 | One-page media kit (PDF) | Parent | **Not started.** `/work` exists and points to Instagram (no on-page packages). |
| A5 | Website + affiliate links in Instagram bio | Parent + Sasha | **Not started** |

**Media kit should highlight**

- Follower count and engagement
- PR Official Influencer with Rattle the Stars
- Genres she covers
- Current collaboration preferences

Website scope, stack, and pages: see [Website Build Plan](WebsiteBuildPlan.md).

---

### Phase B — Revenue streams

Activate in this order. Do not wait for later streams before shipping A.

#### B1. Affiliate income *(first win)*

- Put Bookshop.org + Amazon links on every recommendation post and on the website
- Bookshop.org as primary; Amazon as secondary
- **Goal:** $50–150/month once consistent

#### B2. Paid / gifted collaborations

- Use the media kit to apply to more PR companies and small publishers
- Help her create 2–3 clear packages, for example:
  - Stories only
  - Reel + Stories
  - Full review package
- **Target:** 1–3 small paid or high-value gifted deals per month

#### B3. Digital products *(higher margin)*

Simple printables such as:

- Reading trackers
- Monthly TBR templates
- Book club discussion guides
- Annotation pages

Sell via Gumroad or Etsy and feature them on the website.

#### B4. Services for authors *(later)*

Once she is comfortable: aesthetic graphics, ARC coordination, or basic promo packages for indie authors.

---

### Phase C — Audience growth

Support, do not force a posting cadence.

| Action | How |
| --- | --- |
| Cross-post best reviews to X | Parent can help set up and schedule lightly |
| Encourage consistent Reels | Recs, “currently reading”, honest reactions — these grow faster than static posts |
| Track what works | Saves, shares, comments — double down on winners |
| Optional later | Light email list via the website (ConvertKit free tier or similar) |

---

## 5. Suggested timeline

Dates are flexible. The point is sequence, not a hard calendar.

| Window | Focus | Exit criteria |
| --- | --- | --- |
| **Weeks 1–2** | Domain, hosting, affiliate accounts, media kit draft | Domain live or parked; accounts created; kit v1 |
| **Weeks 2–4** | Website: Home + Recommendations + affiliate buttons | Site public; bio links updated |
| **Month 2** | About + Work With Me; first collab packages | Media kit on site; 2–3 packages defined |
| **Months 2–3** | Consistent affiliate links on posts; apply to PR | First affiliate clicks/sales; collab pipeline started |
| **Months 3–6** | 1–2 digital products; optional email list | First product listed; revenue tracking in place |

---

## 6. Risks & constraints

| Risk / constraint | Mitigation |
| --- | --- |
| Pressure kills the fun | Parent never posts or DMs brands unless asked; celebrate small wins |
| Affiliate disclosure / FTC | Disclose affiliate links on site and in posts from day one |
| Home-server downtime | Production is Cloudflare Pages. Docker on the home server is optional. |
| Content waiting on Sasha | Library is imported from Goodreads. She adds notes/featured/covers on `/admin` (or you do). |
| Scope creep (blog, shop, email) | Core pages are live in the repo. Shop is a placeholder. |

---

## 7. Budget (parent, optional gifts)

| Item | Notes |
| --- | --- |
| Domain | `sashabookandbrush.com` — ~$10–20/year |
| Hosting | **Cloudflare Pages** (free tier). Home Docker is optional. |
| Canva Pro | Optional, if useful for media kit / graphics |
| Gumroad / Etsy / ConvertKit | Free tiers first |

---

## 8. Open decisions

- [x] Final domain name — `sashabookandbrush.com`
- [x] Hero / About photos — nook photos (`SashaHero.jpg` / `SashaHeroDark.jpg`)
- [x] Dobby — mentioned in the About copy
- [ ] Bio link: direct site vs Linktree
- [ ] Gumroad vs Etsy for first digital products
- [ ] Exact collab package names and rates (Sasha decides)
- [x] Affiliate IDs in `site.json` (Amazon `sashabookandb-21`, Bookshop UK `18142`)

---

## 9. Definition of done (this project)

The setup phase is done when all of the following are true:

1. Website is live on a real domain, HTTPS, mobile-friendly
2. Affiliate accounts exist and links appear on the site and in her bio
3. One-page media kit PDF is ready to send
4. Parent has a documented way to add books and update links (`/admin` + README)
5. Sasha can ignore the tech and just create (rate on Goodreads; optional `/admin` for notes)

Revenue targets in section 2 are **outcomes**, not a requirement to call the build done.

---

## 10. Remaining to-do (parent)

Code is on GitHub and **[sashabookandbrush.com](https://sashabookandbrush.com)** is live. Remaining: rebuild Worker, `/admin` Access, affiliate accounts.

How the site is meant to work: **Goodreads is the diary. The site is the shop window.** She rates and logs progress on Goodreads. The site does not write back. Full TBR stays off the public Books page.

### A. Get the code onto GitHub

- [x] Review local changes (library import, RSS sync, `/admin`, Pages Functions, rebuild Worker)
- [x] Commit and push to `main`
- [x] Cloudflare Pages builds from this repo (`npm run build`, output `dist`); site is live at the domain

### B. Domain and Pages

- [x] Point `sashabookandbrush.com` DNS at the Pages project
- [x] Confirm HTTPS and a successful production deploy
- [ ] **Pages → Settings → Builds → Deploy hooks** → hook for `main`. Copy the URL; do not put it in the repo

### C. 6-hour Goodreads RSS sync (Cloudflare, not GitHub)

Each Pages build already runs `sync-goodreads.mjs`. A Worker cron just triggers the rebuild.

- [ ] `npx wrangler deploy --config workers/rebuild-pages/wrangler.toml`
- [ ] `npx wrangler secret put CLOUDFLARE_PAGES_DEPLOY_HOOK --config workers/rebuild-pages/wrangler.toml`
- [ ] Trigger the hook once by hand (or wait for the first cron) and check home: currently reading, progress, “Up next”
- [ ] Optional: switch cron to daily (`0 6 * * *` in `wrangler.toml`) if 6-hourly is more rebuilds than you want  
- [ ] Do **not** add a GitHub Actions schedule against the same hook

### D. Live `/admin` behind Google (Cloudflare Access)

Bookmark for Sasha later: `https://sashabookandbrush.com/admin` (not in the public nav).

- [ ] [Zero Trust](https://one.dash.cloudflare.com) → Access → Applications → Self-hosted
- [ ] Domain `sashabookandbrush.com`, path `/admin*`
- [ ] Same policy on the `*.pages.dev` hostname, **or** disable preview deployments
- [ ] Identity: **Google**. Allow Sasha’s Gmail and yours
- [ ] Copy **AUD** and team domain (`your-team.cloudflareaccess.com`)
- [ ] GitHub fine-grained PAT: **Contents: Read and write** on `GeertClaes/sashabookandbrush`
- [ ] Repo **Settings → Actions → General → Workflow permissions → Read and write** (CSV import commits back)
- [ ] Pages **production** environment variables:

| Variable | Value |
| --- | --- |
| `ADMIN_GITHUB_TOKEN` | that PAT |
| `GITHUB_REPO` | `GeertClaes/sashabookandbrush` |
| `GITHUB_BRANCH` | `main` |
| `CF_ACCESS_TEAM_DOMAIN` | team domain |
| `CF_ACCESS_AUD` | Access AUD |
| `ADMIN_EMAILS` | comma-separated Google emails |

- [ ] Redeploy Pages after env vars
- [ ] Sign in at `/admin` with Google; save a test note; confirm a GitHub commit and a Pages rebuild
- [ ] Optional: Formspree id as `PUBLIC_FORMSPREE_ID` on Pages (Shop waitlist only; `/work` is Instagram)

### E. Affiliates and go-live (still needed for revenue)

- [x] Bookshop.org UK affiliate ID → `affiliates.bookshopUkId` (`18142`)
- [x] Amazon.co.uk tracking ID (ends in `-21`) → `affiliates.amazonTag` (`sashabookandb-21`)
- [ ] Commit those IDs; confirm buy buttons on a book page and a featured home card
- [ ] Media kit PDF (A4)
- [ ] Instagram bio: site URL (and shop/affiliate once IDs exist)
- [ ] Show Sasha `/admin`: notes, featured, covers, art, tools, CSV drop. Ratings stay on Goodreads
- [ ] Pick a few home **featured** books with her (aim 4–9)

Local editor without Access: `npm run admin`, then `/admin` on the dev server.
