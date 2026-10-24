#!/usr/bin/env python3
"""Pack Elfhaus art into Pixi JSON-hash atlases. Re-run when art changes:
  python3 scripts/pack-atlases.py   (needs ffmpeg + Pillow; anim clips from ANIM_DIR)"""
import json, os, subprocess, tempfile, glob
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = f"{R}/assets/final"; OUT = f"{R}/frontend/apps/elfhaus/static/assets/atlases"
ANIM = os.environ.get("ANIM_DIR", "/workspace/elfhaus-anim"); CLIPS = f"{R}/assets/anim"
PAGE, PAD, CELL, FPS = 2048, 2, 256, 12
os.makedirs(OUT, exist_ok=True); os.makedirs(CLIPS, exist_ok=True)

def trim(im):
    bb = im.getchannel("A").getbbox() or (0, 0, 1, 1); return im.crop(bb), bb

def fit(im, w, h):
    s = min(w / im.width, h / im.height); return im.resize((round(im.width*s), round(im.height*s)), Image.LANCZOS)

def pack(name, items, do_trim=True, anims=None):
    """items: list of (frameName, RGBA image at final size). Shelf packer, multi-page."""
    pages, cur, x, y, sh = [], [], 0, 0, 0
    prep = []
    for n, im in items:
        full = im.size
        t, bb = trim(im) if do_trim else (im, (0, 0) + im.size)
        prep.append((n, t, bb, full))
    for n, t, bb, full in prep:
        w, h = t.size
        if x + w + PAD > PAGE: x, y, sh = 0, y + sh + PAD, 0
        if y + h + PAD > PAGE: pages.append(cur); cur, x, y, sh = [], 0, 0, 0
        cur.append((n, t, bb, full, x, y)); x += w + PAD; sh = max(sh, h)
    pages.append(cur); res = []
    for i, pg in enumerate(pages):
        fn = name if len(pages) == 1 else f"{name}_{i}"
        W = max(p[4] + p[1].width for p in pg); H = max(p[5] + p[1].height for p in pg)
        sheet = Image.new("RGBA", (W, H)); frames = {}
        for n, t, bb, full, px, py in pg:
            sheet.paste(t, (px, py))
            frames[n] = {"frame": {"x": px, "y": py, "w": t.width, "h": t.height}, "rotated": False,
                         "trimmed": t.size != full, "spriteSourceSize": {"x": bb[0], "y": bb[1], "w": t.width, "h": t.height},
                         "sourceSize": {"w": full[0], "h": full[1]}}
        sheet.save(f"{OUT}/{fn}.webp", "WEBP", quality=88, method=6)
        meta = {"app": "elfhaus pack-atlases.py", "image": f"{fn}.webp", "format": "RGBA8888", "size": {"w": W, "h": H}, "scale": "1"}
        if len(pages) > 1: meta["related_multi_packs"] = [f"{name}_{j}.json" for j in range(len(pages)) if j != i]
        d = {"frames": frames, "meta": meta}
        if anims: d["animations"] = {k: [f for f in v if f in frames] for k, v in anims.items()}
        json.dump(d, open(f"{OUT}/{fn}.json", "w"), indent=1); res.append((fn, W, H))
    return res

def rgba(p): return Image.open(p).convert("RGBA")
def one(pat): return glob.glob(f"{F}/{pat}")[0]
report = []
# symbols
sym = [(f"H{i}", fit(rgba(one(f"symbol_H{i}.png")), CELL, CELL)) for i in range(1, 5)]
sym += [(f"L{i}", fit(rgba(one(f"symbol_L{i}_*.png")), CELL, CELL)) for i in range(1, 6)]
sym += [("W", fit(rgba(one("wild_W_single.png")), CELL, CELL)), ("WF", fit(rgba(one("wild_WF_fullreel.png")), CELL, CELL*4))]
sym += [(f"WM{n}", fit(rgba(one(f"wild_WM{n}_*.png")), CELL*n, CELL*4)) for n in range(2, 6)]
report += pack("symbols", sym)
# ui: any images in assets/final/ui/ (none yet) -> atlas appears automatically
ui = sorted(glob.glob(f"{F}/ui/*.png"))
if ui: report += pack("ui", [(os.path.splitext(os.path.basename(p))[0], rgba(p)) for p in ui])
# backgrounds: separate compressed images
for b in glob.glob(f"{F}/bg_*.png"):
    Image.open(b).convert("RGB").save(f"{OUT}/{os.path.basename(b)[:-4]}.webp", "WEBP", quality=82, method=6)
# animations: (name, frame height) ; frames are not trimmed so the sprite never jitters
for name, h in [("H1_idle", CELL), ("H2_idle", CELL), ("H3_idle", CELL), ("H4_idle", CELL),
                ("roxy_full_idle", 480), ("roxy_full_anticipation", 480), ("roxy_full_disappointed", 480), ("roxy_full_excited", 480)]:
    src = f"{ANIM}/{name}.mp4" if os.path.exists(f"{ANIM}/{name}.mp4") else f"{CLIPS}/{name}.mp4"
    if not os.path.exists(src): print("skip", name); continue
    if src != f"{CLIPS}/{name}.mp4": subprocess.run(["cp", src, f"{CLIPS}/{name}.mp4"])
    td = tempfile.mkdtemp()
    subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"fps={FPS},scale=-2:{h}:flags=lanczos", f"{td}/%03d.png"], check=True)
    fr = sorted(os.listdir(td)); names = [f"{name}_{i:02d}" for i in range(len(fr))]
    report += pack(name, [(n, rgba(f"{td}/{f}")) for n, f in zip(names, fr)], do_trim=False, anims={name: names})
for fn, W, H in report: print(fn, W, H, os.path.getsize(f"{OUT}/{fn}.webp"))
