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

That imports **read books with a rating of 1–5** plus anything on the **currently-reading** shelf (Goodreads allows more than one). TBR/`to-read` rows stay off the site. Existing Instagram picks keep their notes and covers; ISBN, dates, and shelf status are merged in.

On Windows, extra flags after `npm run` can get eaten by npm. Prefer:

```bash
npm run import:goodreads
node scripts/import-goodreads.mjs --check
node scripts/import-goodreads.mjs --skip-covers
node scripts/import-goodreads.mjs --min-rating=4
node scripts/import-goodreads.mjs "C:\path\to\export.csv"
```

Then refresh the Books page. Shelf, rating, genre, and sort are independent (like Goodreads). Covers are downloaded into `src/assets/covers/` so Astro can optimize them. Review HTML such as `<br/>` is turned into real line breaks.

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

- `bookshop` is the primary button on books (Bookshop.org).
- `amazon` is the secondary button on books, and the primary button on art supplies.
- Optional `shop` on supplies is for a specialist store.
- All of these are marked as sponsored links in the HTML.
- Leave them as `"#"` until the affiliate accounts are ready, then paste the real URLs.

The footer already includes an affiliate disclosure.

### Currently reading

This comes from Goodreads `currently-reading` on import — more than one book at a time is expected. Re-run `npm run import:goodreads` after a new export to refresh the home shelf. TBR stays off the public site.

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