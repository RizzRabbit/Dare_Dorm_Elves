#!/usr/bin/env python3
"""Cut the symbol art out of its square tile: keep each symbol's own round frame, make everything outside it
transparent (the grey corner plates / square frame corners were reading as an opaque white-grey grid on the reels).
Writes assets/final/cut/<name>.png (RGBA, full res, used by the sprite generators) and assets/final/webp/<name>.webp
(the runtime art, first path in art-manifest.json). Radius is the outer edge of each round frame, as a fraction of
the tile size, with a ~1.5px feather at display size so the edge stays crisp.
Usage: python3 scripts/sprites/cut_symbols.py"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from sprlib import ROOT

SYMS = {  # name: (radius fraction, centre y fraction)
    'symbol_H1': (0.458, 0.5), 'symbol_H2': (0.458, 0.5), 'symbol_H3': (0.458, 0.5), 'symbol_H4': (0.458, 0.5), 'wild_W_single': (0.458, 0.5),
    'symbol_L1_spin_bottle': (0.452, 0.5), 'symbol_L2_lips': (0.452, 0.5), 'symbol_L3_pink_phone': (0.452, 0.5),
    'symbol_L4_red_cup': (0.452, 0.5), 'symbol_L5_leaf': (0.452, 0.5),
}
OUT = 512  # runtime webp size (a phone cell is ~210 device px, a desktop cell ~150-300)

def cut(name, rf, cy):
    im = Image.open(os.path.join(ROOT, 'assets/final', name + '.png')).convert('RGBA'); W = im.width
    ss = 4; m = Image.new('L', (W * ss // 4, W * ss // 4), 0) if False else Image.new('L', (W, W), 0)
    r = rf * W; c = W / 2; y = cy * W
    ImageDraw.Draw(m).ellipse([c - r, y - r, c + r, y + r], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(W / 512 * 1.2))
    im.putalpha(m)
    os.makedirs(os.path.join(ROOT, 'assets/final/cut'), exist_ok=True)
    im.resize((min(W, 1024),) * 2, Image.LANCZOS).save(os.path.join(ROOT, 'assets/final/cut', name + '.png'), optimize=True)
    sm = im.resize((OUT, OUT), Image.LANCZOS)
    p = os.path.join(ROOT, 'assets/final/webp', name + '.webp'); sm.save(p, 'WEBP', quality=86, alpha_quality=90, method=6)
    print(name, os.path.getsize(p) // 1024, 'KB')

if __name__ == '__main__':
    for n, (rf, cy) in SYMS.items(): cut(n, rf, cy)
