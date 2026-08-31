# FeedMyBaby — UI Audit & Fix Plan (2026-08-31)

Source: owner device screenshots (Android, build 1f5f62c6) showing missing/wrong tab icons,
font inconsistency, text clipping/overflow, and misalignment across all 5 tabs.

## Decision

| Proposal | Verdict | Why |
|---|---|---|
| Tailwind CSS (web) | ❌ Not applicable | Web-only; does nothing inside a React Native app |
| shadcn/ui | ❌ Not applicable | Web/React DOM only; RN equivalent is RN Reusables |
| NativeWind + RN Reusables | ❌ Skip for now | App already has a token system (`Colors`/`Spacing` in `theme.ts` + `ThemedText`/`ThemedView`); rewriting all 5 screens = high risk, no native-tab benefit, doesn't fix the real bugs |
| **lucide-react-native** | ✅ **Adopt** | SVG icons replace 29 emoji usages + give crisp, tintable tab icons; matches site branding |
| **expo-router standard JS Tabs** | ✅ **Adopt** (owner-approved) | Replaces `unstable-native-tabs`; identical on Android/iOS/web, fully styleable, fixes broken tab icons |

## Root causes found (evidence)

1. **Tab icons** — `src/components/app-tabs.tsx` uses `NativeTabs` (unstable) + raster PNGs in
   `assets/images/tabIcons/*.png`. On device they render as generic house/suitcase blobs
   (fallback glyphs) → missing/wrong icons.
2. **Fonts** — `src/constants/theme.ts` maps Android `sans → 'normal'` and bundles no font;
   `src/global.css` (Spline Sans/Inter) is web-only. Result: device-default fallback + inconsistent weights.
3. **Misalignment/overflow** — hard-coded large type with no truncation:
   `themed-text.tsx` `title: fontSize 48`, per-screen `headerTitle: fontSize 28`,
   `logger.tsx` `amountText: 48` / `timerDigit: 32`, `index.tsx` `dialCounter: 40`.
   → "No feeds loaded" clips, "Baby Profiles+ Add Baby" collides, "Measurement Preferences"
   wraps, `00:00` timers wrap to two lines.
4. **Emojis as icons** — 29 occurrences across `index/logger/history/insights/settings` +
   `app-tabs.web.tsx`; render inconsistently across Android OEMs.

## Design tokens (target type scale)

Fix in `themed-text.tsx` + per-screen overrides:

| Token | Current | Target |
|---|---|---|
| screen title (`headerTitle`/`title`) | 48 / 28 | **28** (lineHeight 34) |
| section heading (`subtitle`) | 32 | **20** (lineHeight 26) |
| big dial/amount (`dialCounter`/`amountText`) | 40–48 | **40**, `fontVariant: ['tabular-nums']` |
| timer digit (`timerDigit`) | 32 | **30**, tabular-nums, fixed-width row |
| body / small | 16 / 14 | keep (16 / 14) |

Layout rules: all title rows get `flexShrink: 1` + `numberOfLines={1..2}`; action labels
(e.g. "+ Add Baby", "CHANGE") moved to their own flex-end slot so they can't collide;
timer/preset rows use `flexDirection: 'row'` with fixed-width digit containers.

## Icon mapping (emoji → Lucide)

`lucide-react-native` (24px default, `color` from theme, `strokeWidth={2}`):

| Usage | Emoji | Lucide |
|---|---|---|
| Tab: Home | 🏠 | `House` |
| Tab: Log Feed | 🍼 | `Milk` |
| Tab: History | 📅 | `CalendarDays` |
| Tab: Insights | 📊 | `ChartColumn` |
| Tab: Settings | ⚙️ | `Settings` |
| Feed type: breast | 👩‍🍼 | `Baby` (tint `colors.breast`) |
| Feed type: bottle | 🍼 | `Milk` (tint `colors.bottle`) |
| Feed type: solid | 🥑🍽️ | `Apple` / `UtensilsCrossed` (tint `colors.solid`) |
| Live timer | ⏱️ | `Timer` |
| Manual input / edit | ✍️✏️ | `PenLine` / `Pencil` |
| Play / pause (breast timers) | ▶️⏸️ | `Play` / `Pause` |
| Left / right side | 👈👉 | `ArrowLeft` / `ArrowRight` (or `ChevronLeft/Right`) |
| Delete | 🗑️ | `Trash2` |
| Add baby | ➕ | `Plus` |
| Speedy preset / 3AM | ⚡ | `Zap` |
| Forecast hungry | 🍼 | `Milk` |
| Gender: boy/girl/other | 👶👧🍼 | `Baby` (single neutral icon, tinted) |

