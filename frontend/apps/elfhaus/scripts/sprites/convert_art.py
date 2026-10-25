#!/usr/bin/env python3
"""Convert the final PNG art to shipping WebP (assets/final/webp/) at 2x the largest on-screen size.
Largest cell is ~195px (1920x1080 desktop), so single symbols ship at 512px, reel art at 384px per reel column.
art-manifest.json lists the WebP path first, so sync-art picks it up; the PNG masters stay as the source.
Usage: python3 scripts/sprites/convert_art.py"""
import os
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../..'))
SRC, OUT = os.path.join(ROOT, 'assets/final'), os.path.join(ROOT, 'assets/final/webp')
JOBS = {  # src -> (max width, max height, quality)
    'symbol_H1.png': (512, 512, 86), 'symbol_H2.png': (512, 512, 86), 'symbol_H3.png': (512, 512, 86), 'symbol_H4.png': (512, 512, 86),
    'symbol_L1_spin_bottle.png': (512, 512, 86), 'symbol_L2_lips.png': (512, 512, 86), 'symbol_L3_pink_phone.png': (512, 512, 86),
    'symbol_L4_red_cup.png': (512, 512, 86), 'symbol_L5_leaf.png': (512, 512, 86), 'wild_W_single.png': (512, 512, 86),
    'wild_WF_fullreel.png': (384, 1536, 86), 'wild_WM2_two_elves.png': (768, 1536, 86), 'wild_WM3_three_elves.png': (1152, 1536, 86),
    'wild_WM4_four_elves.png': (1536, 1536, 86), 'wild_WM5_five_elves.png': (1920, 1536, 86),
    # backgrounds are not converted here: the Lounge webps in assets/final/webp are the masters (no PNG source)
    'logo.png': (1200, 1200, 90), 'logo_full.png': (1600, 1600, 90),
}
def main():
    os.makedirs(OUT, exist_ok=True); before = after = 0
    for f, (mw, mh, q) in JOBS.items():
        im = Image.open(os.path.join(SRC, f)); im.load()
        s = min(1, mw / im.width, mh / im.height)
        if s < 1: im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        o = os.path.join(OUT, f[:-4] + '.webp')
        im.save(o, 'WEBP', quality=q, method=6, **({'alpha_quality': 92} if im.mode == 'RGBA' else {}))
        before += os.path.getsize(os.path.join(SRC, f)); after += os.path.getsize(o)
        print(f'{f:42s} -> {im.size} {os.path.getsize(o) / 1024:7.0f} KB')
    print(f'total {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB')
if __name__ == '__main__': main()
