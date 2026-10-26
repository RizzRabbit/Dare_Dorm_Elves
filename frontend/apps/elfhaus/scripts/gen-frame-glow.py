#!/usr/bin/env python3
"""v3.12 board-frame neon halo (James 2026-10-26: "more glow ... on the frame").
Pre-renders a soft pink neon halo around the B2 crown silhouette (crown + pilasters + drapes) per orientation, so the
game only fades one static image on opacity (no per-frame blur/shadow/canvas work). The halo sits BEHIND the crown and
the recess (alcove.ts #alcoveGlow), is cleared inside the board opening (the portrait recess is semi-transparent over
Roxy) and has no round shapes of its own: it follows the frame's outline only.
Output canvas = crown png + PADpx on every side, at SCALE of the crown's px (alcove.ts GLOW mirrors PAD).
  python3 scripts/gen-frame-glow.py      (from frontend/apps/elfhaus)
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parents[4]
DIR = REPO / 'assets/final/webp/frame'
PAD, SCALE = 160, 0.5                      # crown png px of halo room per side; output resolution (soft image, half res is plenty)
BOARD = {'landscape': (147, 222, 1180, 944), 'portrait': (160, 313, 1283, 1026)}  # frames.json board_in_png
CORE, HAZE = (255, 122, 206), (255, 64, 168)   # neon pink: hot core near the edge, deeper magenta haze further out (not the wild gold)

def blur(a, r):
    return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255

for o, (bx, by, bw, bh) in BOARD.items():
    cr = Image.open(DIR / f'b2_crown_{o}.webp').convert('RGBA')
    W, H = cr.size
    w, h = round((W + 2 * PAD) * SCALE), round((H + 2 * PAD) * SCALE)
    a = np.zeros((h, w), np.float32)
    sil = cr.getchannel('A').resize((round(W * SCALE), round(H * SCALE)), Image.LANCZOS)
    p = round(PAD * SCALE)
    a[p:p + sil.height, p:p + sil.width] = (np.asarray(sil, np.float32) / 255 > 0.5)
    # long-tailed neon falloff from three gaussians (sigma in crown px; portrait art is drawn ~2x denser per screen px)
    k = 1.0 if o == 'landscape' else 1.5
    g1, g2, g3 = (blur(a, sg * k * SCALE) for sg in (6, 22, 60))
    near = np.clip(g1 * 2, 0, 1)
    alpha = np.clip(0.55 * near + 0.55 * np.clip(g2 * 2, 0, 1) + 0.45 * np.clip(g3 * 2, 0, 1), 0, 1)
    # clear the board opening: only a soft, dim spill (INNER px, fading over EDGE px) reaches past the crown's lips onto the reels
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    INNER, EDGE = 12, 26
    x0, y0, x1, y1 = [(v + PAD) * SCALE for v in (bx - INNER, by - INNER, bx + bw + INNER, by + bh + INNER)]
    inside = np.clip(np.minimum.reduce([xx - x0, x1 - xx, yy - y0, y1 - yy]) / (EDGE * SCALE), 0, 1)
    alpha *= (1 - inside) ** 2
    t = np.clip(near / np.maximum(alpha, 1e-3), 0, 1)[..., None]
    rgb = np.array(HAZE, np.float32) * (1 - t) + np.array(CORE, np.float32) * t
    out = np.dstack([rgb, alpha[..., None] * 255]).astype(np.uint8)
    dst = DIR / f'b2_glow_{o}.webp'
    Image.fromarray(out, 'RGBA').save(dst, 'WEBP', quality=82, method=6)
    print(dst.relative_to(REPO), (w, h), dst.stat().st_size, 'bytes')
