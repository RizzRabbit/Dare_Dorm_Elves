#!/usr/bin/env python3
"""Static stills of the approved stacks r8d art, one per overlay position (WF_R1..R5, WM2_R1-2 .. WM5_R1-5).

  static/assets/stacks/still/<pos>.webp          merge_idle frame 0 (the body the idle loop starts on)
  static/assets/stacks/still/<pos>_letters.webp  letters_ignite last frame (the held WILD letters)

ui.ts shows them under a full-reel / merged wild overlay until its sheets are decoded (the `.wart` body and the `.mLets`
letters), the bonus-buy cards and the splash use the bodies. Pure crops of the sheets at their canvas size: no new art.
Run after `import-art.mjs stacks`:  python3 scripts/gen-stack-stills.py
"""
import json, os, re
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static', 'assets', 'stacks')
OUT = os.path.join(D, 'still')

def frame(sheet, idx):
    j = json.load(open(os.path.join(D, sheet + '.json')))
    a = j['anims'].get(re.sub(r'_(WF|WM[2-5])_R.*$', '', sheet)) or next(iter(j['anims'].values()))
    f = a['frames'][idx]; x, y, w, h = f[:4]; cw, ch = a.get('canvas', (w, h))
    src = Image.open(os.path.join(D, j.get('image', sheet + '.webp'))).convert('RGBA').crop((x, y, x + w, y + h))
    c = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    if len(f) > 4: c.alpha_composite(src, (f[4], f[5]))  # trimmed frame at its offset (sprite.ts frame())
    else: c = src.resize((cw, ch), Image.LANCZOS)
    return c

os.makedirs(OUT, exist_ok=True)
ix = json.load(open(os.path.join(D, 'index.json')))['sheets']
n = 0
for s in sorted(ix):
    m = re.match(r'^merge_idle_((?:WF|WM[2-5])_R[1-5](?:-[1-5])?)$', s)
    if not m: continue
    pos = m.group(1)
    frame(s, 0).save(os.path.join(OUT, pos + '.webp'), 'WEBP', quality=90, method=6, exact=False)
    if 'letters_ignite_' + pos in ix:
        frame('letters_ignite_' + pos, -1).save(os.path.join(OUT, pos + '_letters.webp'), 'WEBP', quality=90, method=6)
    n += 1
print(f'stills: {n} positions -> {os.path.relpath(OUT)}')
