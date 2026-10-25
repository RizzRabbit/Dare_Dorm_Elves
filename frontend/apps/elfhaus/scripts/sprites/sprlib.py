"""Shared helpers for the procedural sprite generators: palette, 4-point stars, soft baked glow, atlas packing."""
import json, math, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../..'))
APP = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
FX_OUT = os.path.join(ROOT, 'assets/final/fx')
ATLAS_OUT = os.path.join(APP, 'src/game/fx')
PINK, PINK2, PINKL, LAV, SILVER, PLUM, WHITE, MAG = '#E44792', '#C42A78', '#FFB3D6', '#C9B3EC', '#D9D2EA', '#2A1830', '#FFF4FA', '#F06AAE'

def rgba(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(a))

def star4(d, cx, cy, r, waist=.22, rot=0.0, fill=None, outline=None, ow=0):
    def pts(R):
        return [(cx + (R if i % 2 == 0 else R * waist) * math.cos(rot + i * math.pi / 4),
                 cy + (R if i % 2 == 0 else R * waist) * math.sin(rot + i * math.pi / 4)) for i in range(8)]
    if outline: d.polygon(pts(r + ow), fill=outline)
    d.polygon(pts(r), fill=fill or rgba(WHITE))

def glow(im, strength, col=PINKL, rad=0.1):
    """Soft halo under the opaque parts of `im` (RGBA): blurred alpha tinted `col`."""
    if strength <= 0: return im
    a = im.getchannel('A').filter(ImageFilter.GaussianBlur(max(1, im.width * rad / 2.2)))
    a = a.point(lambda v: min(255, int(v * strength * 1.6)))
    halo = Image.new('RGBA', im.size, rgba(col)); halo.putalpha(a); halo.alpha_composite(im); return halo

def ease_out(t): return 1 - (1 - t) ** 3
def ease_io(t): return t * t * (3 - 2 * t)

def pack(name, anims, cols=8, quality=82, alpha_quality=88, lossless=False):
    """anims: {anim: (frames[list of RGBA], fps, loop)} -> assets/final/fx/<name>.webp + src/game/fx/<name>.atlas.json.
    Frames of one animation share a size; rows wrap every `cols` frames."""
    rows = []
    for an, (frames, fps, loop) in anims.items():
        fw, fh = frames[0].size
        for i in range(0, len(frames), cols): rows.append((an, i, frames[i:i + cols], fw, fh))
    W = max(len(r[2]) * r[3] for r in rows); H = sum(r[4] for r in rows)
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0)); meta = {'image': f'{name}.webp', 'anims': {}}; y = 0
    for an, i0, frs, fw, fh in rows:
        d = meta['anims'].setdefault(an, {'fps': anims[an][1], 'loop': anims[an][2], 'frames': []})
        for j, f in enumerate(frs): sheet.paste(f, (j * fw, y)); d['frames'].append([j * fw, y, fw, fh])
        y += fh
    meta['size'] = [W, H]
    os.makedirs(FX_OUT, exist_ok=True); os.makedirs(ATLAS_OUT, exist_ok=True)
    p = os.path.join(FX_OUT, f'{name}.webp')
    if lossless: sheet.save(p, 'WEBP', lossless=True, method=6)
    else: sheet.save(p, 'WEBP', quality=quality, alpha_quality=alpha_quality, method=6)
    js = json.dumps(meta, separators=(',', ':'))
    open(os.path.join(FX_OUT, f'{name}.json'), 'w').write(js); open(os.path.join(ATLAS_OUT, f'{name}.atlas.json'), 'w').write(js)
    print(f'{name}.webp {sheet.size} {os.path.getsize(p) / 1024:.0f} KB')
    return sheet, meta
