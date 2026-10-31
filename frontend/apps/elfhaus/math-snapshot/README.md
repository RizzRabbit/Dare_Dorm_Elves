Snapshot of the Elfhaus math (math 8e2a048 game_calculations.py + reel_params.json). Written by scripts/sync-math.mjs; do not edit by hand.
- game_config.json: paytable, lines, max win, spin cap, respins, free-spin counts, guarantees, Epic stack start / step,
  wild grow steps, Mystery odds, retrigger spins, EGW stack value, win-level edges (standard / endFeature), mode costs.
- index.json, stats_summary.json: the publish files' index and the run's stats (RTP, max win, bonus odds).
Re-sync: node scripts/sync-math.mjs <math games/elfhaus dir> [publish_files dir] && node scripts/sync-config.mjs
