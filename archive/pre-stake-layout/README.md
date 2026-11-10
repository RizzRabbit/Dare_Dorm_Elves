# Pre–Stake-layout archive

Snapshots of the discrete five-kind layout (`phonePort`, `tabletPort`, `square`, `land`, `wide`) that was replaced by Stake web-sdk selection (portrait / tablet / landscape) plus a uniform contain scale and Phaser EXPAND on the spare axis.

**Nothing in this folder may be imported by the game.** It lives at the repo root, outside `frontend/apps/elfhaus/src`. The SvelteKit build does not include it. `scripts/package-release.mjs` fails the zip if any `archive/` path appears in the package.

Pre-change tag: **`pre-stake-layout`** → commit **`e3a3ba5`**.

| Item | What it was | Source commit | Replacement |
|---|---|---|---|
| `layout.ts` | Five design tables (390×844, 768×1024, 1024×768, 1280×800, 1920×1080) with `scale = min(vw/W, vh/H)` and letterbox offsets. Mid-tall phones (aspect ~0.6) used the 390×844 table and were letterboxed, so the board sat in a narrow column and the cover background filled the sides. | `e3a3ba5` | `frontend/apps/elfhaus/src/game/layout.ts` — ratio ≤ 0.8 portrait (1080×1920), 0.8 < ratio < 1.3 tablet (1920×1920, stacked), ratio ≥ 1.3 landscape (1920×1080, short-landscape / mobile when `min(w,h) ≤ 480`). Uniform scale, then the spare axis expands so there is no dead space. Board stays a fixed design size, centered; HUD, menu, Buy Bonus and Roxy anchor to the expanded edges and safe-area insets. |