## Work breakdown

### Phase 0 — Deps & icon foundation
- `npx expo install react-native-svg` then `npm i lucide-react-native` (SDK 56-compatible versions).
- Create `src/components/app-icon.tsx`: a tiny `AppIcon` wrapper around `lucide-react-native`
  (name → component map, default `size`/`strokeWidth=2`, `color` default `theme.text`) so
  screens import one component and we can swap sets later.
- Create `src/constants/feed-icons.ts`: `feedType → { Icon, colorKey }` helper
  (`breast→Baby/breast`, `bottle→Milk/bottle`, `solid→Apple/solid`) reused by index/history/insights/logger.

### Phase 1 — Tab bar (owner-approved)
- Rewrite `src/components/app-tabs.tsx` to expo-router **`Tabs`** with `tabBarIcon` using
  `AppIcon` (House/Milk/CalendarDays/ChartColumn/Settings), `tabBarActiveTintColor: colors.primary`,
  `tabBarInactiveTintColor: colors.textSecondary`, themed `tabBarStyle` background + top border.
- Replace `src/components/app-tabs.web.tsx` emoji `icon` prop with the same `AppIcon` set
  (keeps web consistent; `TabButton` signature updated to accept a component/node).
- Delete `assets/images/tabIcons/` (15 PNGs) once JS Tabs confirmed working.

### Phase 2 — Type scale & truncation
- `src/components/themed-text.tsx`: `title 48→28 (lh 34)`, `subtitle 32→20 (lh 26)`;
  add optional `numberOfLines` passthrough (already supported via `TextProps`).
- Per-screen `headerTitle` 28 stays 28 but add `flexShrink: 1`, `numberOfLines: 1`; ensure header
  rows are `flexDirection:'row', alignItems:'center', justifyContent:'space-between'` with the
  trailing action in a non-shrinking slot.
- `logger.tsx`: `amountText 48→40`, `timerDigit 32→30` + `fontVariant:['tabular-nums']`, wrap each
  timer in a fixed-min-width column so `00:00` never wraps; `index.tsx` `dialCounter 40` + tabular-nums.
- Settings header: split "Baby Profiles" (flex-1, shrink) and "+ Add Baby" (own Pressable, flex-end)
  so they can't run together.

### Phase 3 — Emoji sweep (29 sites)
- `src/app/index.tsx` (avatar, last-feed chip, 3 totals, preset bolt, 2 shortcuts, recent list).
- `src/app/logger.tsx` (avatar, live-timer/manual labels, L/R play-pause, last-side labels).
- `src/app/history.tsx` (empty state, per-log icon, delete buttons, delete-modal icon).
- `src/app/insights.tsx` (2 KPI icons, forecast string "Hungry Now 🍼" → icon + text).
- `src/app/settings.tsx` (add-baby, gender avatar, edit/delete).
- Convert string-embedded emojis (e.g. forecast note "Logged with 3 AM Speedy Preset ⚡") to plain text.
- Verification: run the python emoji-range sweep over `src/**/*.tsx` → must be 0.

### Phase 4 — Verify & ship
- TypeScript/lint clean: `npx tsc --noEmit`, `npm run lint`.
- Local visual pass: `npm run android` (or Expo Go) on the same device; screenshot all 5 tabs in
  light + dark.
- Commit, then rebuild preview APK: `EAS_BUILD_SKIP_LOCKFILE_CHECK=1 npx eas build --platform android --profile preview`.
- Owner smoke-test pass 2.

## Risks / notes
- `lucide-react-native` requires `react-native-svg` — must be the Expo-SDK-56-pinned version
  (`npx expo install`, not bare `npm i`).
- Switching NativeTabs → JS Tabs removes the native iOS 26 "liquid glass" tab bar; acceptable
  trade-off for cross-platform correctness (owner approved).
- Keep lockfile-less EAS workaround (AGENTS.md) — build command unchanged.
- No change to dark-mode palette; Lucide uses `currentColor` so theming stays intact.

## Explicitly out of scope
- Migrating styling to NativeWind / RN Reusables (revisit only if theming needs outgrow tokens).
- Store submission work (Steps 7–8) — unchanged.
