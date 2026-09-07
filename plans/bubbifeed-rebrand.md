# BubbiFeed — brand-only rename audit

Date: 2026-09-07. Former display brand: FeedMyBaby. Baseline: 5dddda2.

## Scope

The current user-facing product brand becomes **BubbiFeed**; ordinary lowercase
brand text uses **bubbifeed**. This is not a redesign, app identity change, data
migration or external service migration.

- App display name: [`app.json`](../app.json:3). Expo SDK 56 documents this as the
  Expo Go / standalone home-screen display name. Native directories are ignored
  and not tracked; no prebuild or native regeneration is performed for the rename.
- App desktop-web wordmark: [`app-tabs.web.tsx`](../src/components/app-tabs.web.tsx).
  Current icon/toast component documentation also uses BubbiFeed. Feeding/profile
  screens, validation, timers, storage and calculations are not rewritten.
- Website: existing [studio entry](../site/index.html), [product landing](../site/feedmybaby/index.html),
  [privacy policy](../site/feedmybaby/privacy.html) and [support/FAQ](../site/feedmybaby/support.html).
  Updated product names in visible text, titles, descriptions and image alt text.
- No separate About/Terms, translations, notification templates, export reports,
  store-copy/email-template files, Open Graph/Twitter metadata, JSON-LD, PWA manifest
  or social-share artwork existed in the audited sources. None is invented.
- Artwork: the [editable sources](../assets/brand/README.md) contain no old text.
  All original SVG/PNG artwork and design tokens are retained. Only the disposable
  intermediate image name in the [generator](../scripts/generate-icons.sh) uses
  the new lowercase brand; generated output paths remain the same.
- Current documentation updated; original dated reports receive explanatory
  notes rather than rewriting release history. No new branding dependency or
  cross-project configuration system is needed for two app label locations and
  the existing plain-HTML website.

## Intentionally retained old-name references (category B)

| Locations | Retained reference | Reason |
| --- | --- | --- |
| [`app.json`](../app.json) | Expo slug and URL scheme: `feedmybaby`; iOS/Android identity: `com.nfusia.feedmybaby` | Preserve existing installation/update identity, deep links and service linkage |
| [`app.json`](../app.json), [`eas.json`](../eas.json) | Owner `nfusia`, EAS project ID `2ffd44ad-9462-4750-8cf1-037dbc7905ae`, all publishing/build settings | No replacement project, credentials change or cloud operation |
| [`package.json`](../package.json) | Private package name `feedmybaby` | Existing internal project/tooling identifier, not a display label; dependencies and scripts unchanged |
| [`storage.ts`](../src/utils/storage.ts), [`ui-check.js`](../scripts/ui-check.js) | `@feedmybaby_profiles_v1`, `@feedmybaby_logs_v1`, `@feedmybaby_settings_v1` | Existing users and test fixtures must read the same profiles, logs and settings |
| [Website HTML/CSS references](../site), [image generator](../scripts/generate-icons.sh) | Existing `feedmybaby/` directory, asset paths and relative links | Public path and working navigation, not product wordmark text |
| [Site README](../site/README.md), [deployment reference](../site/DEPLOY.md), [`snippets.txt`](../snippets.txt) | Existing `feedmybaby` Pages project, `feedmybaby.pages.dev` and `nfusia.com/feedmybaby/` URLs; initial setup examples | Real/configured addresses or historical provisioning identifiers; do not rename/create resources |
| [Expo account reference](expo-account-setup.md) | Existing Expo project URL/slug and historical incident content | Compatibility and original setup/incident record |
| [Store-readiness report](app-store-readiness-report.md), [UI audit](ui-audit-fix-plan.md) | FeedMyBaby, prior placeholder package IDs and dated name-change examples | Historical facts, now explicitly marked as historical |
| [Current README](../README.md), [brand guide](../assets/brand/README.md), this audit | Former-name/compatibility explanations | Deliberate historical or migration-boundary context, not current UI branding |
| Ignored local [Android resources](../android/app/src/main/res/values/strings.xml) and [iOS plist](../ios/feedmybaby/Info.plist) | Old generated launcher labels and native project names | Pre-existing local generated snapshots, not tracked sources; no destructive regeneration or hand-edit of only generated files |

The workspace folder/repository remotes, caches, service state and user-supplied
names/notes are not renamed. An old-brand spelling in a baby's name or feeding
note is user data, not an omitted brand replacement.

All current website link targets, Nfusia's legal/publisher identity,
support@nfusia.com and the privacy policy's **August 16, 2026** effective date are
retained. No new domain, mailbox, store URL, redirect or canonical URL is claimed.

## Verification record

### Passed locally

