#!/usr/bin/env python3
"""Single-cell wilds W_R1..W_R5 v4 (v3.10): closer crop, midriff to upper thighs, one shared gold glow.

Owner 2026-10-26: the single wilds blend in with the high symbols, so each reel keeps its elf but the single is a closer
crop of the same approved r8d art (her backside in the thong with the WILD tattoo), cropped at the midriff; all five glow
the same neon gold. Stacked / merged wilds are untouched (they use assets/stacks/*, not these sprites).
Source: the r8d singles rendered at the pipeline's native 2x (512x2048, body + WILD letters), produced by
/workspace/elfhaus-wilds-v4/render2x.py through stacks_v2/build_v2.body()/letters(); their LANCZOS downscale is bit-identical
to the shipped stacks_v2/groups g1..g5 (checked), so this is the same art at twice the resolution, no repaint, no upscale.
Crop: one shared box height for all five (rows Y0..Y0+SIDE at 2x, square), centred on each elf's hips; SIDE -> 384 (x0.74).
Soft fades at the cut top (midriff) and bottom (thighs). Glow: the gen-wild-glow.py / symbols-v3 recipe (crisp line just
outside the outline + white-hot core + r7/r18 bloom, transparent centre) traced on the WHOLE scaled figure and then cropped
with the same box and fades, so it follows only her real silhouette and never draws a line along the crop edges.
Writes assets/final/webp/wild_W_R<n>.webp + wild_W_R<n>_glow.webp. Run from frontend/apps/elfhaus:
  python3 scripts/gen-wild-singles-v4.py [outdir]
"""
import os, sys, numpy as np, cv2
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets/final/webp')
SRC = os.environ.get('WILDS2X_SRC', '/workspace/elfhaus-wilds-v4/src2x')
ELF = ['roxy', 'jade', 'vi', 'coco', 'delilah']
Y0, SIDE = 872, 520        # 2x rows: midriff (just under the tops' hems) .. upper thighs; square crop, ~45 px side room for the glow
HIP_Y = 1100               # 2x row used to centre each elf horizontally (her hips)
S = 384                    # output canvas, same as before (same registration on the board)
FADE_T, FADE_B = 0.07, 0.13
GOLD = np.array([0xFF, 0xC8, 0x3D], np.float32)   # one neon gold for all five, white-hot core in glow()

def disk(r): y, x = np.ogrid[-r:r + 1, -r:r + 1]; return (x * x + y * y <= r * r).astype(np.uint8)
def dil(a, r): return cv2.dilate(a, disk(r)) if r > 0 else a
def glow(alpha, neon, k):   # gen-wild-glow.py recipe; k = px per 512-wide sprite unit (here the 384 canvas -> 0.75)
	R = lambda r: max(1, round(r * k)); h, w = alpha.shape
	A = (alpha > 128).astype(np.uint8)
	l_out = dil(A, R(8)).astype(np.float32); line = cv2.GaussianBlur(np.clip(l_out - A, 0, 1), (0, 0), 0.6 * k)
	core = cv2.GaussianBlur(np.clip(dil(A, R(5)).astype(np.float32) - dil(A, R(1)), 0, 1), (0, 0), 0.7 * k)
	bloom = np.clip(1.1 * cv2.GaussianBlur(l_out, (0, 0), 7 * k) + 0.9 * cv2.GaussianBlur(l_out, (0, 0), 18 * k), 0, 1)
	inside = cv2.GaussianBlur(A.astype(np.float32), (0, 0), 0.6 * k)
	a = np.clip(np.maximum(line, bloom), 0, 1) * (1 - inside)
	col = neon[None, None, :] * np.ones((h, w, 1), np.float32)
	col = col * (1 - 0.65 * core[..., None]) + 255 * 0.65 * core[..., None]
	return np.dstack([col, a * 255])
def fades(h):
	y = np.arange(h) / h
	t = np.clip(y / FADE_T, 0, 1); b = np.clip((1 - y) / FADE_B, 0, 1)
	sm = lambda x: x * x * (3 - 2 * x)
	return (sm(t) * sm(b))[:, None]

f = S / SIDE
for i, e in enumerate(ELF, 1):
	body = Image.open(f'{SRC}/g{i}_{e}_body2x.png').convert('RGBA')
	body.alpha_composite(Image.open(f'{SRC}/g{i}_{e}_letters2x.png').convert('RGBA'))
	A = np.asarray(body)[..., 3]; xs = np.where(A[HIP_Y] > 128)[0]; cx = (xs.min() + xs.max()) / 2
	x0 = int(round(cx - SIDE / 2))
	# pad so the crop box may run past the 512 px source width (transparent)
	P = 64; pad = Image.new('RGBA', (body.width + 2 * P, body.height), (0, 0, 0, 0)); pad.alpha_composite(body, (P, 0))
	big = pad.resize((round(pad.width * f), round(pad.height * f)), Image.LANCZOS)
	bx, by = round((x0 + P) * f), round(Y0 * f)
	spr = np.asarray(big.crop((bx, by, bx + S, by + S))).astype(np.float32)
	g = glow(np.asarray(big)[..., 3], GOLD, S / 512)[by:by + S, bx:bx + S]
	fd = fades(S); spr[..., 3] *= fd; g[..., 3] *= fd
	Image.fromarray(np.clip(spr + .5, 0, 255).astype(np.uint8), 'RGBA').save(f'{OUT}/wild_W_R{i}.webp', 'WEBP', quality=92, alpha_quality=94, method=6)
	Image.fromarray(np.clip(g, 0, 255).astype(np.uint8), 'RGBA').save(f'{OUT}/wild_W_R{i}_glow.webp', 'WEBP', quality=88, alpha_quality=92, method=6)
	print(f'W_R{i}', e, 'crop2x', (x0, Y0, x0 + SIDE, Y0 + SIDE))
