#!/usr/bin/env python3
"""Single-cell wilds W_R1..W_R5 from the approved stacks r8d art (v3.7, gate F1).

Neither symbols v3 nor the r8d set has a single-cell wild per elf, so each W_R<n> is a crop of that reel's own r8d single
(stacks_v2/groups/g<n>_reels<n>-<n>_<elf>.png = merge_idle frame 0 of WF_R<n>) with its r8d WILD letters
(stacks_v2/letters/..._letters.png) composited on top, exactly as the stills: head-to-hip, one shared crop box and scale for
all five (same size/registration on the board), soft bottom fade, 24 px headroom so the glow's bloom is not clipped, 384x384 canvas like the old W_R*. No new art, no halo.
Writes assets/final/webp/wild_W_R<n>.webp; then run scripts/gen-wild-glow.py for the matching neon _glow.
Run from frontend/apps/elfhaus:  python3 scripts/gen-wild-singles.py
"""
import os, numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
OUT = os.path.join(ROOT, 'assets/final/webp')
SRC = os.environ.get('STACKS_SRC', '/workspace/elfhaus-frameless/stacks_v2')
ELF = ['roxy', 'jade', 'vi', 'coco', 'delilah']
Y0, Y1 = 116, 650          # source rows (256 x 1024 bodies): top of the tallest hair .. just below the hips
S, TOP = 384, 24           # canvas, top margin (room for the glow's bloom above the hair; the faded bottom meets the edge)
FADE = 0.16                # bottom fraction faded out

for i, e in enumerate(ELF, 1):
	n = f'g{i}_reels{i}-{i}_{e}'
	body = Image.open(os.path.join(SRC, 'groups', n + '.png')).convert('RGBA')
	body.alpha_composite(Image.open(os.path.join(SRC, 'letters', n + '_letters.png')).convert('RGBA'))
	crop = body.crop((0, Y0, body.width, Y1))
	k = (S - TOP) / crop.height
	crop = crop.resize((round(crop.width * k), S - TOP), Image.LANCZOS)
	a = np.asarray(crop).astype(np.float32)
	h = a.shape[0]; t = np.clip((np.arange(h) - h * (1 - FADE)) / (h * FADE), 0, 1)
	a[..., 3] *= (1 - t * t * (3 - 2 * t))[:, None]
	crop = Image.fromarray(np.clip(a + .5, 0, 255).astype(np.uint8), 'RGBA')
	c = Image.new('RGBA', (S, S), (0, 0, 0, 0)); c.alpha_composite(crop, ((S - crop.width) // 2, TOP))
	c.save(os.path.join(OUT, f'wild_W_R{i}.webp'), 'WEBP', quality=90, alpha_quality=92, method=6)
	print(f'W_R{i}', e, c.size, c.getbbox())
