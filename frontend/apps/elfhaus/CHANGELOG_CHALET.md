# Winter Chalet reskin: changelog (branch `chalet`)

- Art: new cartoon symbol set, bust wilds with baked WILD lettering, five full-body elves sharing one skin tone,
  alpine lodge backgrounds, logo, win titles, buy cards (build_art.py / build_crowd.py -> sync-art.mjs).
- Renames (UI only; internal mode keys unchanged): Dare -> Bunny Slope, Double Dare -> Black Diamond,
  Triple Dare -> Double Black, Epic -> Powder Day, Mystery Spin -> Secret Santa, Elves Gone Wild -> Whiteout,
  Dare Card -> Ski Pass.
- Roxy: cut-out mesh rig with bones (idle breathe / sway, anticipation lean, win hop, big-win cheer, blink / wink);
  real-time dt, no frame sequences.
- Board: per-cell spin on every spin and respin; locked merged wilds stay still; symbols squash on land, pop on win;
  scatter anticipation. Every win: land -> line -> pop + snowflake puff -> respin refills (each stage skippable).
- Stacks: panel plate + one cut-out layer per elf with idle breathe / sway, landing squash, win hop, merge cheer
  (CSS animations on real time). One multiplier per merged stack.
- Win screens: BIG..LEGENDARY banners with elf line-ups, max win with all five elves.
- Intro: chalet front door at night, lantern, snowfall, cream cards with the new names.
- HUD / menus / rules / settings / buy menu rebuilt in the flat cartoon style (no gradients, no emoji icons).
