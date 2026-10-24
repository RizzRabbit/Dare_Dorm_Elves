# Elfhaus atlases (PixiJS JSON-hash, WebP pages ≤2048²)

Regenerate: `python3 scripts/pack-atlases.py` (Pillow + ffmpeg). Source clips live in `assets/anim/*.mp4`.

## Sheets
- `symbols_0..2.json` – frames `H1..H4`, `L1..L5`, `W` (256px cell), `WF` (256×1024), `WM2..WM5` (n×256 wide, 1024 tall). Trimmed, 2px padding, linked via `related_multi_packs`.
- `ui.json` – created automatically once PNGs are dropped in `assets/final/ui/` (frame name = file name).
- `H1_idle..H4_idle.json` – 37 frames @12fps, 256px, `animations.H<n>_idle`, seamless loop.
- `roxy_full_idle_0/1`, `roxy_full_anticipation_0/1` (49 frames, loop), `roxy_full_disappointed_0/1`, `roxy_full_excited_0/1` (37 frames, one-shot). 270×480 frames, 2 pages each; each page's `animations.<name>` lists its own frames – concat page 0 then page 1.
- Backgrounds (not atlased): `bg_base_1920x1080.webp`, `bg_freespins_1920x1080.webp`, `bg_base_mobile_1080x1920.webp`.

## Playing
```ts
import { Assets, AnimatedSprite } from 'pixi.js';
const s = await Assets.load('assets/atlases/H1_idle.json');
const a = new AnimatedSprite(s.animations.H1_idle); a.animationSpeed = 12 / 60; a.loop = true; a.play();

async function anim(name: string) {           // 2-page Roxy sheets
  const p = await Promise.all([0, 1].map(i => Assets.load(`assets/atlases/${name}_${i}.json`)));
  return p.flatMap(sh => sh.animations[name]);
}
```

## Roxy state hooks (all clips start/end on the same neutral pose, so they chain cleanly)
- **idle** (`roxy_full_idle`, loop) – default.
- **anticipation** (`roxy_full_anticipation`, loop) – while a bonus is possible (reel anticipation / slow spin).
- **disappointed** (`roxy_full_disappointed`, once → idle) – Mystery reveal with no tier, or spin ends with no `freeSpinTrigger` after anticipation.
- **excited** (`roxy_full_excited`, once → idle) – on `freeSpinTrigger` or `mysteryResult` with a tier.
Swap with `sprite.textures = frames; sprite.loop = …; sprite.gotoAndPlay(0); sprite.onComplete = () => toIdle();`
