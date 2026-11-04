# Currency glyphs for the painted bitmap fonts (font_gold / font_cream / font_ink / font_cran).
# The painted sets had only '$', so every other currency symbol was dropped. Each new glyph takes its look from the
# painted 'H' of the same font: its fill gradient row by row, its ink outline and its lower rim, and is sized to the
# painted cap height. Shapes: Lilita One where it has the glyph (€ £ ¥ Ł ł), else DejaVu Sans Bold.
# Idempotent: earlier currency rows are dropped and rebuilt. Run from frontend/apps/elfhaus:
#   python3 scripts/gen-currency-glyphs.py
import json, io
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont

GLYPHS = '€£¥₹₩₺₱₫₽₦₪₡₨₵₸₴฿ŁłČŠ'
LIL = 'static/fonts/LilitaOne.woff2'
lil_ttf = io.BytesIO(); t = TTFont(LIL); t.flavor = None; t.save(lil_ttf)
LCMAP = t.getBestCmap()
DJ = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
DCMAP = TTFont(DJ).getBestCmap()

def shape(ch, cap):
	src = lil_ttf if ord(ch) in LCMAP else DJ
	if not (ord(ch) in LCMAP or ord(ch) in DCMAP): raise SystemExit('no shape for ' + ch)
	if hasattr(src, 'seek'): src.seek(0)
	f = ImageFont.truetype(src, 200)
	capH = f.getbbox('H')[3] - f.getbbox('H')[1]
	f = ImageFont.truetype(src.seek(0) or src if hasattr(src, 'seek') else src, round(200 * cap / capH))
	H = f.getbbox('H'); bb = f.getbbox(ch)
	m = Image.new('L', (bb[2] - bb[0] + 4, max(bb[3], H[3]) - min(bb[1], H[1]) + 4))
	ImageDraw.Draw(m).text((2 - bb[0], 2 - min(bb[1], H[1])), ch, font=f, fill=255)
	return m, H[1] - min(bb[1], H[1])   # mask, y of the cap top in the mask

for name in ['font_gold', 'font_cream', 'font_ink', 'font_cran']:
	d = f'static/assets/sprites/{name}'; J = json.load(open(f'{d}/{name}.json')); A = Image.open(f'{d}/{name}.webp').convert('RGBA')
	base_h = J['meta'].get('currencyBaseH', A.height); A = A.crop((0, 0, A.width, base_h))
	J['frames'] = {k: v for k, v in J['frames'].items() if not v.get('currency')}
	fh = J['frames']['u0048']; a = fh['frame']; Hg = np.array(A.crop((a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']))).astype(float)
	h = Hg.shape[0]; mid = h // 2
	lum = Hg[mid, :, :3].mean(1); al = Hg[mid, :, 3]
	ink = Hg[mid, 0, :3] if al[0] > 200 else Hg[mid, 1, :3]
	# the left stem: from the outline inward to the next outline
	xs = [x for x in range(2, a['w'] // 2) if al[x] > 200]
	inside = [x for x in xs if abs(lum[x] - ink.mean()) > 40]
	sx0, sx1 = (inside[0], inside[-1]) if inside else (3, 8)
	cx = (sx0 + sx1) // 2 if sx1 - sx0 < 20 else sx0 + 4
	grad = Hg[:, cx, :3]                    # fill colour per row (top to bottom, rim included)
	outline = max(2, sx0)                    # ink width
	# cap: rows where the H is opaque in its stem
	rows = [y for y in range(h) if Hg[y, cx, 3] > 200]; capTop = rows[0]; cap = rows[-1] - rows[0] + 1
	rim = grad[rows[-1] - 2]; fillTop, fillBot = rows[0] + outline, rows[-1] - outline - 3
	new = []
	for ch in GLYPHS:
		m, ctop = shape(ch, cap - 2 * outline)
		M = np.array(m).astype(float) / 255
		W, Hh = m.width + 2 * outline + 2, m.height + 2 * outline + 4
		def pad(arr, dy=0):
			o = np.zeros((Hh, W)); o[outline + 1 + dy: outline + 1 + dy + arr.shape[0], outline + 1: outline + 1 + arr.shape[1]] = arr; return o
		face = pad(M); rimm = pad(M, 3)
		def dil(x, r): return np.array(Image.fromarray((x * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * r + 1))).astype(float) / 255
		out_a = dil(np.maximum(face, rimm), outline)
		img = np.zeros((Hh, W, 4))
		img[..., :3] = ink; img[..., 3] = out_a
		# rim (the painted lower edge) under the face
		img[..., :3] = img[..., :3] * (1 - rimm[..., None]) + rim * rimm[..., None]
		# face gradient: map each output row to the H's fill rows by cap position
		y0 = outline + 1 + ctop
		for y in range(Hh):
			t_ = (y - y0) / max(1, cap - 2 * outline); src = int(round(fillTop + np.clip(t_, 0, 1) * (fillBot - fillTop)))
			img[y, :, :3] = img[y, :, :3] * (1 - face[y, :, None]) + grad[src] * face[y, :, None]
		# a thin ink line round the face, as on the painted set
		edge = np.clip(dil(face, 1) - face, 0, 1) * 0.55
		img[..., :3] = img[..., :3] * (1 - edge[..., None]) + ink * edge[..., None]
		new.append((ch, Image.fromarray(np.clip(img, 0, 255).astype(np.uint8) if False else np.dstack([np.clip(img[..., :3], 0, 255), np.clip(img[..., 3] * 255, 0, 255)]).astype(np.uint8)), y0, ctop))
	# pack in new rows under the atlas
	x, y, rowh, place = 4, base_h + 4, 0, []
	for ch, g, y0, _ in new:
		if x + g.width > A.width - 4: x = 4; y += rowh + 4; rowh = 0
		place.append((ch, g, x, y, y0)); x += g.width + 4; rowh = max(rowh, g.height)
	N = Image.new('RGBA', (A.width, y + rowh + 4)); N.paste(A, (0, 0))
	for ch, g, gx, gy, y0 in place:
		N.paste(g, (gx, gy))
		oy = fh['spriteSourceSize']['y'] + capTop - (y0 - outline)  # line the cap top up with the painted H
		J['frames']['u%04X' % ord(ch)] = {'sourceSize': {'w': g.width + 2 * fh['spriteSourceSize']['x'] - 8, 'h': fh['sourceSize']['h']}, 'anchor': {'x': 0, 'y': 0},
			'adv': g.width - 2 * outline + 2, 'frame': {'x': gx, 'y': gy, 'w': g.width, 'h': g.height}, 'rotated': False, 'trimmed': True,
			'spriteSourceSize': {'x': fh['spriteSourceSize']['x'] - 4, 'y': oy, 'w': g.width, 'h': g.height}, 'page': 0, 'currency': True}
	J['meta']['currencyBaseH'] = base_h
	for k in ('size',): J['meta'][k] = {'w': N.width, 'h': N.height}
	J['meta']['pages'][0]['size'] = {'w': N.width, 'h': N.height}
	N.save(f'{d}/{name}.webp', lossless=False, quality=94, method=6); json.dump(J, open(f'{d}/{name}.json', 'w'))
	print(name, N.size, len(place), 'outline', outline, 'cap', cap)
