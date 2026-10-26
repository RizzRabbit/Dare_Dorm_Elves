#!/usr/bin/env python3
"""Neon outline win glow for the wilds (W single + per-reel W_R1..W_R5).

Same recipe as the approved symbols v3 glow (/workspace/elfhaus-symbols-v3/tools/build.py, build()): from the sprite's own
alpha, a crisp neon line just outside the outline with a white-hot core, plus a two-radius soft bloom (r7 + r18), fully
transparent centre. Radii are given at 512 px and scaled to the sprite size (W_R* are 384). No discs, plates or rings.
Writes assets/final/webp/wild_<K>_glow.webp at the same canvas/registration as the wild sprite.
Run from frontend/apps/elfhaus:  python3 scripts/gen-wild-glow.py
"""
import os, numpy as np, cv2
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
W = os.path.join(ROOT, 'assets/final/webp')
# glow colour per wild = the matching elf's symbols-v3 neon (R1 Roxy H1, R2 Jade H2, R3 Vi H3, R4 Coco H4); R5 Delilah
# (no v3 symbol) uses her blue band; the single W uses Roxy/brand pink like its sticker band.
# v3.10: W_R1..W_R5 singles + their gold glows now come from scripts/gen-wild-singles-v4.py (glow traced on the whole figure,
# not on the cropped sprite); this script only regenerates the generic W_single glow.
COL = {'W_single': '#FF4FB0'}
hexc = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
def disk(r): y, x = np.ogrid[-r:r + 1, -r:r + 1]; return (x * x + y * y <= r * r).astype(np.uint8)
def dil(a, r): return cv2.dilate(a, disk(r)) if r > 0 else a

def glow(im, neon):
	h, w = im.shape[:2]; k = w / 512
	R = lambda r: max(1, round(r * k))
	A = (im[..., 3] > 128).astype(np.uint8)
	l_out = dil(A, R(8)).astype(np.float32); line = cv2.GaussianBlur(np.clip(l_out - A, 0, 1), (0, 0), 0.6 * k)
	core = cv2.GaussianBlur(np.clip(dil(A, R(5)).astype(np.float32) - dil(A, R(1)), 0, 1), (0, 0), 0.7 * k)
	bloom = np.clip(1.1 * cv2.GaussianBlur(l_out, (0, 0), 7 * k) + 0.9 * cv2.GaussianBlur(l_out, (0, 0), 18 * k), 0, 1)
	inside = cv2.GaussianBlur(A.astype(np.float32), (0, 0), 0.6 * k)
	alpha = np.clip(np.maximum(line, bloom), 0, 1) * (1 - inside)
	col = neon[None, None, :] * np.ones((h, w, 1), np.float32)
	col = col * (1 - 0.65 * core[..., None]) + 255 * 0.65 * core[..., None]
	return Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8), 'RGBA')

for key, c in COL.items():
	src = os.path.join(W, f'wild_{key}.webp')
	im = np.array(Image.open(src).convert('RGBA'))
	g = glow(im, hexc(c))
	g.save(os.path.join(W, f'wild_{key}_glow.webp'), 'WEBP', quality=88, alpha_quality=92, method=6)
	print(key, g.size, c)
