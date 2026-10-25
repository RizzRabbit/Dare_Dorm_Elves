#!/usr/bin/env python3
"""Procedural UI effect sprite sheets for Elfhaus (crisp flat shapes with a soft baked glow in
pink/lavender during the effect only; the static UI stays matte).
Renders each frame supersampled (SS x) then downsamples for clean anti-aliasing, packs all animations into one
WebP atlas + JSON (frame rects per animation, fps, loop) at assets/final/fx/fx_ui.{webp,json}.
Animations (frame px are 2x the largest on-screen size):
  glint   10f 48x48   4-point star twinkle (grow, slight rotate, shrink)          -> multiplier lettering sparkles
  mxburst 12f 160x160 shard/ray burst + ring behind a multiplier as it grows     -> multiplier increase pop
  lock    12f 48x48   padlock: shackle drops and clamps, body squash, 4 sparks   -> LOCKED tag lock-in (holds last frame)
  lockrim 10f 128x128 border sparkle burst around a cell edge (corner stars)      -> locked cell frame lock-in
  rcfill  10f 32x32   respin circle: empty ring -> pink fill grows -> pop -> settled (reverse = reset)
Usage: python3 scripts/sprites/gen_fx_ui.py   (needs Pillow with WebP)"""
import json, math, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SS = 4
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../..'))
OUT = os.path.join(ROOT, 'assets/final/fx')
PINK, PINK2, PINKL, LAV, SILVER, PLUM, WHITE = '#E44792', '#C42A78', '#FFB3D6', '#C9B3EC', '#D9D2EA', '#2A1830', '#FFF4FA'

