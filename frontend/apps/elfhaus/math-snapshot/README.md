Snapshot of the Elfhaus math (math 9f9b4e4 game_calculations.py + reel_params.json). Written by scripts/sync-math.mjs; do not edit by hand.
- game_config.json: paytable, lines, max win, spin cap, respins, free-spin counts, guarantees, Epic stack start / step,
  wild grow steps, Mystery odds, retrigger spins, EGW stack value, win-level edges (standard / endFeature), mode costs.
- index.json, stats_summary.json: the publish files' index and the run's stats (RTP, max win, bonus odds).
- Synced 2026-10-30 18:35 CDT from the final rounded run (PC publish_out_500k: base/ante 1M, dare 200k, bonus modes 500k; payouts rounded down to 0.1x, RTP 96.67% every mode) with math 9f9b4e4. That run predates the 1000x edge: its books say winLevel 9 above 1000x; the frontend takes the level from the synced edges (10 = LEGENDARY).
Re-sync: node scripts/sync-math.mjs <math games/elfhaus dir> [publish_files dir] && node scripts/sync-config.mjs
