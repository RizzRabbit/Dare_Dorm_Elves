#!/usr/bin/env python3
"""Wild transform sprite sheet (fx_wild): the moments a wild lands, a stack forms, the full-reel wild expands and
stacks merge. Light/energy layers are procedural (crisp shapes + soft baked pink glow, glow only on the effect);
the full-reel expand bakes the real WF art so the unfurl ends exactly on the static overlay art.
  wland     12f 160x160 @30 once : soft ring + six small sparkles from a landing wild          (over the cell)
  stackform 12f  96x384 @30 once : four row flashes pull into one light column, then fade      (over the reel)
  wfexpand  12f 144x576 @30 once : WF art unfurls from the middle rows with bright edges        (inside the overlay)
  seam      12f  64x384 @30 once : a seam of light closes between two adjacent reels           (at each boundary)
  msweep    10f 128x128 @30 once : soft diagonal light band crossing a merged group (gradient only, stretched)
  wshine    24f 160x160 @30 once : a short bright comet runs once round the round wild frame (periodic shimmer)
  wshineT   24f  96x384 @30 once : the same comet round a full-reel wild's frame
  wflash    10f 160x160 @30 once : the round wild frame flares white-pink on land, then settles to the static frame
Usage: python3 scripts/sprites/gen_fx_wild.py"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from sprlib import ROOT, rgba, star4, glow, ease_out, ease_io, pack, PINK, PINKL, LAV, MAG, WHITE

SS = 2
def cv(w, h): return Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
def fin(im, w, h, g=0.0, col=PINKL, rad=0.08):
    return glow(im, g, col, rad).resize((w, h), Image.LANCZOS)
def fade(im, a):
    if a >= 1: return im
    al = im.getchannel('A').point(lambda v: int(v * max(0, a))); im.putalpha(al); return im

def wland(n=12, S=192):
    out = []
    for i in range(n):
        t = i / (n - 1); e = ease_out(t); im = cv(S, S); d = ImageDraw.Draw(im); c = S * SS / 2
        r = c * (0.42 + 0.5 * e); wdt = max(1, int(SS * 5 * (1 - t) + SS))
        a = int(230 * (1 - t) ** 1.3)
        if a > 4: d.ellipse([c - r, c - r, c + r, c + r], outline=rgba(PINKL, a), width=wdt)
        for k in range(6):
            ang = k * math.pi / 3 + 0.4; rr = c * (0.45 + 0.45 * e); s = SS * 9 * math.sin(min(1, t * 1.25) * math.pi)
            if s > 1: star4(d, c + rr * math.cos(ang), c + rr * math.sin(ang), s, .25, 0, rgba(WHITE, int(255 * (1 - t * .6))))
        out.append(fin(im, S, S, 0.9 * (1 - t), PINK))
    return out

def stackform(n=14, W=128, H=512):
    out = []
    for i in range(n):
        t = i / (n - 1); im = cv(W, H); d = ImageDraw.Draw(im); cx = W * SS / 2
        # 1) row flashes (0..0.45)
        p = min(1, t / 0.45); fa = math.sin(p * math.pi) if t < 0.45 else 0
        for row in range(4):
            cy = (row + 0.5) * H * SS / 4
            if fa > .02: star4(d, cx, cy, W * SS * 0.30 * fa, .2, 0, rgba(WHITE, int(220 * fa)))
        # 2) column (0.25..1)
        q = max(0, (t - 0.25) / 0.75)
        if q > 0:
            ca = math.sin(min(1, q) * math.pi) ** 0.8; half = W * SS * (0.04 + 0.2 * ease_out(min(1, q * 1.4)))
            row = Image.new('L', (W * SS, 1)); rp = row.load()
            for x in range(W * SS): rp[x, 0] = int(min(255, 230 * ca * (math.exp(-((x - cx) / half) ** 2) + 0.8 * math.exp(-((x - cx) / (half * .25)) ** 2))))
            ext = int(H * SS * min(1, q * 2.2) / 2)
            m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rectangle([0, H * SS / 2 - ext, W * SS, H * SS / 2 + ext], fill=255)
            m = m.filter(ImageFilter.GaussianBlur(SS * 10))
            from PIL import ImageChops
            al = ImageChops.multiply(row.resize(im.size), m)
            col = Image.new('RGBA', im.size, rgba('#FFE6F2')); col.putalpha(al)
            im.alpha_composite(col)
        out.append(fin(im, W, H, 0.6 * (1 - t), PINKL, 0.05))
    return out

def wfexpand(n=12, W=160, H=640):
    art = Image.open(os.path.join(ROOT, 'assets/final/wild_WF_fullreel.png')).convert('RGBA').resize((W * SS, H * SS), Image.LANCZOS)
    out = []
    for i in range(n):
        t = i / (n - 1); e = ease_out(t)
        im = cv(W, H)
        half = H * SS / 2 * (0.5 + 0.5 * e)  # starts covering the middle two rows (where the stack lit up)
        top, bot = int(H * SS / 2 - half), int(H * SS / 2 + half)
        band = art.crop((0, top, W * SS, bot))
        wt = 0.55 * (1 - e) ** 1.5  # warm white wash fading out
        if wt > 0.01:
            wash = Image.new('RGBA', band.size, rgba('#FFF0F7', int(255 * wt))); band = band.copy(); band.alpha_composite(wash)
        im.paste(band, (0, top))
        if t < 1:
            d = ImageDraw.Draw(im); la = int(255 * (1 - t) ** .7); lw = SS * 3
            for y in (top, bot - lw):
                d.rectangle([0, y, W * SS, y + lw], fill=rgba(WHITE, la))
            ed = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(ed).rectangle([0, top - SS * 8, W * SS, top + SS * 8], fill=rgba(PINKL, la // 2))
            ImageDraw.Draw(ed).rectangle([0, bot - SS * 8, W * SS, bot + SS * 8], fill=rgba(PINKL, la // 2))
            ed = ed.filter(ImageFilter.GaussianBlur(SS * 6)); ed.alpha_composite(im); im = ed
        out.append(im.resize((W, H), Image.LANCZOS))
    return out

def seam(n=12, W=96, H=512):
    out = []
    for i in range(n):
        t = i / (n - 1); im = cv(W, H); d = ImageDraw.Draw(im); cx = W * SS / 2
        ext = H * SS / 2 * ease_out(min(1, t * 1.8)); a = int(255 * (math.sin(min(1, t * 1.15) * math.pi) ** .7))
        if a > 4:
            d.rectangle([cx - SS * 1.5, H * SS / 2 - ext, cx + SS * 1.5, H * SS / 2 + ext], fill=rgba(WHITE, a))
        for k, y in enumerate((0.2, 0.5, 0.8)):
            p = min(1, max(0, (t - 0.15 - k * 0.12) / 0.5)); s = math.sin(p * math.pi) * W * SS * 0.22
            if s > 1: star4(d, cx, y * H * SS, s, .22, 0, rgba(WHITE, 240))
        out.append(fin(im, W, H, 1.0 * (1 - t * .7), PINK, 0.18))
    return out

def msweep(n=10, S=256):
    out = []
    for i in range(n):
        t = i / (n - 1); im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); px = im.load()
        x0 = -0.5 + 2.0 * ease_io(t); env = math.sin(t * math.pi)
        for y in range(S):
            for x in range(S):
                u = (x + 0.45 * (S - y)) / S - x0 - 0.2  # diagonal coordinate
                v = math.exp(-(u / 0.14) ** 2) * env
                if v > 0.01: px[x, y] = (255, 236, 246, int(110 * v))
        out.append(im)
    return out

def perim(W, H, ins, u):
    """Point at fraction u (0..1) along the rectangle inset by `ins` px, clockwise from top-left."""
    w, h = W - 2 * ins, H - 2 * ins; L = 2 * (w + h); d = (u % 1) * L
    if d < w: return ins + d, ins
    d -= w
    if d < h: return W - ins, ins + d
    d -= h
    if d < w: return W - ins - d, H - ins
    d -= w; return ins, H - ins - d

def circ(W, H, ins, u):
    c = W / 2; r = c - ins; a = -math.pi / 2 + 2 * math.pi * u
    return c + r * math.cos(a), H / 2 + r * math.sin(a)

def shine(n, W, H, ins_frac, round_=False):
    out = []
    for i in range(n):
        t = i / (n - 1); im = cv(W, H); d = ImageDraw.Draw(im)
        env = math.sin(t * math.pi) ** 0.6; ins = ins_frac * W * SS; head = 0.08 + 0.98 * ease_io(t)
        for k in range(72):  # comet: head bright, tail fading over ~18% of the perimeter
            f = k / 71; u = head - f * 0.18
            x, y = (circ if round_ else perim)(W * SS, H * SS, ins, u); r = SS * (3.2 - 2.2 * f)
            a = int(255 * env * (1 - f) ** 1.6)
            if a > 3: d.ellipse([x - r, y - r, x + r, y + r], fill=rgba(WHITE if f < .25 else PINKL, a))
        out.append(fin(im, W, H, 1.2 * env, MAG, 0.05))
    return out

def wflash(n=10, S=192):
    out = []
    for i in range(n):
        t = i / (n - 1); im = cv(S, S); d = ImageDraw.Draw(im); a = (1 - t) ** 1.4
        ins = (0.035 - 0.02 * (1 - t)) * S * SS; wd = int(SS * (2 + 5 * (1 - t)))
        if a > .02:
            d.ellipse([ins, ins, S * SS - ins, S * SS - ins], outline=rgba(WHITE, int(255 * a)), width=wd)  # symbols are round
        out.append(fin(im, S, S, 1.4 * a, MAG, 0.06))
    return out

if __name__ == '__main__':
    # sized for phones (a phone cell is ~70 CSS px): ~1920x2880, one shared sheet
    pack('fx_wild', {'wland': (wland(12, 160), 30, False), 'stackform': (stackform(12, 96, 384), 30, False),  # v3.7: wfexpand row dropped (dead, one old baked elf)
                     'seam': (seam(12, 64, 384), 30, False), 'msweep': (msweep(10, 128), 30, False),
                     'wshine': (shine(24, 160, 160, 0.045, True), 30, False), 'wshineT': (shine(24, 96, 384, 0.045), 30, False), 'wflash': (wflash(10, 160), 30, False)}, cols=12, quality=82)
