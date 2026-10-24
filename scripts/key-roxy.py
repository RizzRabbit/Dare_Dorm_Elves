#!/usr/bin/env python3
"""Cut full-body Roxy out of her clips' white studio backdrop -> assets/anim/<clip>_alpha.webm (VP9 + alpha).
pack-atlases.py prefers these keyed clips, so the in-game sprite stands on the room with no white box.
Needs: pip install "rembg[cpu]" (isnet-anime model), ffmpeg with libvpx-vp9."""
import os, subprocess, tempfile
from rembg import new_session, remove
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); CLIPS = f"{R}/assets/anim"; FPS = 12
s = new_session("isnet-anime")
for name in ["roxy_full_idle", "roxy_full_anticipation", "roxy_full_disappointed", "roxy_full_excited"]:
    raw, out = tempfile.mkdtemp(), tempfile.mkdtemp()
    subprocess.run(["ffmpeg", "-v", "error", "-i", f"{CLIPS}/{name}.mp4", "-vf", f"fps={FPS}", f"{raw}/%03d.png"], check=True)
    for f in sorted(os.listdir(raw)):
        im = Image.open(f"{raw}/{f}").convert("RGB"); a = im.convert("RGBA"); a.putalpha(remove(im, session=s, only_mask=True)); a.save(f"{out}/{f}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", f"{out}/%03d.png", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                    "-b:v", "0", "-crf", "18", "-an", f"{CLIPS}/{name}_alpha.webm"], check=True)
    print(name, len(os.listdir(out)), "frames")
