#!/bin/bash
# Renders the SVG brand sources in assets/brand/ to the PNG assets used by
# app.json (iOS icon, Android adaptive icon, splash, favicon).
# Requires Google Chrome (headless) on macOS.
set -e
cd "$(dirname "$0")/.."

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

render() {
  local src="$1" dst="$2" size="$3"
  "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scroll-bars \
    --force-device-scale-factor=1 --window-size="$size,$size" \
    --default-background-color=00000000 \
    --screenshot="$dst" "file://$PWD/$src" >/dev/null 2>&1
  echo "== $dst"
  sips -g pixelWidth -g pixelHeight -g hasAlpha "$dst" | tail -3
}

render assets/brand/icon.svg              assets/images/icon.png                  1024
render assets/brand/android-background.svg assets/images/android-icon-background.png 432
render assets/brand/android-foreground.svg assets/images/android-icon-foreground.png 432
render assets/brand/android-monochrome.svg assets/images/android-icon-monochrome.png 432
render assets/brand/splash.svg            assets/images/splash-icon.png            288
render assets/brand/favicon.svg           assets/images/favicon.png                 48

# Site assets (Cloudflare Pages — app site lives under site/feedmybaby/)
# icon.svg is intrinsically 1024px; render at 1024 then downscale to 512.
render assets/brand/icon.svg              /tmp/bubbifeed-icon-1024.png           1024
sips -z 512 512 /tmp/bubbifeed-icon-1024.png --out site/feedmybaby/icon-512.png >/dev/null
echo "== site/feedmybaby/icon-512.png (downscaled)"
render assets/brand/favicon.svg           site/feedmybaby/favicon.png               48

echo "All icons generated."
