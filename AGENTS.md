# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# IMPORTANT REFERENCE — EAS Build "lockfile out of sync" incident (2026-08-31)

## Symptom
`eas build --platform android --profile preview` failed in the server-side
"Install dependencies" phase with:

    npm error `npm ci` can only install packages when your package.json and
    package-lock.json ... are in sync.
    npm error Missing: typescript@5.9.3 from lock file

…even though the local working tree, the git commit, and `git archive HEAD`
all contained a perfectly synced pair (`typescript ~6.0.3` in package.json and
`6.0.3` resolved in package-lock.json, lockfileVersion 3). Local `npm ci
--include=dev` passed cleanly. The stale version in the error (5.9.3) did not
exist ANYWHERE in the repo.

## Root cause
The EAS build worker served a **stale cached source snapshot** (old
package.json from the original template + newer lockfile) regardless of the
uploaded archive / commit hash. Verified: build metadata showed the correct
commit, yet the worker's npm saw the old spec.

## What did NOT work (do not waste time retrying)
- `npm install` to re-sync the lockfile (already synced; byte-identical regen)
- committing everything (EAS still saw stale content)
- `eas build --clear-cache` (only clears dep/gradle caches, not source)
- `EAS_NO_VCS=1` (raw working-dir upload; same failure)
- upgrading eas-cli 22 → 23 (needed anyway for Node 26, but didn't fix it)
- `"install": "npm install --include=dev"` in eas.json → **schema rejects it**
  (`"build.preview.install" is not allowed`)

## The fix that worked (current repo state)
1. `package-lock.json` is **deleted from the repo** (kept in git history;
   restore with `git checkout c41cca5 -- package-lock.json` when the EAS-side
   issue is resolved).
2. `eas.json` preview profile sets `"env": { "EAS_BUILD_SKIP_LOCKFILE_CHECK": "1" }`
   (server-side) — but the lockfile check ALSO runs client-side, so the build
   command must be run as:

       EAS_BUILD_SKIP_LOCKFILE_CHECK=1 npx eas build --platform android --profile preview

   The worker then performs a fresh `npm install` (self-healing), which cannot
   fail on a lockfile mismatch. First successful build: 1f5f62c6 (v1.0.0).

## General rules learned
- EAS builds the **committed** state, not the working tree: ALWAYS `git commit`
  before `eas build`, or the cloud build silently uses stale files.
- When a server error references a version that exists nowhere in the repo,
  suspect EAS server-side source caching; bypass with the lockfile-less +
  skip-check combination above instead of fighting the lockfile.
- Full narrative + restore steps: plans/expo-account-setup.md
  ("Known issue & workaround" section).
