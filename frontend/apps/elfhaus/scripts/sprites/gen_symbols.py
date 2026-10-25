#!/usr/bin/env python3
"""Per-symbol sprite sheets rendered from the final symbol art (assets/final/symbol_*.png, wild_W_single.png).
Frames are F x F (2x the largest on-screen cell). One sheet per symbol: assets/final/fx/sym_<S>.webp + atlas JSON.
  land  10f @30fps once : streaks in from above with vertical motion blur (reel-stop frames), squash, overshoot, settle
  win   16f @24fps loop : pulse + shine sweep + soft pink edge glow + sparkles; character symbols (H1-H4) also lean
                          and sway (mesh-warped hair/upper body), low symbols wobble
  idle  24f @24fps loop : wild only - gentle breathe with a slow shine pass and twinkles
Usage: python3 scripts/sprites/gen_symbols.py [SYM ...]"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops
sys.path.insert(0, os.path.dirname(__file__))
from sprlib import ROOT, rgba, star4, glow, ease_out, pack, PINK, PINKL, LAV, MAG, PLUM, WHITE

F = 384
SRC = {'H1': 'symbol_H1.png', 'H2': 'symbol_H2.png', 'H3': 'symbol_H3.png', 'H4': 'symbol_H4.png',
       'L1': 'symbol_L1_spin_bottle.png', 'L2': 'symbol_L2_lips.png', 'L3': 'symbol_L3_pink_phone.png',
       'L4': 'symbol_L4_red_cup.png', 'L5': 'symbol_L5_leaf.png', 'W': 'wild_W_single.png'}

def base(sym):
    im = Image.open(os.path.join(ROOT, 'assets/final', SRC[sym])).convert('RGBA')
    big = im.resize((F * 2, F * 2), Image.LANCZOS)  # working res for warps
    return big

def place(img, sx=1.0, sy=1.0, dy=0.0, rot=0.0, anchor_bottom=True):
    """Scale/rotate/translate the 2F working image into an F x F frame (transparent outside)."""
    W = F * 2; im = img
    if rot: im = im.rotate(rot, resample=Image.BICUBIC, center=(W / 2, W * .9 if anchor_bottom else W / 2))
    nw, nh = max(1, round(F * sx)), max(1, round(F * sy))
    im = im.resize((nw, nh), Image.LANCZOS)
    fr = Image.new('RGBA', (F, F), (0, 0, 0, 0))
    x = (F - nw) // 2; y = (F - nh) if anchor_bottom else (F - nh) // 2
    fr.alpha_composite(im, (x, 0) if False else (0, 0), (0, 0)) if False else None
    fr.paste(im, (x, round(y + dy)), im)
    return fr

def sway(img, amt, phase):
    """Mesh warp: horizontal sine offset growing toward the top (hair / upper body sway)."""
    W = img.width; n = 8; mesh = []
    for gy in range(n):
        for gx in range(n):
            x0, y0, x1, y1 = gx * W // n, gy * W // n, (gx + 1) * W // n, (gy + 1) * W // n
            def off(y): t = max(0, 1 - y / (W * .7)); return amt * W * t * t * math.sin(phase + y / W * 2.2)
            mesh.append(((x0, y0, x1, y1), (x0 - off(y0), y0, x0 - off(y1), y1, x1 - off(y1), y1, x1 - off(y0), y0)))
    return img.transform(img.size, Image.MESH, mesh, Image.BICUBIC)

def vblur(fr, k):
    if k < 2: return fr
    a = fr.filter(ImageFilter.BoxBlur(0))
    # vertical-only box blur: shrink x, blur, restore
    return fr.resize((F, max(1, F // k)), Image.BILINEAR).resize((F, F), Image.BILINEAR)

def land():
    return None

def shine(fr, p, a=0.42):
    """Diagonal light band at position p (0..1) across the frame, clipped to the art."""
    band = Image.new('L', (F * 2, F * 2), 0); d = ImageDraw.Draw(band)
    c = -F * 0.6 + p * F * 3.2; w = F * .22
    d.polygon([(c - w, 0), (c + w, 0), (c + w - F * 2, F * 2), (c - w - F * 2, F * 2)], fill=int(255 * a))
    band = band.filter(ImageFilter.GaussianBlur(F * .05)).resize((F, F), Image.LANCZOS)
    band = ImageChops.multiply(band, fr.getchannel('A'))
    hl = Image.new('RGBA', (F, F), (255, 246, 252, 0)); hl.putalpha(band)
    out = fr.copy(); out.alpha_composite(hl); return out

def edge_glow(fr, s, col=MAG):
    """Soft glow along the inside edge of the cell (win highlight), strength s 0..1."""
    m = Image.new('L', (F, F), 0); d = ImageDraw.Draw(m); w = round(F * .035)
    d.rectangle([w, w, F - 1 - w, F - 1 - w], outline=255, width=w)
    m = m.filter(ImageFilter.GaussianBlur(F * .03)).point(lambda v: min(255, int(v * s * 1.5)))
    g = Image.new('RGBA', (F, F), rgba(col)); g.putalpha(m)
    line = Image.new('L', (F, F), 0); ImageDraw.Draw(line).rectangle([3, 3, F - 4, F - 4], outline=int(235 * s), width=max(2, F // 96))
    l2 = Image.new('RGBA', (F, F), rgba('#FFD6EA')); l2.putalpha(line)
    out = fr.copy(); out.alpha_composite(g); out.alpha_composite(l2); return out

def sparkles(fr, t, pts, scale=1.0):
    S = 4; lay = Image.new('RGBA', (F * S // 2, F * S // 2), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    k = (F * S // 2) / F
    for (x, y, ph) in pts:
        u = (t + ph) % 1.0; s = math.sin(min(1, u / .35) * math.pi) if u < .35 else 0
        if s > .05: star4(d, x * F * k, y * F * k, F * k * .06 * s * scale, .2, u * 2, rgba(WHITE), rgba(PLUM, 200), k * 1.2)
    lay = glow(lay, .8, PINKL, .03).resize((F, F), Image.LANCZOS)
    out = fr.copy(); out.alpha_composite(lay); return out

def gen_land(img):
    fr = []
    # (dy as fraction of F, scaleX, scaleY, blur factor)
    keys = [(-.95, .96, 1.18, 8), (-.62, .97, 1.14, 6), (-.28, .98, 1.08, 4), (0, 1.07, .88, 0), (0, .97, 1.05, 0),
            (0, 1.02, .97, 0), (0, .99, 1.015, 0), (0, 1.005, .995, 0), (0, 1, 1, 0), (0, 1, 1, 0)]
    for dy, sx, sy, bl in keys:
        f = place(img, sx, sy, dy * F)
        if bl: f = f.resize((F, max(1, F // bl)), Image.BILINEAR).resize((F, F), Image.BICUBIC)
        fr.append(f)
    return fr

def gen_win(sym, img):
    fr = []; n = 16; char = sym[0] == 'H' or sym == 'W'
    pts = [(.18, .2, 0), (.82, .3, .35), (.7, .82, .65)]
    for i in range(n):
        t = i / n; ph = t * 2 * math.pi
        pulse = 1 + .045 * (0.5 - 0.5 * math.cos(ph))
        if char:
            src = sway(img, .012, ph); rot = 1.4 * math.sin(ph)
        else:
            src = img; rot = 3.0 * math.sin(ph) * (0.5 - 0.5 * math.cos(ph))
        f = place(src, pulse, pulse, 0, rot, anchor_bottom=char)
        bg = Image.new('RGBA', (F, F), (0, 0, 0, 0)); bg.alpha_composite(place(img, 1, 1)); bg.alpha_composite(f); f = bg  # no empty corners when tilted
        if 1 <= i <= 11: f = shine(f, (i - 1) / 10)
        f = edge_glow(f, .55 + .45 * math.sin(ph) ** 2)
        f = sparkles(f, t, pts)
        fr.append(f)
    return fr

def gen_idle(img):
    fr = []; n = 24
    for i in range(n):
        t = i / n; ph = t * 2 * math.pi
        s = 1 + .025 * (0.5 - 0.5 * math.cos(ph))
        f = place(sway(img, .006, ph), s, s, 0, 0, anchor_bottom=True)
        bg = Image.new('RGBA', (F, F), (0, 0, 0, 0)); bg.alpha_composite(place(img, 1, 1)); bg.alpha_composite(f); f = bg
        if 4 <= i <= 14: f = shine(f, (i - 4) / 10, .3)
        f = sparkles(f, t, [(.2, .25, .1), (.78, .62, .55)], .8)
        fr.append(f)
    return fr

if __name__ == '__main__':
    syms = sys.argv[1:] or list(SRC)
    for s in syms:
        img = base(s)
        anims = {'land': (gen_land(img), 30, False), 'win': (gen_win(s, img), 24, True)}
        if s == 'W': anims['idle'] = (gen_idle(img), 24, True)
        pack(f'sym_{s}', anims, cols=8, quality=80)
