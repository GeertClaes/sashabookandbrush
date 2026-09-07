# Website Build Plan – sashabookandbrush

## Project Overview
Build a clean, fast, mobile-first personal website for Bookstagrammer @sashabookandbrush.
Self-hosted on existing home server.
Primary goals:
- Professional home for her book recommendations
- Easy affiliate monetization
- Simple media kit / “Work with me” presence
- Future-proof for digital products and email list

Aesthetic direction:
- Cozy, warm, bookish, slightly autumnal / dark academia lean
- Soft neutrals, cream, warm browns, deep greens or muted burgundy accents
- Clean typography, generous whitespace, high-quality book photography feel
- Minimal and elegant (not cluttered)

## Tech Stack Recommendation
Preferred (in order):
1. **Static site** (recommended for simplicity & speed)
   - Astro or 11ty + Tailwind CSS
   - Or plain HTML + Tailwind if keeping it extremely simple
2. Alternative: WordPress in Docker (if she later wants easier self-editing)

Requirements:
- Fully responsive
- Fast loading
- HTTPS
- Easy for parent to update content
- Docker-friendly if possible

## Site Structure (Pages)

### 1. Home
- Hero section with her name/handle + short tagline (e.g. “Honest book recommendations & cozy reading moments”)
- Featured / Currently Reading section
- Recent Favourites (grid of 6–9 books with short notes + affiliate links)
- Soft call-to-action to “Browse all recommendations” or “Work with me”

### 2. Recommendations / Books
- Filterable or categorized list (Horror, Romance, Fantasy, Book Club Reads, etc.)
- Each book entry: cover image, title, author, short personal note, star rating (optional), affiliate buttons (Bookshop.org primary + Amazon)

### 3. About
- Short personal bio
- Photo of her (or aesthetic book flat-lay if she prefers privacy)
- Mention of cat Dobby if she wants
- Reading challenge progress (optional)
- Link to Instagram

### 4. Work With Me / Media Kit
- Clear statement of what she offers (ARC reviews, paid collaborations, gifted, etc.)
- Stats (followers, engagement if available)
- Note that she is a PR Official Influencer with Rattle the Stars
- Simple rate card or “Contact me for packages”
- Contact form or email link

### 5. Shop / Digital Products (future-ready)
- Placeholder section for reading trackers, templates, etc.
- Can start empty or with 1–2 products

### Optional later pages
- Blog / Longer reviews
- Newsletter signup

## Key Features to Include
- Affiliate link support (easy to update)
- Clean book card component (cover + title + note + buttons)
- Mobile-first navigation
- Simple contact form (Formspree or similar free option)
- SEO basics (title, meta description, Open Graph)
- Fast image optimization
- Dark/light mode optional (nice-to-have)

## Content Placeholders Needed
- Short bio text
- 8–12 current favourite books with short notes
- Currently reading book
- Profile/hero image
- Any existing media kit text

## Design Notes
- Use a warm, readable serif for headings (e.g. Fraunces, Playfair Display, or similar)
- Clean sans-serif for body
- Soft shadows, rounded corners on cards
- Plenty of breathing room
- Book covers should be the visual focus

## Deployment
- Self-hosted on existing home server
- Prefer Docker Compose setup for easy management
- Domain: [to be confirmed – e.g. sashabookandbrush.com]
- Automatic HTTPS (Let’s Encrypt / Caddy / Traefik)

## Deliverables
1. Fully working static site
2. Easy content update method (markdown files)
3. Clear README with how to add new books and update affiliate links
4. Mobile + desktop screenshots of key pages

## Priority Order
1. Home + Recommendations pages (core value)
2. About + Work With Me
3. Affiliate integration
4. Polish, performance, and future Shop section