#!/usr/bin/env python3
"""Generate the Source Download extension icons (128/48/32/16 px PNGs).

Author: Turan Burak Yeşilyurt — https://www.linkedin.com/in/turan-burak-yesilyurt/

Pure standard-library implementation (zlib + struct) so it runs anywhere
without dependencies.

Usage: python3 tools/generate_icons.py [output_dir]
"""

import math
import os
import struct
import sys
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")

# 128x128 design-space primitives (matches icons/icon.svg)
BG_TOP = (43, 47, 58)
BG_BOTTOM = (26, 28, 35)
ACCENT_TOP = (110, 168, 255)
ACCENT_BOTTOM = (61, 123, 255)
BAR_COLOR = (74, 79, 97)
OK_GREEN = (52, 211, 153)
OK_RIM = (26, 28, 35)


def mix(c1, c2, t):
    return (round(c1[0] + (c2[0] - c1[0]) * t),
            round(c1[1] + (c2[1] - c1[1]) * t),
            round(c1[2] + (c2[2] - c1[2]) * t))


def in_rounded_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def dist_to_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def sample(x, y):
    """Return (r, g, b, a) for a point in the 128x128 design space."""
    # Background rounded square
    if not in_rounded_rect(x, y, 0.5, 0.5, 127.5, 127.5, 26):
        return (0, 0, 0, 0)

    t = (x / 128.0 + y / 128.0) / 2.0
    bg = mix(BG_TOP, BG_BOTTOM, t)

    # Green status dot (bottom)
    d = math.hypot(x - 64, y - 92)
    if d <= 10:
        return OK_RIM + (255,) if d > 6 else OK_GREEN + (255,)

    # Download arrow (drawn on top of everything)
    if (dist_to_segment(x, y, 64, 34, 64, 68) < 4.5 or
            dist_to_segment(x, y, 51, 55, 64, 68) < 4.5 or
            dist_to_segment(x, y, 77, 55, 64, 68) < 4.5):
        return ACCENT_TOP + (255,)

    # Accent header bar
    if in_rounded_rect(x, y, 20, 26, 108, 44, 5):
        bar_t = (x / 128.0 + y / 128.0) / 2.0
        color = mix(ACCENT_TOP, ACCENT_BOTTOM, bar_t)
        # Small white file icon inside the bar
        if in_rounded_rect(x, y, 26, 31, 40, 39, 2):
            return (220, 231, 255, 217)
        return color + (255,)

    # Grey file rows
    if in_rounded_rect(x, y, 20, 52, 108, 61, 4.5):
        return BAR_COLOR + (255,)
    if in_rounded_rect(x, y, 20, 67, 108, 76, 4.5):
        return BAR_COLOR + (255,)

    return bg + (255,)


def render_128(size):
    """Render at a given output size using 4x supersampling."""
    ss = 4
    pixels = []
    for py in range(size):
        for px in range(size):
            r = g = b = a = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + 0.5) / ss) / size * 128
                    y = (py + (sy + 0.5) / ss) / size * 128
                    cr, cg, cb, ca = sample(x, y)
                    r += cr * ca
                    g += cg * ca
                    b += cb * ca
                    a += ca
            if a > 0:
                r /= a
                g /= a
                b /= a
            a /= ss * ss
            pixels.append((clamp255(r), clamp255(g), clamp255(b), clamp255(a)))
    return pixels


def resize(pixels, sw, sh, w, h):
    """Bilinear downscale of an RGBA pixel list."""
    out = []
    for py in range(h):
        y = (py + 0.5) * sh / h - 0.5
        y0, y1 = max(0, int(math.floor(y))), min(sh - 1, int(math.ceil(y)))
        ty = y - math.floor(y)
        for px in range(w):
            x = (px + 0.5) * sw / w - 0.5
            x0, x1 = max(0, int(math.floor(x))), min(sw - 1, int(math.ceil(x)))
            tx = x - math.floor(x)
            c00 = pixels[y0 * sw + x0]
            c01 = pixels[y0 * sw + x1]
            c10 = pixels[y1 * sw + x0]
            c11 = pixels[y1 * sw + x1]
            r = (c00[0] * (1 - tx) + c01[0] * tx) * (1 - ty) + (c10[0] * (1 - tx) + c11[0] * tx) * ty
            g = (c00[1] * (1 - tx) + c01[1] * tx) * (1 - ty) + (c10[1] * (1 - tx) + c11[1] * tx) * ty
            b = (c00[2] * (1 - tx) + c01[2] * tx) * (1 - ty) + (c10[2] * (1 - tx) + c11[2] * tx) * ty
            a = (c00[3] * (1 - tx) + c01[3] * tx) * (1 - ty) + (c10[3] * (1 - tx) + c11[3] * tx) * ty
            out.append((clamp255(r), clamp255(g), clamp255(b), clamp255(a)))
    return out


def encode_png(size, pixels):
    raw = bytearray()
    for py in range(size):
        raw.append(0)  # filter type 0
        for px in range(size):
            r, g, b, a = pixels[py * size + px]
            raw += bytes((r, g, b, a))
    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) +
            chunk(b"IDAT", compressed) + chunk(b"IEND", b""))


def clamp255(v):
    return 0 if v < 0 else 255 if v > 255 else round(v)


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else OUT_DIR
    os.makedirs(out_dir, exist_ok=True)

    full = render_128(128)
    sizes = {
        128: full,
        48: resize(full, 128, 128, 48, 48),
        32: resize(full, 128, 128, 32, 32),
        16: resize(full, 128, 128, 16, 16),
    }
    for size, pixels in sizes.items():
        path = os.path.join(out_dir, f"icon{size}.png")
        with open(path, "wb") as fh:
            fh.write(encode_png(size, pixels))
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
