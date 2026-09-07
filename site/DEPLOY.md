# Deploying nfusia.com — step by step

Goal: host this `site/` folder on Cloudflare Pages at `https://nfusia.com`, with the
BubbiFeed app site at **`https://nfusia.com/feedmybaby`**, and create the
`support@nfusia.com` mailbox. Prerequisite (already true): `nfusia.com` DNS is hosted on
your Cloudflare account.

> **Brand-only rename (2026-09-07):** BubbiFeed keeps the existing website path,
> contact address and Pages project. The provisioning steps below are historical
> setup instructions, not permission to create another project or change DNS.
> No production deployment or mailbox/domain migration is part of the rebrand.
> See the [rebrand audit](../plans/bubbifeed-rebrand.md).

---

## Before you start

- Make sure you do **not** currently have another live website running on `nfusia.com`
  that you want to keep. Attaching the custom domain (Part 2) will take over the apex
  domain's DNS records for this project.
- The Pages project name must be globally unique across all of Cloudflare. If
  `feedmybaby` is taken, replace it with something like `nfusia-site` or
  `feedmybaby-app` everywhere below.
- `site/_headers` in this folder is automatically applied by Pages — no extra config needed.

**Why subpath (`/feedmybaby`) instead of the whole domain?**
You asked for `nfusia.com/feedmybaby`. Cloudflare Pages doesn't natively mount a project
at a path — a custom domain maps to the project root. So we put the app site inside a
`feedmybaby/` subfolder, and `nfusia.com` (apex) shows a minimal studio landing that
links to it. All app links use **relative paths**, so it works on both
`feedmybaby.pages.dev` and `nfusia.com` without any changes.

---

## 0. How `pages.dev` relates to `nfusia.com` (and whether you need Wrangler)

- `feedmybaby.pages.dev` is the **free automatic address** Cloudflare gives every
  Pages project. It is where your files are actually hosted and it works instantly
  with zero configuration — ideal for verifying the site before touching your real
  domain. The app site will be at `https://<project>.pages.dev/feedmybaby/`.
- `nfusia.com` is a **custom alias for the same project**. When you attach it in
  Part 2, Cloudflare points your domain's DNS at the project; both URLs then serve
  identical content. The `.dev` address keeps working afterwards as a handy
  preview/staging link. You never "move" anything from `.dev` to `.com`.
- **Wrangler is optional.** It is simply Cloudflare's command-line uploader. There
  are three equivalent ways to publish the `site/` folder:
  1. Wrangler CLI (`npx wrangler pages deploy …`) — fastest from a terminal.
  2. Direct Upload — dashboard: Workers & Pages → Create → Pages → **Upload assets**,
     then drag-and-drop the `site/` folder. No CLI at all.
  3. Git integration — connect GitHub; Cloudflare redeploys on every push.
  Pick any; Parts 2–4 (custom domain, email) are identical either way.

---

## Part 1 — Deploy the site

### Option A: Wrangler CLI (fastest, do this now)

Run from the repo root:

```bash
npx wrangler login
#   → a browser tab opens; click "Allow" to authorize Wrangler.

npx wrangler pages project create feedmybaby --production-branch main
#   → creates the project; your site will get https://feedmybaby.pages.dev
#   → if the name is taken, use another globally-unique name (e.g. nfusia-site)

npx wrangler pages deploy site --project-name feedmybaby --branch main
#   → uploads the folder as a new production deployment
```

Verify in a browser:

- `https://feedmybaby.pages.dev` → studio landing
- `https://feedmybaby.pages.dev/feedmybaby/` → app landing page
- `https://feedmybaby.pages.dev/feedmybaby/privacy.html`
- `https://feedmybaby.pages.dev/feedmybaby/support.html`

### Option B: Git integration (auto-deploys on every push, optional)

1. Push this repo to GitHub (`git remote add origin …`, `git push -u origin main`).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Pick the repo. Build settings:
   - Build command: *(leave empty)*
   - Build output directory: `site`
   - Production branch: `main`
4. **Save and Deploy**. Every future push to `main` now redeploys automatically.

### Option C: Direct Upload (no terminal at all)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Project name: `feedmybaby` (or your unique alternative).
3. Drag and drop the entire `site/` folder into the browser window.
4. Wait for the deployment to finish; Cloudflare shows the `pages.dev` URL.
5. Continue with Part 2.

