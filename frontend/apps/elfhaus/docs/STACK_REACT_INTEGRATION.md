# stack_react_R1..R5: full-reel elf face reaction (after the vertical merge)

Files: `stack_react_R<n>.webp` + `stack_react_R<n>.atlas.json` (one per elf, WF_R1..WF_R5). Anim name `stack_react`,
12 fps, `loop:false`, `canvas:[192,768]` (same canvas as merge_idle / stack_form). Frames are trimmed face crops
`[x,y,w,h,ox,oy]` drawn 1:1 at (ox,oy) on that canvas, same format sprite.ts already handles. `meta.crop` holds the crop rect.
Base: round r8d (stacks_anim/out merge_idle frame 0, plus the stacks_v2 group source). If the stacks are rebuilt again,
rerun `tool/build_react.py` (about 15 s) so the face pixels keep matching the body.

How it composites: the overlay only covers the eyes, brows, mouth and cheeks (feathered alpha), with colour = body pixels + expression
delta. Frame 0 and the last frame are fully transparent, i.e. identical to merge_idle frame 0, so it starts and ends invisibly.
The body MUST sit still on merge_idle frame 0 while the reaction plays, because merge_idle nudges the head a few px.

## Hook (stacks.ts / mergefx.ts)
1. Add a `react` layer canvas per stack between `body` and `letters` (same size and transform as `body`).
2. Prefetch `stack_react_R<n>` together with `stack_form`.
3. stackOnce('stack_form') onEnd: instead of going straight to `run('merge_idle')`:
   - not turbo and not skipping: draw merge_idle frame 0 on `body` (static), play `stack_react` on `react` with `{rate:1}`
     (it's authored at real 12 fps, so don't apply the ANIM_TEMPO divide) and **no blend** (frames are real in-betweens).
     On end: clear `react`, drop the sheet, `run('merge_idle')`.
   - turbo / skipMerge / tap: skip it, so clear `react` and go straight to `run('merge_idle')`. A tap mid-reaction does the same
     (stop, clear, idle). There's no pop, since the body is already at idle frame 0.
4. letters_ignite and the wild frame draw-in run concurrently (letters sit above `react`, and they don't overlap the face).
5. mergefx stackIn's `Promise.race([stackOnce('stack_form'), sw(700)])` stays as is. The reaction (about 2.6-2.75 s) plays
   after it and doesn't block the win flow. If the stack must be released earlier, the tap/skip path above applies.

Durations: R1 2.75 s, R2 2.67 s, R3 2.75 s, R4 2.75 s, R5 2.58 s.
Memory: about 100 KB of webp total, about 1.1 MB decoded total (all five). Load one per active stack and free it on end.
