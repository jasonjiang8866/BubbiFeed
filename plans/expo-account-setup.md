# Expo account setup — step by step

> Goal: create a free Expo account and link this repo to it, so EAS Build
> (cloud builds for iOS/Android) works. ~5 minutes, no payment required.

---

## Part 1 — Create the account (browser, ~3 min)

1. Open **https://expo.dev/signup** in your browser.

2. Choose a sign-up method:
   - **Email + password**, or
   - **"Continue with GitHub"** (recommended — one click, and it makes CI
     setup easier later).

3. If you used email: check your inbox for a **verification email** from Expo
   and click the link inside. (GitHub sign-ups are verified automatically.)

4. Expo will ask for an **account username**. This becomes the *owner* prefix
   of all your projects (e.g. your project URL will be
   `expo.dev/accounts/<username>/projects/feedmybaby`).
   - Suggestion: use `nfusia` to match your brand/domain.
   - It's a *personal* account by default — that's fine. You can create an
     Organization later if you ever have collaborators.

5. Skip any onboarding prompts (like "create your first project" in the web
   UI). We'll link the project from the CLI instead — that keeps the
   `projectId` in `app.json` where the repo expects it.

6. (Optional, recommended) Turn on **two-factor authentication**:
   Avatar (top right) → Account settings → Two-factor authentication.

### Free tier check

The free plan includes EAS Build credits (a limited number of builds per
month — check https://expo.dev/pricing for the current quota). For this
project the free tier is enough to start; Android builds are cheap and you
can also build locally (no cloud quota used) with `eas build --local`.

---

## Part 2 — Log in from the terminal (tell me when ready)

Once the account exists, I will run the following from the repo
(`eas-cli` is already installed as a devDependency):

```bash
npx eas login
```

- A browser window opens (or a login code is shown if you're in a headless
  environment). Sign in with the account you just created.
- Verify it worked:

```bash
npx eas whoami
# → should print your username (e.g. nfusia)
```

---

## Part 3 — Link this repo to your Expo account

```bash
npx eas init
```

What this does:

- Creates the project **FeedMyBaby** in your Expo account dashboard.
- Writes the generated EAS `projectId` into `app.json` under
  `expo.extra.eas.projectId`.
- ⚠️ EAS will complain that `app.json` is not git-committed — commit the repo
  first or let it proceed anyway (we can commit right after).

After `eas init`, the final `app.json` will look like:

```json
"extra": {
  "eas": {
    "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

---

## Part 4 — Sanity check the config (I'll run these)

```bash
npx eas build:configure        # validates eas.json against the project
npx eas project:info           # confirms slug, owner, projectId
```

Then the first real build (Android preview APK — works without any developer
account):

```bash
npx eas build --platform android --profile preview
```

iOS builds will come later — they need your **Apple Developer account**
($99/year), which EAS uses to generate the signing certificate and
provisioning profile automatically (`eas credentials`).

---

## Known issue & workaround: EAS "npm ci" lockfile failure (2026-08-31)

EAS build workers repeatedly failed `npm ci` with
`Missing: typescript@5.9.3 from lock file` even though the committed
`package.json` + `package-lock.json` were verified correct locally and inside
`git archive HEAD` (the server appeared to serve a stale cached source mix).
Attempts that did NOT fix it: `npm install` re-sync, `--clear-cache`,
`EAS_NO_VCS=1`, upgrading eas-cli to 23.

**Workaround applied (commits 86b9cad / later):**
1. Deleted `package-lock.json` from the repo (it stays in git history).
2. Set `EAS_BUILD_SKIP_LOCKFILE_CHECK=1` when running `eas build` (the check
   runs client-side; the eas.json `env` entry alone is not enough).
   ```bash
   EAS_BUILD_SKIP_LOCKFILE_CHECK=1 npx eas build --platform android --profile preview
   ```
   The worker then runs a fresh `npm install`, which self-heals any mismatch.

**To restore determinism later:** re-add the lockfile (`git checkout <old-sha> -- package-lock.json`),
remove the skip flag, and rebuild — once the EAS-side caching issue is resolved.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `eas login` browser doesn't open | Run `npx eas login --no-browser` — it prints a code + URL to paste in any browser |
| "Not logged in" on every command | The session token lives in `~/.expo/state.json`; re-run `npx eas login` |
| `eas init` asks to overwrite slug | Our slug is `feedmybaby` — answer yes/confirm |
| Two accounts / wrong owner | `npx eas logout` then log in with the correct one |

## Security note

Never commit personal access tokens (`eas token:create`) to the repo. The
login session file (`~/.expo/state.json`) stays on your machine only and is
already outside the repo — nothing to add to `.gitignore`.