(With Option A only, redeploy manually after edits:
`npx wrangler pages deploy site --project-name feedmybaby --branch main`)

### Redeploying after changes

Whenever you modify any file under `site/` (new pages, updated content, regenerated
assets), just re-run the deploy command:

```bash
npx wrangler pages deploy site --project-name feedmybaby --branch main
```

Each deploy uploads the full current contents of `site/` and promotes it to production
immediately. Both `feedmybaby.pages.dev` and `nfusia.com` serve the new version.
There's nothing to rebuild or invalidate — Cloudflare Pages replaces the deployment
atomically. (If you enabled Git integration in Option B instead, just `git push` and
Cloudflare redeploys for you.)

---

## Part 2 — Attach the custom domain nfusia.com

1. Dashboard → **Workers & Pages** → open the `feedmybaby` project → **Custom domains** tab.
2. **Set up a custom domain** → type `nfusia.com` → **Continue**.
3. Cloudflare shows the DNS records it will add (apex uses CNAME flattening).
   If an existing A/AAAA record on `nfusia.com` conflicts, approve replacing it.
4. Click **Activate domain**.
5. Wait 1–5 minutes for the Universal SSL certificate. Status turns **Active**.
6. Verify:
   - `https://nfusia.com` → studio landing
   - `https://nfusia.com/feedmybaby/` → app landing
   - `https://nfusia.com/feedmybaby/privacy.html` → privacy policy
   - `https://nfusia.com/feedmybaby/support.html` → support

> No `www` subdomain is needed. If you later want `www.nfusia.com` to also work, add it
> as a second custom domain and it will serve the same site.

---

## Part 3 — Create support@nfusia.com (free, Cloudflare Email Routing)

> Make sure `support@nfusia.com` is not already a real mailbox elsewhere (e.g. Google
> Workspace). Cloudflare Email Routing intercepts the address and forwards it; if the
> address is a real mailbox on another service, it will break.

1. Dashboard → select `nfusia.com` → **Email** → **Email Routing** → **Get started/Enable**.
   (Cloudflare adds the required MX and SPF records automatically.)
2. **Destination addresses** → **Add destination address** → enter your personal inbox
   (e.g. your Gmail) → open the verification email it sends and click the link.
3. **Routing rules** → **Create rule**:
   - Name: `support`
   - If address matches: `support@nfusia.com` (custom address `support`)
   - Action: **Send to** → your verified personal address.
4. Test: send an email to `support@nfusia.com` from another account and confirm it arrives.

---

## Part 4 — Record the URLs you'll paste into the store listings later

| Store field | URL |
|---|---|
| Marketing / website URL | `https://nfusia.com` |
| App landing page | `https://nfusia.com/feedmybaby/` |
| Privacy policy URL (App Store + Play) | `https://nfusia.com/feedmybaby/privacy.html` |
| Support URL (App Store) | `https://nfusia.com/feedmybaby/support.html` |
| Support contact email | `support@nfusia.com` |

---

## Part 5 — Troubleshooting

- **Site looks correct on `pages.dev` but `nfusia.com` shows an old page / certificate error.**
  - Purge cache: dashboard → `nfusia.com` → **Caching** → **Purge everything**.
  - Check SSL/TLS → **Overview**; the edge certificate can take up to 15 minutes.
- **`_headers` file not working.** It must sit at `site/_headers` (it does) and be uploaded
  as part of the deployment. Use `curl -I https://nfusia.com/feedmybaby/privacy.html` and
  look for `x-content-type-options: nosniff`.
- **Email verification not arriving.** Check spam; Gmail sometimes delays it by a few minutes.
- **Redeployed but `pages.dev` still shows old content.** Append `?nocache=1` once, or
  purge cache in the dashboard.
- **Git integration says "Build output directory not found".** Make sure `site/` is at the
  repo root and the build command is truly empty (not a space).

---

## Checklist

- [ ] Site deployed by one of the three methods; `pages.dev` URLs verified (incl. `/feedmybaby/`)
- [ ] `nfusia.com` custom domain Active
- [ ] `nfusia.com/feedmybaby/privacy.html` and `/support.html` load correctly
- [ ] `support@nfusia.com` routing rule verified with a test email
- [ ] URLs saved for store submissions
- [ ] Optional: Git integration connected for auto-deploys

When the checklist is ticked, come back and we'll do the Expo signup + `npx eas login` /
`npx eas init` step.
