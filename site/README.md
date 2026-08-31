# Nfusia official site (nfusia.com) — FeedMyBaby lives under /feedmybaby

Static site for Cloudflare Pages. No build step required.

**Layout:**
- `site/index.html` — apex landing for `nfusia.com` (studio home, links to the app)
- `site/feedmybaby/` — the FeedMyBaby product site (landing, privacy, support) at `nfusia.com/feedmybaby`
- `site/_headers` — security headers (applied site-wide by Pages)

## Deploy to Cloudflare Pages

1. Push this repo to GitHub (or use Direct Upload / Wrangler CLI).
2. Cloudflare Pages: **Create project** → connect repo (or upload the `site/` folder).
3. Build settings:
   - Build command: *(leave empty)*
   - Build output directory: `site`
4. Custom domain: `nfusia.com` (apex). No `www` subdomain needed unless you want it.

See `DEPLOY.md` for the full step-by-step.

## Regenerate images

```bash
./scripts/generate-icons.sh
```

App site assets are written into `site/feedmybaby/` (icon-512.png, favicon.png).

## Pages (all under /feedmybaby)

- `feedmybaby/index.html` — marketing landing page (store badges say "Coming soon" until release)
- `feedmybaby/privacy.html` — privacy policy (required URL for App Store & Google Play listings)
- `feedmybaby/support.html` — support/FAQ page (required support URL for App Store listing)

Contact email used across the site: `support@nfusia.com` — make sure this mailbox exists.