- Read the exact [SDK 56 reference](https://docs.expo.dev/versions/v56.0.0/) and
  [SDK 56 app-config reference](https://docs.expo.dev/versions/v56.0.0/config/app/)
  before implementation. The first Python HTTP request received 403; the browser-user-agent
  request succeeded. No dependency installation or upgrade was needed.
- TypeScript check completed successfully using the installed compiler with no emit.
- Public Expo config parsing and **introspection** completed successfully.
  The introspected iOS display name and Android app-name resource are **BubbiFeed**.
  The bundle/package identifier, slug, scheme, owner and EAS project ID retain
  their baseline values. Introspection did not write native files.
- Local production-mode Expo exports succeeded: web (all 7 static routes) and
  Android JavaScript/Hermes plus assets. These are **not** native APK/IPA builds.
- Automated baseline comparison confirmed **28 protected tracked files** are
  byte-identical, including business screens, storage, design tokens, artwork,
  dependencies, publishing configuration and project instructions. The only
  change to App configuration is the display-name value.
- All four website HTML files equal their baseline after only the exact product
  name replacement. Link targets, contact details, legal text/date, markup and
  download placeholders are unchanged. Website CSS rules are byte-identical;
  only its brand comment changed.
- Visually reviewed an image contact sheet containing all 8 current PNG outputs.
  All original SVG sources are shape-only; no old wordmark exists to repaint.
- Website: 4 pages at widths **320, 360, 393, 768 and 1440**. Checked current
  titles, descriptions, visible brand text, image loads and local link responses.
  Real navigation from studio entry to product, privacy and support succeeded.
  The new wordmark fits at all tested widths; see the existing narrow-header
  limitation below. No website runtime errors occurred.
- App web export: 5 main pages at widths **360, 393, 768 and 1440**. Desktop
  BubbiFeed wordmarks fit without clipping at 768/1440. Existing storage values
  remain unchanged during navigation, and synthetic profiles/history/settings
  load using the original keys.
- Isolated browser interaction test passed: existing breast/bottle/solid records
  render; daily totals read 7 nursing minutes / 120 ml; a nursing timer advances,
  pauses and retains its paused value across tab navigation; a main bottle save
  and a speedy log append to the same legacy log store. Reload preserves all
  records and totals update to 330 ml. Synthetic names/notes containing former-brand
  spellings stay unchanged. No real user data or installed-app storage was accessed.
- Read-only public GET checks returned HTTP 200 for the existing Nfusia root,
  product, privacy and support URLs and the Pages product URL. The existing
  privacy/support HTML URLs redirect to extensionless paths successfully; their
  targets were not changed. No email was sent and no site was deployed.
- Final case-insensitive old-name scan covers concatenated, spaced, hyphenated
  and underscored spellings, excluding dependencies, Git, caches and generated
  outputs (including ignored native snapshots). Remaining references are category B
  as listed above; no category A current-brand omission remains.
- Changed-file whitespace check and current Markdown link-target checks passed.

### Existing problems and limits (not hidden or fixed as part of a rename)

- **Lint:** the existing npm lint script cannot run with the repository's missing
  ESLint configuration. Its automatic installation/configuration prompt was
  declined. A read-only lint using the already-installed Expo flat preset reports
  **19 errors / 25 warnings**. Linting the same tracked source files from baseline
  5dddda2 and the renamed worktree produced identical diagnostics: **no new lint
  findings**. Dependencies, lint configuration and business logic were not changed.
- **Tests:** no unit-test script or unit-test suite is configured. The local
  compatibility assertions and browser checks above are additional verification,
  not a claim that an existing unit-test suite passed.
- **App static-web hydration:** React hydration error 418 occurs in the exported
  logger and desktop layouts. Matched baseline/current exports across all 20
  page/viewport cases reproduce the same diagnostic categories and recover to
  usable UI. Corrected test instrumentation restricts storage seeding to the test
  origin (the first runner had also attempted storage access on a blank page).
  Final interaction checks have no unexpected runtime errors beyond the verified
  baseline hydration warning. The rename does not fix those existing rendering issues.
- **Website narrow header:** the existing single-row header pushes Support past
  the right edge at 320/360 widths (right edge about 364 px after the rename,
  versus 384 px with the old wordmark). BubbiFeed itself is not clipped; all
  header links fit at 393 and above. The existing layout was deliberately retained,
  as requested, rather than adding a responsive redesign to the brand change.
- **Native snapshots / device validation:** ignored local Android/iOS directories
  predate this task and still contain their old generated display labels. They
  were not rebuilt or modified. The version-controlled source of truth is
  [`app.json`](../app.json:3); before a future authorized native release, synchronize
  native outputs through the existing generation workflow rather than building
  stale local snapshots. Launcher truncation, installed-app upgrades, OS font
  scaling and on-device runtime behavior were **not** tested in this task.
- **External state:** production still serves the previously deployed files.
  Mailbox delivery, store listing availability, dashboard names and signing/update
  installation behavior were not changed or verified. No cloud build, production
  deploy, domain registration, service migration or new EAS project was initiated.

Local screenshot and assertion evidence is in the gitignored
[`scripts/ui-check/rebrand`](../scripts/ui-check/rebrand) output directory. Exported
web/Android bundles and the isolated old-version comparison are also gitignored.
Neither temporary output changes the product's sources or deployment settings.

## External follow-up (not executed)

- Update the product's display name and existing marketing copy in App Store
  Connect / Google Play Console, subject to name availability and store rules.
  Keep the existing application identifiers, credentials and listing associations.
- Separately authorize a new native build/release and a deployment to the
  existing Pages project when ready. Installed apps and live pages do not change
  merely because local source files were edited; no reinstall/data reset is needed.
- Optionally update external project/dashboard display labels without changing
  their IDs. No new EAS project is required.
- Any new domain, mailbox or redirect needs verified ownership/configuration and
  separate approval first. Existing Nfusia addresses remain the targets.
