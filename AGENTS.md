# AGENTS.md — Image Identifier

## Mission

Build a free, local-first image forensics / provenance tool. Attractive modern UI. Evidence over fake certainty.

## Mandatory reads

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DESIGN.md`
- `docs/SECURITY.md`
- `docs/SEO.md`
- `docs/QA.md`
- Active epic under `docs/epics/`
- SOP: `docs/website-image-checker.txt`

## Hard DO NOT

- TypeScript (JS / JSX / Astro only)
- Next.js (use Astro static)
- Upload images to any backend or third-party detector API
- Paid AI APIs for core analysis
- Auth / DB / cloud gallery
- Claim authenticity guarantees or ship ML without model gate
- Use CC-BY-NC models if commercial/AdSense path is required (document and skip)
- Commit/push unless operator asks
- Implement more than the assigned ticket

## Hard DO

- Follow `docs/DESIGN.md` for first viewport and tokens
- Keep C2PA / metadata / ML statuses distinct
- Preserve conflicting evidence
- Run `npm run build` before done; add tests when epic requires
- Verify Network: no image bytes uploaded