def rgba(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

def canvas(w, h): return Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
def down(im, w, h, glow=0.0, col=None, rad=0.12):
    """Downsample; if glow>0 bake a soft halo (blurred alpha, tinted) underneath the crisp shapes."""
    if glow > 0:
        a = im.getchannel('A').filter(ImageFilter.GaussianBlur(im.width * rad / 2.2))
        a = a.point(lambda v: min(255, int(v * glow * 1.6)))
        halo = Image.new('RGBA', im.size, rgba(col or PINKL)); halo.putalpha(a)
        halo.alpha_composite(im); im = halo
    return im.resize((w, h), Image.LANCZOS)

def star4(d, cx, cy, r, waist, rot, fill, outline=None, ow=0):
    pts = []
    for i in range(8):
        a = rot + i * math.pi / 4
        rr = r if i % 2 == 0 else r * waist
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    if outline: d.polygon(pts, fill=outline)  # outline drawn as a slightly larger star underneath
    d.polygon(pts if not outline else shrink(pts, cx, cy, ow), fill=fill)

def shrink(pts, cx, cy, by):
    out = []
    for x, y in pts:
        dx, dy = x - cx, y - cy; L = math.hypot(dx, dy) or 1
        out.append((cx + dx * max(0, L - by) / L, cy + dy * max(0, L - by) / L))
    return out

def ease_out(t): return 1 - (1 - t) ** 3

# ---------------- glint ----------------
def glint(n=10, S=48):
    fr = []
    for i in range(n):
        t = i / (n - 1)
        s = math.sin(t * math.pi)  # 0 -> 1 -> 0
        im = canvas(S, S); d = ImageDraw.Draw(im); c = S * SS / 2
        if s > 0.02:
            r = c * 0.92 * s
            star4(d, c, c, r, 0.2, -math.pi / 2 + t * 0.6, rgba(WHITE), rgba(PLUM, 200), SS * 2.2)
            star4(d, c, c, r * 0.45, 0.32, -math.pi / 4 + t * 0.6, rgba(PINKL))
            d.ellipse([c - r * .1, c - r * .1, c + r * .1, c + r * .1], fill=rgba(WHITE))
        fr.append(down(im, S, S, 0.7 * s, PINKL, 0.16))
    return fr

# ---------------- mxburst ----------------
def mxburst(n=12, S=160):
    fr = []; rays = 10
    for i in range(n):
        t = i / (n - 1); e = ease_out(t)
        im = canvas(S, S); d = ImageDraw.Draw(im); c = S * SS / 2; R = c * 0.96
        a = int(255 * (1 - t) ** 0.7)
        # thin ring
        rr = R * (0.35 + 0.6 * e); w = max(SS, int(SS * 5 * (1 - t)))
        d.ellipse([c - rr, c - rr, c + rr, c + rr], outline=rgba(LAV, a), width=w)
        # shards: kite rays alternating pink / silver
        for k in range(rays):
            ang = k * 2 * math.pi / rays + 0.2
            r0 = R * (0.18 + 0.55 * e); L = R * 0.32 * (1 - t) + SS * 2
            wd = R * 0.06 * (1 - t * 0.6)
            col = PINK if k % 2 == 0 else SILVER
            ca, sa = math.cos(ang), math.sin(ang)
            p0 = (c + r0 * ca, c + r0 * sa); p2 = (c + (r0 + L) * ca, c + (r0 + L) * sa)
            pm = (c + (r0 + L * .45) * ca, c + (r0 + L * .45) * sa)
            d.polygon([p0, (pm[0] - wd * sa, pm[1] + wd * ca), p2, (pm[0] + wd * sa, pm[1] - wd * ca)], fill=rgba(col, a), outline=rgba(PLUM, a))
        # small stars on the ring
        for k in range(4):
            ang = k * math.pi / 2 + math.pi / 4 + t
            sr = R * 0.09 * math.sin(min(1, t * 1.6) * math.pi)
            if sr > 1: star4(d, c + rr * math.cos(ang), c + rr * math.sin(ang), sr, 0.25, 0, rgba(WHITE, a), rgba(PLUM, a), SS * 1.5)
        fr.append(down(im, S, S, 0.75 * (1 - t), '#F06AAE', 0.07))
    return fr

# ---------------- padlock ----------------
def padlock(d, c, s, drop, squash, body=LAV, out=PLUM):
    bw, bh = s * 0.62, s * 0.46 * squash
    by = c + s * 0.5 - bh  # body top so bottom stays planted
    # shackle (U) from body top up, lifted by `drop`
    sw = s * 0.36; th = s * 0.11; top = by - s * 0.36 - drop
    d.rounded_rectangle([c - sw / 2 - th, top, c + sw / 2 + th, by + th * 2 - drop * 0.0], radius=sw / 2 + th, fill=rgba(out))
    d.rounded_rectangle([c - sw / 2 + th * .35, top + th * 1.25, c + sw / 2 - th * .35, by + th * 2], radius=sw / 2, fill=(0, 0, 0, 0))
    inner = Image.new('L', d.im.size, 0)
    d.rounded_rectangle([c - sw / 2, top + th * .6, c + sw / 2, by + th], radius=sw / 2, outline=rgba(SILVER), width=int(th * .7))
    # body
    d.rounded_rectangle([c - bw / 2 - SS * 2, by - SS * 2, c + bw / 2 + SS * 2, by + bh + SS * 2], radius=s * .1, fill=rgba(out))
    d.rounded_rectangle([c - bw / 2, by, c + bw / 2, by + bh], radius=s * .08, fill=rgba(body))
    d.rectangle([c - bw / 2 + SS * 2, by + bh * .55, c + bw / 2 - SS * 2, by + bh - SS * 2], fill=rgba('#A996CF'))
    # keyhole
    kr = s * .055
    d.ellipse([c - kr, by + bh * .3 - kr, c + kr, by + bh * .3 + kr], fill=rgba(out))
    d.polygon([(c - kr * .6, by + bh * .3), (c + kr * .6, by + bh * .3), (c, by + bh * .72)], fill=rgba(out))

def lock(n=12, S=48):
    fr = []
    for i in range(n):
        im = canvas(S, S); d = ImageDraw.Draw(im); c = S * SS / 2; s = S * SS * 0.86
        drop = [s * .22, s * .16, s * .08, 0, 0, 0, 0, 0, 0, 0, 0, 0][i]
        squash = [1, 1, 1, .84, 1.06, .97, 1, 1, 1, 1, 1, 1][i]
        padlock(d, c, s, drop, squash)
        if 3 <= i <= 8:  # 4 little sparks fly out when it clamps
            t = (i - 3) / 5
            for k, ang in enumerate([-2.4, -0.7, 2.6, 0.5]):
                rr = s * (0.3 + 0.28 * t); sr = s * 0.09 * math.sin(t * math.pi)
                if sr > SS: star4(d, c + rr * math.cos(ang), c + s * .12 + rr * math.sin(ang), sr, .25, 0, rgba(WHITE), rgba(PLUM), SS * 1.5)
        fr.append(down(im, S, S, [0,0,0,.5,.7,.6,.45,.3,.15,0,0,0][i], LAV, 0.08))
    return fr

# ---------------- lockrim: sparkle burst on the cell border ----------------
def lockrim(n=10, S=128):
    fr = []
    for i in range(n):
        t = i / (n - 1)
        im = canvas(S, S); d = ImageDraw.Draw(im); W = S * SS; m = W * 0.06
        a = int(255 * (1 - t) ** 0.8)
        # border sweep: a lavender/pink stroke that draws around the frame, then fades
        w = int(SS * 4)
        d.rectangle([m, m, W - m, W - m], outline=rgba(LAV, a), width=w)
        d.rectangle([m + w, m + w, W - m - w, W - m - w], outline=rgba(PINK, int(a * .8)), width=max(1, w // 2))
        for k, (x, y) in enumerate([(m, m), (W - m, m), (W - m, W - m), (m, W - m), (W / 2, m), (W - m, W / 2), (W / 2, W - m), (m, W / 2)]):
            tt = min(1, max(0, t * 1.3 - (k % 4) * 0.06))
            sr = W * (0.09 if k < 4 else 0.055) * math.sin(tt * math.pi)
            if sr > SS: star4(d, x, y, sr, .22, t * .8, rgba(WHITE), rgba(PLUM), SS * 1.6)
        fr.append(down(im, S, S, 0.65 * (1 - t), '#F06AAE', 0.04))
    return fr

# ---------------- respin circle fill ----------------
def rcfill(n=10, S=32):
    fr = []
    for i in range(n):
        t = i / (n - 1)
        im = canvas(S, S); d = ImageDraw.Draw(im); c = S * SS / 2
        pop = [1, 1, 1, 1.04, 1.14, 1.2, 1.1, 1.0, .97, 1][i]
        R = c * 0.78 * pop; ring = R * 0.2
        d.ellipse([c - R - SS * 1.2, c - R - SS * 1.2, c + R + SS * 1.2, c + R + SS * 1.2], fill=rgba('#1A1420'))
        d.ellipse([c - R, c - R, c + R, c + R], fill=rgba(SILVER if i < 4 else '#E8DFF7'))
        ri = R - ring
        d.ellipse([c - ri, c - ri, c + ri, c + ri], fill=rgba('#2A2236'))
        f = ease_out(min(1, t / 0.55)) * ri
        if f > 0:
            d.ellipse([c - f, c - f, c + f, c + f], fill=rgba(PINK))
            if t > .4:  # facet highlight once mostly full
                h = f * .38; hx, hy = c - f * .28, c - f * .3
                d.ellipse([hx - h, hy - h * .8, hx + h, hy + h * .8], fill=rgba(PINKL))
        fr.append(down(im, S, S, [0,0,0,.2,.6,.7,.5,.3,.12,0][i], '#F06AAE', 0.1))
    return fr

ANIMS = {  # name: (frames, fps, loop)
    'glint': (glint(), 24, False), 'mxburst': (mxburst(), 24, False), 'lock': (lock(), 24, False),
    'lockrim': (lockrim(), 24, False), 'rcfill': (rcfill(), 30, False),
}

def pack():
    rows, W = [], 0
    for name, (frames, fps, loop) in ANIMS.items():
        w = sum(f.width for f in frames); W = max(W, w); rows.append((name, frames, fps, loop))
    H = sum(max(f.height for f in r[1]) for r in rows)
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); meta = {'image': 'fx_ui.webp', 'anims': {}}; y = 0
    for name, frames, fps, loop in rows:
        x = 0; rects = []
        for f in frames:
            sheet.paste(f, (x, y)); rects.append([x, y, f.width, f.height]); x += f.width
        meta['anims'][name] = {'fps': fps, 'loop': loop, 'frames': rects}
        y += max(f.height for f in frames)
    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, 'fx_ui.webp'), 'WEBP', quality=90, alpha_quality=90, method=6)
    meta['size'] = [sheet.width, sheet.height]
    json.dump(meta, open(os.path.join(OUT, 'fx_ui.json'), 'w'), separators=(',', ':'))
    app_json = os.path.join(os.path.dirname(__file__), '../../src/game/fx/fx_ui.atlas.json')  # bundled with the code
    os.makedirs(os.path.dirname(app_json), exist_ok=True)
    json.dump(meta, open(app_json, 'w'), separators=(',', ':'))
    print('fx_ui.webp', sheet.size, os.path.getsize(os.path.join(OUT, 'fx_ui.webp')), 'bytes')
    return sheet, rows

if __name__ == '__main__':
    sheet, rows = pack()
    # contact sheet for review (dark + light backdrop), not shipped
    cs = os.environ.get('CONTACT')
    if cs:
        bg = Image.new('RGBA', (sheet.width * 2, sheet.height * 2), rgba('#6E6680'))
        big = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST); bg.alpha_composite(big); bg.save(cs)
