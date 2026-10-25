"""Reel spin: a looping, vertically motion-blurred strip of the symbol art, one cell window per frame.
sheet reel_blur: spinA / spinB (two symbol orders so neighbouring reels differ), 12 frames each, 30 fps loop."""
import os
from PIL import Image, ImageFilter
from sprlib import ROOT, pack

F = 192; N = 12
ART = os.path.join(ROOT, 'assets/final/webp')
SYM = {'H1': 'symbol_H1', 'H2': 'symbol_H2', 'H3': 'symbol_H3', 'H4': 'symbol_H4', 'L1': 'symbol_L1_spin_bottle',
       'L2': 'symbol_L2_lips', 'L3': 'symbol_L3_pink_phone', 'L4': 'symbol_L4_red_cup', 'L5': 'symbol_L5_leaf', 'W': 'wild_W_single'}

def tile(n):
    im = Image.open(os.path.join(ART, SYM[n] + '.webp')).convert('RGBA')
    im.thumbnail((int(F * .86), int(F * .86)), Image.LANCZOS)
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

def frames(order):
    s = strip(order); cyc = F * len(order); out = []
    # blur the wrapped strip once, then cut windows (seamless: window k at k*cyc/N)
    b = vblur(s, 72)
    for k in range(N):
        y = F + int(k * cyc / N)
        fr = b.crop((0, y, F, y + F)); a = fr.getchannel('A').point(lambda v: int(v * .82)); fr.putalpha(a)
        out.append(fr)
    return out

pack('reel_blur', {'spinA': (frames(['H1', 'L3', 'H4', 'L1', 'W', 'L5']), 30, True),
                   'spinB': (frames(['L2', 'H3', 'L4', 'H2', 'L5', 'H1']), 30, True)}, cols=12, quality=70, alpha_quality=70)
