#!/usr/bin/env python
"""
Generate the PWA app icons (backlog R12, step 1 - installable PWA) from existing artwork.

Source: public/piece-sets/animals/kuzlata/light/K.png - the white goat king, one of the
character-library pieces already shipped with the app (own AI-generated artwork, see
LICENSE-ARTWORK.md), transparent 256x256. No new artwork, no third-party asset, nothing
downloaded - this script only resizes/recomposes a file already in the repo, so it is
deterministic and re-runnable (regenerate icons the same way sounds/pieces are
regenerated: `python scripts/make-icons.py`, then commit the changed files under
public/icons/).

Produces, all under public/icons/:
  icon-192.png            192x192, transparent background ("any" purpose)
  icon-512.png            512x512, transparent background ("any" purpose)
  icon-maskable-192.png   192x192, opaque background, artwork kept inside the maskable
  icon-maskable-512.png   512x512  safe zone (Android adaptive-icon masks crop to a circle
                          covering the inner ~80% - see W3C "maskable icon" guidance)
  apple-touch-icon.png    180x180, opaque background, no alpha (iOS ignores transparency
                          and paints it black otherwise; iOS also applies its own corner
                          rounding, so no rounding is baked in here)

Background colour matches the app shell (`--bg`/body background in src/styles/app.css,
and `theme_color`/`background_color` in public/manifest.webmanifest): #2b2b2b.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public/piece-sets/animals/kuzlata/light/K.png"
OUT_DIR = ROOT / "public/icons"

BG = (0x2B, 0x2B, 0x2B, 255)  # matches theme_color / background_color / body background

# "any" purpose icons: transparent background, small padding so the art isn't flush
# against the edge on launchers that don't mask it.
ANY_PADDING = 0.06

# Maskable icons: content must sit inside the safe zone (a centred circle covering 80% of
# the icon's width) or an adaptive-icon mask can crop it. Scaling the art to ~62% of the
# canvas keeps it comfortably inside that circle with margin to spare.
MASKABLE_SCALE = 0.62

# apple-touch-icon: no OS-applied mask, but iOS applies its own rounded-square clip, so a
# similar conservative scale keeps the crown/horns from touching the rounded corners.
APPLE_SCALE = 0.82


def load_source() -> Image.Image:
    img = Image.open(SOURCE)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    return img


def centered(canvas_size: int, art: Image.Image) -> tuple[int, int]:
    return ((canvas_size - art.width) // 2, (canvas_size - art.height) // 2)


def make_any(source: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    art_size = round(size * (1 - 2 * ANY_PADDING))
    art = source.resize((art_size, art_size), Image.LANCZOS)
    canvas.alpha_composite(art, centered(size, art))
    return canvas


def make_maskable(source: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    art_size = round(size * MASKABLE_SCALE)
    art = source.resize((art_size, art_size), Image.LANCZOS)
    canvas.alpha_composite(art, centered(size, art))
    return canvas


def make_apple_touch_icon(source: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BG)
    art_size = round(size * APPLE_SCALE)
    art = source.resize((art_size, art_size), Image.LANCZOS)
    canvas.alpha_composite(art, centered(size, art))
    return canvas.convert("RGB")  # no alpha - iOS paints transparency black otherwise


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing source artwork: {SOURCE}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    source = load_source()

    outputs = {
        "icon-192.png": make_any(source, 192),
        "icon-512.png": make_any(source, 512),
        "icon-maskable-192.png": make_maskable(source, 192),
        "icon-maskable-512.png": make_maskable(source, 512),
        "apple-touch-icon.png": make_apple_touch_icon(source, 180),
    }
    for name, image in outputs.items():
        path = OUT_DIR / name
        image.save(path, optimize=True)
        print(f"make-icons: {name} ({image.width}x{image.height}, {path.stat().st_size} B)")


if __name__ == "__main__":
    main()
