# Elfhaus Frontend Status

## Overview
The frontend for **Elfhaus** (Rizzin Games) is implemented and verified in `frontend/apps/elfhaus` (Stake web-sdk, Svelte 5 + Vite) on branch `frontend-elfhaus`.

## What is Done
1. **Mechanics & Event Handling**:
   - Complete implementation of all event handlers in `src/game/bookEventHandlerMap.ts` matching `design/EVENTS.md`.
   - Full support for 5×4 20-line board, single-cell respin animation, locking wild rings, wild growth (+1 tick), stack completion (WF), merged wild multi-reel groups (WM2–WM5) with combined multiplier badge (`x6 × x5 = x30`), and win line drawing.
   - Free spin handling for all 4 tiers (Dare, Double Dare, Triple Dare, Hidden), intro cards, retrigger (+2, cap 18), and Dare stack upgrade to Double Dare (`bonusUpgrade`).
   - Mystery Spin tease & reveal sequence, Elves Gone Wild pre-spin stack placement, and Max Win / Wincap (50,000x) celebration.

2. **Rules & Configuration**:
   - Updated free-spin starts to the latest specs: **Dare 8, Double Dare 10, Triple Dare 10, Hidden 10** (+2 per newly completed stack, cap 18).
   - Dynamic mode cost/RTP syncing via `scripts/sync-config.mjs` (reads `math/games/elfhaus/library/publish_files/index.json` and stats when present, falling back to provisional defaults cleanly).
   - Dynamic rules modal with full paytable, line diagrams, mode descriptions, adult characters statement ("All characters are adults."), and official 2026 Engine disclaimer.

3. **Art Integration**:
   - `art-manifest.json` mapped to all 20 final assets in `assets/final/` (H1–H4 premium elves, L1–L5 lows, W single wild, WF full-reel, WM2–WM5 merged scenes, and desktop/mobile/freespins backgrounds) plus concept logo.
   - Clean placeholders with stable keys for remaining assets (frame, buy_icon, intro cards).

4. **UI Styling & Studio Owner Rules**:
   - Palette strictly restricted to greys and purples (`#1A1722`, `#2A2433`, `#4E4660`, `#8A7FA3`, `#B9A2E0`, etc.). No browns, tans, wood or cream.
   - Matte, painted Lilith's Curse style with subtle grain/mottle and zero neon/glossy gradients.
   - Reel grid uses 0px gap with individually respinning cell boxes.
   - Typography uses sharp beveled serif (Cinzel) for titles/wordmark and clean sans (Nunito) for UI numbers.
   - Waylanders Forge minimal dark-glass controls bar with white line icons, round spin button, and balance/play/win strip.
   - Responsive layout supporting Desktop, Mobile Portrait, and 400×225 Popout mode (`body.short`).

5. **Mock RGS & Testing**:
   - `src/mock/mockRgs.ts` with all 16 fixture books (`test-fixtures/books/*.json` copied to `src/mock/books/`).
   - Supports `?mock=true`, `?book=<name>`, and `?replay=true`.
   - Automated test runner `scripts/test-books.mjs` verifying:
     - 16/16 fixture books play end-to-end with the win meter matching `finalWin` / wincap.
     - Event coordinate bounds (reels 0–4, rows 0–3).
     - Social mode word scan clean: 0 violations of restricted words (`bet|buy|pay|pays|paid|wager|cash|money`).

## How to Run
- **Install dependencies** (from repo root or `frontend/`):
  ```bash
  cd frontend && pnpm install
  ```
- **Run test suite**:
  ```bash
  cd frontend/apps/elfhaus && pnpm test
  ```
- **Build production static bundle**:
  ```bash
  cd frontend/apps/elfhaus && pnpm build
  ```
  Produces static assets in `frontend/apps/elfhaus/build/`.
- **Run dev server**:
  ```bash
  cd frontend/apps/elfhaus && pnpm dev
  ```
- **Test specific fixture books in browser**:
  - `http://localhost:3001/?mock=true&book=base_wincap`
  - `http://localhost:3001/?mock=true&book=mystery_double`
  - `http://localhost:3001/?mock=true&book=egw_adjacent`
  - `http://localhost:3001/?mock=true&book=dare_buy`
  - `http://localhost:3001/?mock=true&social=true` (social mode)

## What's Left
- Production art for remaining placeholders (frame border image, round buy icon, and tier intro cards) when delivered.
- Final math publish files (`index.json` + `.jsonl.zst` books) from the math team once retuned. Running `pnpm build` will automatically incorporate the final costs and stats via `scripts/sync-config.mjs`.

## Questions for Owner
- None currently blocking; everything builds and tests clean against the current specification and handoff requirements.
