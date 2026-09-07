# Nfusia official site — BubbiFeed

Static site for Cloudflare Pages. No build step required.

The product name is **BubbiFeed**. Its existing public path remains
[nfusia.com/feedmybaby/](https://nfusia.com/feedmybaby/); the rename does not change
domains, contact addresses or Cloudflare project identity. Nfusia remains the publisher.
See the [brand rules](../assets/brand/README.md) and [rebrand audit](../plans/bubbifeed-rebrand.md).

**Layout:**
- `site/index.html` — apex landing for `nfusia.com` (studio home, links to the app)
- `site/feedmybaby/` — the BubbiFeed product site (landing, privacy, support) at `nfusia.com/feedmybaby`
- `site/_headers` — security headers (applied site-wide by Pages)

## Local preview

From the repository root (no cloud deployment):

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory site
```

Open [the studio entry](http://127.0.0.1:4173/) and
[BubbiFeed](http://127.0.0.1:4173/feedmybaby/).

## Deploy to Cloudflare Pages

Deployment is a separate, explicitly authorized operation. The existing site is
already associated with a Pages project; do not create a replacement project or
change its domain just for this rename. The following is initial-setup reference.

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
