# Image Identifier — ranking plan (Oct 18 → Nov 18, 2026)

**Goal:** Rank for “image checker / AI image detector / is this image AI” intent on Google.  
**Live URL:** https://image-identifier.pages.dev  
**GEO baseline (2026-10-18):** **52/100** (foundation). Report: https://geoready.dev/report/audit?url=https://image-identifier.pages.dev

Honest bar: brand-new domain on `pages.dev` will not hit #1 for head terms in 30 days against established detectors. Plan maximizes **indexation, topical coverage, and AI/Google readiness** so rankings can compound.

---

## Week 0 (days 1–2) — foundation unblockers

| # | Task | Why (Google) | Owner tool |
| --- | --- | --- | --- |
| 1 | Align **canonical + sitemap host** with live URL (`pages.dev` **or** finish custom domain + update `site`) | G-CANONICAL fail: pages.dev pages point at `image.tommyfx.pk` | Code + DNS |
| 2 | Google Search Console: add property, verify, submit sitemap | Indexing + query data | GSC + mcp-gsc |
| 3 | Drop `client_secrets.json` into `~/.config/gsc/`, restart Cursor | Unlock GSC MCP | [mcp-gsc](https://github.com/AminForou/mcp-gsc) |
| 4 | Add WebSite + Organization + FAQPage JSON-LD (FAQ already has FAQ schema) | Rich results / entity | GEO fix list |
| 5 | Add `llms.txt`, `/ai/summary.json`, author/date on blog posts | AI Overviews + citability | [geo-optimizer](https://github.com/Auriti-Labs/geo-optimizer-skill) |
| 6 | Decide OpenSEO: hosted openseo.so **or** self-host + DataForSEO key | Keyword volumes / competitors | [open-seo](https://github.com/every-app/open-seo) |

---

## Primary keyword clusters (publish against these)

Use OpenSEO keyword-research skill once DataForSEO is live; until then ship these intent clusters:

1. **Core tool:** ai image detector, check if image is ai generated, is this photo ai, ai or real image checker, free ai image checker  
2. **How-to:** how to tell if an image is ai, spot ai generated photos  
3. **Trust/legal:** are ai detectors accurate, ai image detector not legal proof  
4. **Privacy angle:** ai image checker no upload, browser ai image detector  

Map 1 post → 1 primary phrase → link to `/` CTA. Avoid cannibalizing with near-duplicate titles (use gsc-cannibalization-check after data exists).

---

## Week 1 (days 3–9) — content + on-page

| Day | Ship |
| --- | --- |
| 3–4 | MD/content-collection blog workflow — **done** (`src/content/blog/`) |
| 5 | Post: “Free AI image checker (no upload)” → `/` — **done** (`/blog/free-ai-image-checker-no-upload/`) |
| 6 | Post: “How accurate are AI image detectors?” → FAQ/terms — **done** (`/blog/how-accurate-are-ai-image-detectors/`) |
| Day-3 post | Screenshots / social copies — **done** (`/blog/check-screenshot-or-social-photo-for-ai/`) |
| 7 | Strengthen homepage copy to 300+ useful words below fold (GEO flag) without leaking methods |
| 8 | Internal link audit: every blog post ↔ FAQ ↔ Privacy ↔ tool |
| 9 | GEO re-audit; target score **≥ 68** |

Cadence: **2–3 quality posts/week**, not thin daily spam.

---

## Week 2 (days 10–16) — competitive + topical depth

| Day | Ship |
| --- | --- |
| 10 | Competitor SERP notes (openseo-competitor-analysis): top 10 for “ai image detector” — what they cover that we don’t |
| 11–12 | Posts filling gaps (e.g. deepfakes vs AI art, screenshots hard to classify, social media reposts) |
| 13 | FAQ expansion + keep FAQPage JSON-LD in sync |
| 14 | Author byline + `dateModified` on all articles (G-BYLINE / G-DATES) |
| 15–16 | GSC: indexing-audit skill; fix excluded/soft-404/redirect issues |

---

## Week 3 (days 17–23) — authority & discovery

| Day | Ship |
| --- | --- |
| 17 | Organization `sameAs` (social / site profiles you actually own) |
| 18–19 | 2 comparison/explainer posts linking out to authoritative sources (credibility for AI citation) |
| 20 | Soft outreach / listings: directories that accept free tools (only real, non-spam) |
| 21 | RSS/Atom feed for blog |
| 22–23 | gsc-content-opportunities + seo-weekly-report; double down on queries with impressions but low CTR |

---

## Week 4 (days 24–30) — measure & lock process

| Day | Ship |
| --- | --- |
| 24 | Full GEO audit + OpenSEO AI visibility checklist |
| 25 | CTR title/meta pass on top landing pages |
| 26–27 | Publish 2 posts from best unfinished cluster |
| 28 | Cannibalization check; merge/redirect overlaps |
| 29 | Document recurring weekly ritual (below) |
| 30 | Scorecard: indexed pages, GSC impressions/clicks, GEO score, top 10 query list |

### Weekly ritual (ongoing)

1. GEO audit on homepage + one money blog URL  
2. GSC weekly report skill  
3. 2 posts from keyword cluster  
4. Fix any new indexing issues  

---

## Success metrics (30 days)

| Metric | Target |
| --- | --- |
| GEO score (home) | ≥ 68 (good) |
| GSC | Property verified; sitemap success; first impressions on cluster queries |
| Content | ≥ 8 new indexable posts (beyond the original 4) |
| Technical | Canonical/sitemap host consistent; schema present |
| Rankings | Track positions for 10 seed terms (OpenSEO rank track or manual) — expect long-tail movement first |

---

## What each installed tool is for

| Tool | Use this month |
| --- | --- |
| **mcp-gsc** | Real Google performance after verify — not guesswork |
| **geo-optimizer** | AI Overviews / ChatGPT/Perplexity readiness; schema/llms.txt |
| **OpenSEO** | Keyword volume, competitors, rank tracking (needs API + host) |

**Not needed for posting:** Supabase. Keep static posts + Pages deploy.
