#!/usr/bin/env python3
"""Feature-moment sheets (calm: each plays only at a meaningful moment).
fx_feat (big win / free-spin intro + outro):
  burst    14f 256x256 @30 once : soft pink bloom, 12 thin rays and a ring open behind a banner title, then fade
  pop       8f 160x160 @30 once : four small star glints when a tier title swaps in
  confetti 12f 320x180 @15 loop : matte paper confetti falling (flat palette colours, no glow), seamless tile
fx_btn (UI):
  press    10f 128x128 @30 once : spin button press: a ring pushes out from the button
  armed    16f 128x128 @15 loop : spin button armed (autoplay / ready): slow soft halo breathe
  tap       8f  96x96  @30 once : small ring for button presses
  lpulse   16f 128x128 @15 loop : loading-screen "start" pulse
Usage: python3 scripts/sprites/gen_fx_feat.py"""
import math, os, random, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from sprlib import rgba, star4, glow, ease_out, ease_io, pack, PINK, PINKL, LAV, MAG, WHITE, PINK2

SS = 2
def cv(w, h): return Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
def fin(im, w, h, g=0.0, col=PINKL, rad=0.08): return glow(im, g, col, rad).resize((w, h), Image.LANCZOS)

def burst(n=14, S=256):
    out = []
    for i in range(n):
        t = i / (n - 1); e = ease_out(t); im = cv(S, S); d = ImageDraw.Draw(im); c = S * SS / 2
        a = (1 - t) ** 1.2
        # bloom (radial disc, faded)
        for k in range(10, 0, -1):
            r = c * (0.15 + 0.35 * e) * k / 10; al = int(26 * a * (1 - k / 11))
            if al > 0: d.ellipse([c - r, c - r, c + r, c + r], fill=rgba(PINKL, al))
        for k in range(12):  # rays
            ang = k * math.pi / 6 + 0.13; r0 = c * (0.18 + 0.25 * e); r1 = c * (0.35 + 0.6 * e); w = SS * (2.2 if k % 2 else 1.4)
            al = int(220 * a * (0.8 if k % 2 else 1))
            if al > 4: d.line([c + r0 * math.cos(ang), c + r0 * math.sin(ang), c + r1 * math.cos(ang), c + r1 * math.sin(ang)], fill=rgba(WHITE, al), width=int(w))
        r = c * (0.25 + 0.7 * e)
        if a > .03: d.ellipse([c - r, c - r, c + r, c + r], outline=rgba(PINKL, int(200 * a)), width=max(1, int(SS * 3 * (1 - t) + 1)))
        out.append(fin(im, S, S, 0.9 * a, MAG))
    return out

def pop(n=8, S=160):
    out = []; pts = [(.25, .35, 1), (.75, .3, .8), (.62, .72, .7), (.3, .7, .6)]
    for i in range(n):
        t = i / (n - 1); im = cv(S, S); d = ImageDraw.Draw(im)
        for j, (x, y, s) in enumerate(pts):
            p = min(1, max(0, (t - j * .08) / .7)); r = math.sin(p * math.pi) * S * SS * .13 * s
            if r > 1: star4(d, x * S * SS, y * S * SS, r, .2, p * .6, rgba(WHITE, 245))
        out.append(fin(im, S, S, 0.8, PINK))
    return out

def confetti(n=12, W=320, H=180, count=34):
    rnd = random.Random(7); cols = [PINK, PINKL, LAV, WHITE, MAG, '#E9DDF7']
    parts = [(rnd.random(), rnd.random(), rnd.choice(cols), rnd.uniform(3, 6), rnd.uniform(1.6, 3), rnd.random() * 6.28, rnd.choice((1, 2)), rnd.uniform(-.04, .04)) for _ in range(count)]
    out = []
    for i in range(n):
        t = i / n; im = cv(W, H); d = ImageDraw.Draw(im)
        for x0, y0, col, w, h, ph, spd, dx in parts:
            y = ((y0 + t * spd) % 1) * H * SS; x = ((x0 + dx * math.sin(2 * math.pi * t * spd + ph)) % 1) * W * SS
            flip = abs(math.cos(2 * math.pi * t * spd * 2 + ph)); ww, hh = SS * w, SS * h * (0.25 + 0.75 * flip)
            ang = ph + 2 * math.pi * t * spd
            pts = [(x + px * math.cos(ang) - py * math.sin(ang), y + px * math.sin(ang) + py * math.cos(ang)) for px, py in ((-ww, -hh), (ww, -hh), (ww, hh), (-ww, hh))]
            for oy in (-H * SS, 0, H * SS):  # wrap so the tile is seamless vertically
                d.polygon([(a, b + oy) for a, b in pts], fill=rgba(col, 235))
        out.append(im.resize((W, H), Image.LANCZOS))
    return out

def ring(n, S, r0, r1, w0, col=PINKL, g=0.9, inner=False):
    out = []
    for i in range(n):
        t = i / (n - 1); e = ease_out(t); im = cv(S, S); d = ImageDraw.Draw(im); c = S * SS / 2
        r = c * (r0 + (r1 - r0) * e); a = (1 - t) ** 1.3
        if a > .02: d.ellipse([c - r, c - r, c + r, c + r], outline=rgba(WHITE, int(240 * a)), width=max(1, int(SS * w0 * (1 - .6 * t))))
        out.append(fin(im, S, S, g * a, col))
    return out

def halo(n, S, r, amp, col=MAG, base=.5):
    out = []
    for i in range(n):
        p = 0.5 - 0.5 * math.cos(2 * math.pi * i / n); im = cv(S, S); d = ImageDraw.Draw(im); c = S * SS / 2
        rr = c * (r + amp * p); al = int(255 * (base + (1 - base) * p))
        d.ellipse([c - rr, c - rr, c + rr, c + rr], outline=rgba(PINKL, al), width=SS * 2)
        out.append(fin(im, S, S, 1.1 * (0.55 + 0.45 * p), col, 0.07))
    return out

if __name__ == '__main__':
    pack('fx_feat', {'burst': (burst(), 30, False), 'pop': (pop(), 30, False), 'confetti': (confetti(), 15, True)}, cols=8, quality=80)
    pack('fx_btn', {'press': (ring(10, 128, .58, .9, 3), 30, False), 'armed': (halo(16, 128, .66, .05), 15, True),
                    'tap': (ring(8, 96, .5, .92, 3, g=.6), 30, False), 'lpulse': (halo(16, 128, .6, .1, PINK, .25), 15, True)}, cols=8, quality=80)
