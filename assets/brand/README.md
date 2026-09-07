# BubbiFeed brand assets

## Name

- User-facing spelling: **BubbiFeed**.
- Ordinary lowercase brand spelling: **bubbifeed**.
- Former product name: FeedMyBaby (retain only in historical context or existing
  compatibility identifiers, not as the current display brand).

## Preserve the existing design

BubbiFeed is a simple, gentle feeding tracker for tired parents and caregivers.
This rename does not redesign it.

- Keep the existing bottle with heart cutout, including the adaptive and monochrome variants.
- Reuse the cream background, coral/rose/mint accents and dark slate text from
  [`theme.ts`](../../src/constants/theme.ts). Do not introduce a second palette.
- Keep current typography, spacing, rounded cards and layouts.
- Retain the existing artwork backgrounds exactly, including their existing
  gradient; do not add new gradients, fonts, mascots or visual systems.

## Editable sources and outputs

| Source | Current generated output |
| --- | --- |
| [`icon.svg`](icon.svg) | [`icon.png`](../images/icon.png), [website icon](../../site/feedmybaby/icon-512.png) |
| [`android-background.svg`](android-background.svg) | [Android background](../images/android-icon-background.png) |
| [`android-foreground.svg`](android-foreground.svg) | [Android foreground](../images/android-icon-foreground.png) |
| [`android-monochrome.svg`](android-monochrome.svg) | [Android monochrome icon](../images/android-icon-monochrome.png) |
| [`splash.svg`](splash.svg) | [Splash image](../images/splash-icon.png) |
| [`favicon.svg`](favicon.svg) | [App web favicon](../images/favicon.png), [website favicon](../../site/feedmybaby/favicon.png) |

These SVGs contain shapes, not a product wordmark. Their PNG outputs therefore
do not need regenerating for the rename. Wordmarks are text in the app navigation
and website HTML, while the native launcher label comes from [`app.json`](../../app.json:3).

If artwork is intentionally edited later, edit the SVG source first and use the
existing [image-generation script](../../scripts/generate-icons.sh). Do not edit
only a generated PNG. The retained website output directory is an existing public
URL path, not an outdated wordmark.

See the [rebrand audit](../../plans/bubbifeed-rebrand.md) for identity and URL boundaries.
