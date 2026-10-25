#!/usr/bin/env python3
"""TEMPORARY win-glow sprites (until symbols-v3 ships the painted ones in /workspace/elfhaus-symbols-v3/out/).

For each symbol key, read the art the manifest resolves to, take its alpha, dilate + blur it into a neon halo that
traces the cutout's own outline (no disc), tint it per symbol, and save <KEY>_glow.webp at the SAME size and
registration as the symbol to assets/final/webp/glow/. The game shows it behind the symbol on .cell.win.
Run from frontend/apps/elfhaus:  python3 scripts/gen-temp-glow.py
"""
import json, os
from PIL import Image, ImageFilter, ImageChops

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
MAN = json.load(open(os.path.join(os.path.dirname(__file__), '../art-manifest.json')))
OUT = os.path.join(ROOT, 'assets/final/webp/glow')
NEON = {  # per-symbol neon (elf hair / prop colour)
	'H1': '#FF5FB4', 'H2': '#2FE6CF', 'H3': '#B07CFF', 'H4': '#FF8A3D',
	'L1': '#FFC44D', 'L2': '#FF4F86', 'L3': '#FF7AD9', 'L4': '#FF5A5A', 'L5': '#7DFF6E',
	'S': '#FFD86B', 'W': '#FF5FB4',
	'W_R1': '#FF5FB4', 'W_R2': '#2FE6CF', 'W_R3': '#B07CFF', 'W_R4': '#FF8A3D', 'W_R5': '#4F8BFF',
}

def src(key):
	for p in MAN.get(key, []):
		f = os.path.join(ROOT, p)
		if os.path.exists(f): return f

def glow(im, hexcol):
	w, h = im.size; k = w / 512
	a = im.getchannel('A').point(lambda v: 255 if v > 96 else 0)
	def dil(r): return a.filter(ImageFilter.MaxFilter(2 * max(1, round(r * k)) + 1))
	halo = dil(7).filter(ImageFilter.GaussianBlur(10 * k)).point(lambda v: int(v * .85))
	core = dil(3).filter(ImageFilter.GaussianBlur(2.5 * k))
	alpha = ImageChops.lighter(halo, core)
	col = Image.new('RGBA', (w, h), hexcol); col.putalpha(alpha)
	# a thin pale hot line right on the outline, so it reads as a neon tube, not a soft smudge
	edge = ImageChops.subtract(dil(2), a).filter(ImageFilter.GaussianBlur(1.2 * k)).point(lambda v: int(v * .7))
	hot = Image.new('RGBA', (w, h), '#FFF2FA'); hot.putalpha(edge)
	col.alpha_composite(hot)
	return col

os.makedirs(OUT, exist_ok=True)
for key, c in NEON.items():
	f = src(key)
	if not f: print('skip', key); continue
	g = glow(Image.open(f).convert('RGBA'), c)
	g.save(os.path.join(OUT, f'{key}_glow.webp'), quality=88, method=6)
	print(key, os.path.relpath(f, ROOT), g.size)
