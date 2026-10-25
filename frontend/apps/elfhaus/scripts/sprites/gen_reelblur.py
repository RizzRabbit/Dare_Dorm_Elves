"""Reel spin top-speed layer: a seamless, vertically motion-blurred strip of the symbol art (one 6-symbol cycle).
reels.ts scrolls it with translateY on a GPU layer and crossfades it in only near full speed (the real symbol
strip scrolls underneath). Two symbol orders so neighbouring reels differ:
  assets/final/fx/reel_stripA.webp, reel_stripB.webp  (W px wide, 6*W tall, alpha)"""
import os
from PIL import Image, ImageFilter
from sprlib import ROOT, pack

F = 192; N = 12
ART = os.path.join(ROOT, 'assets/final/webp')
SYM = {'H1': 'symbol_H1', 'H2': 'symbol_H2', 'H3': 'symbol_H3', 'H4': 'symbol_H4', 'L1': 'symbol_L1_spin_bottle',
       'L2': 'symbol_L2_lips', 'L3': 'symbol_L3_pink_phone', 'L4': 'symbol_L4_red_cup', 'L5': 'symbol_L5_leaf', 'W': 'wild_W_single'}

def tile(n):
    im = Image.open(os.path.join(ART, SYM[n] + '.webp')).convert('RGBA')
    im = im.resize((F, F), Image.LANCZOS)  # same footprint as the cell art (transparent round-frame cut)
    t = Image.new('RGBA', (F, F), (0, 0, 0, 0)); t.alpha_composite(im, ((F - im.width) // 2, (F - im.height) // 2)); return t

def vblur(im, r):
    # box-average vertical shifts = linear motion blur
    acc = None; k = 0
    for dy in range(-r, r + 1, 4):
        s = Image.new('RGBA', im.size); s.paste(im, (0, dy)); k += 1
        acc = s if acc is None else Image.blend(acc, s, 1 / k)
    return acc

def strip(order):
    s = Image.new('RGBA', (F, F * (len(order) + 3)), (0, 0, 0, 0))
    for i, n in enumerate(order[-1:] + order + order[:2]): s.alpha_composite(tile(n), (0, i * F))
    return s

W = 144
def save(name, order):
    s = strip(order); cyc = F * len(order)
    b = vblur(s, 72).crop((0, F, F, F + cyc))  # one seamless cycle
    a = b.getchannel('A').point(lambda v: int(255 * min(1, (v / 255) ** .6 * 1.08))); b.putalpha(a)  # keep the moving strip readable over the translucent board
    b = b.resize((W, W * len(order)), Image.LANCZOS)
    p = os.path.join(ROOT, 'assets/final/fx', name + '.webp'); b.save(p, 'WEBP', quality=72, alpha_quality=72, method=6)
    print(name, b.size, os.path.getsize(p) // 1024, 'KB')

save('reel_stripA', ['H1', 'L3', 'H4', 'L1', 'W', 'L5'])
save('reel_stripB', ['L2', 'H3', 'L4', 'H2', 'L5', 'H1'])
