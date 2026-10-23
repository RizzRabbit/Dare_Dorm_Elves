# Dare Dorm – Elves
A 5×4, 20-line, high-volatility **Stake Engine** slot by **Rizzin Games**. Neon college dorm-party theme with sexy (clearly adult, early-20s) college elves, "not strippers". Per-wild multipliers (x1, +1 per connected respin step), full-reel stacks that **add** apart and **multiply** when adjacent, respins everywhere, four bonus tiers (Dare 8 / Double 10 / Triple 12 / Hidden 14 spins, cap 18), Mystery Spin (50/37/10/3), Elves Gone Wild single-spin buy, Ante 1.25x. RTP 96.65–96.69% in all 7 modes, max win 50,000x.

This repo is the **design + asset + build-instructions package**. No game code yet: a local coding agent builds it from here.

## Start here
1. Open this folder with your coding agent (Cursor / Claude Code / Codex).
2. Give it the prompt in **[BUILD_PROMPT.md §1](BUILD_PROMPT.md)** and let it work Phase A → D.
3. Agents auto-load **[AGENTS.md](AGENTS.md)**.

## Repo map
| Path | What |
|---|---|
| `BUILD_PROMPT.md` | **The build prompt**, prerequisites, phases A–D with commands and acceptance numbers, locked rules, definition of done |
| `AGENTS.md` | Short auto-load pointer for coding agents |
| `design/SPEC.md` | **Final mechanics spec** (locked decisions log, rules, modes, limits, worked examples) |
| `design/EVENTS.md` | Book event schema (math ↔ frontend contract) |
| `design/CONTENT_RULES.md` | Stake Engine content rules (quoted) + precedent + art verdicts |
| `design/DECISIONS.md` | The user's original answers (authoritative) |
| `design/COMPLIANCE.md` | Stake Engine compliance review (C1–C35) |
| `design/PHASE1_BRIEF.md` | Original plan/brief (history) |
| `design/source/SPEC_v1_slot_expert.md` | Superseded v1 spec (history) |
| `design/prototypes/reference_rules.py` | Reference implementation of the spin rules |
| `design/prototypes/worked_examples.py` (+ `_output.txt`) | Computes every SPEC §12 example |
| `design/prototypes/toy_sim*.py, tune4.py, egw_check.py …` | Toy Monte Carlo sims (indicative only, not the math model) |
| `assets/ART_BIBLE.md` | Style guide, full asset list, sizes, animation states, image prompts |
| `assets/concepts/*.png` | Concept images (logo, background, single wild, premium elf, superseded full-reel concept used as pose reference) |

## Open items for the user
- All bonus wilds sticky in every tier (A3 reading; SPEC §6).
- Mystery tease default: the 3 reveal wilds sit as a 3-high partial stack on one reel; the build may scatter them if needed and must report it (SPEC §8).
- Wins without a wild keep their cells under R3, so they pay again at each respin step under the every-step pay rule (SPEC §4 note). Confirm this is intended.
