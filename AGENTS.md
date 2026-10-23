# AGENTS.md
Coding agents: read **BUILD_PROMPT.md** and **design/SPEC.md** before doing anything.
1. **Locked rules come first:** BUILD_PROMPT.md §8. Never change them without asking the user. If a Stake limit can't be met, stop and report.
2. Mechanics truth: design/SPEC.md (design/DECISIONS.md wins on conflict). Events: design/EVENTS.md. Content: design/CONTENT_RULES.md. Art: assets/ART_BIBLE.md.
3. Every SPEC §12 worked example is a unit test (reference: design/prototypes/worked_examples.py).
4. Work in phases A → D (BUILD_PROMPT.md), commit per phase, and finish with the Definition-of-done table.
5. **Build & test:** run `scripts/ci/math_smoke.sh` and `scripts/ci/frontend_build.sh` before you push. CI (`scripts/ci/github-ci.yml`, active once it is copied to `.github/workflows/ci.yml`) runs the same two scripts. Each one skips until `math/games/elfhaus` or the elfhaus app exists. See BUILD_PROMPT.md §6b. Owners: math is Slot Mechanics Integration Expert, the frontend app is Frontend Slot Dev, and art goes in `assets/final/` (incoming). Run `git pull --rebase` before every push, keep commits small, and never force-push.
