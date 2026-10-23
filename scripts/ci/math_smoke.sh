#!/usr/bin/env bash
# Math smoke check for Elfhaus (Stake math-sdk layout).
# Skips cleanly (exit 0) until math/games/elfhaus exists.
# Runs: install deps -> unit tests (if any) -> tiny sim, NO optimizer.
# NOTE: adjust once math/ lands (owner: Slot Mechanics Integration Expert).
# Env overrides: MATH_SMOKE_BASE (default 200), MATH_SMOKE_BONUS (default 20), SKIP_INSTALL=1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MATH="$ROOT/math"
GAME="$MATH/games/elfhaus"
notice() { if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::notice::$*"; else echo "NOTICE: $*"; fi; }

if [ ! -d "$GAME" ]; then
  notice "math-smoke skipped: math/games/elfhaus not present yet"
  exit 0
fi

PY="${PYTHON:-python3}"
cd "$MATH"
if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  # Mirrors math-sdk 'make setup' (minus the venv): requirements + editable install.
  [ -f requirements.txt ] && "$PY" -m pip install -q -r requirements.txt
  { [ -f setup.py ] || [ -f pyproject.toml ]; } && "$PY" -m pip install -q -e .
  "$PY" -m pip install -q pytest
fi

if [ -d "$GAME/tests" ]; then
  echo "== pytest games/elfhaus/tests"
  "$PY" -m pytest games/elfhaus/tests -q
fi

BASE="${MATH_SMOKE_BASE:-200}"; BONUS="${MATH_SMOKE_BONUS:-20}"
if [ -f "$GAME/run_local.py" ]; then
  # run_local.py <base_n> <bonus_n> <sims 0/1> <opt 0/1>  (BUILD_PROMPT.md §3)
  echo "== run_local.py $BASE $BONUS 1 0"
  "$PY" games/elfhaus/run_local.py "$BASE" "$BONUS" 1 0
else
  notice "math-smoke: games/elfhaus/run_local.py not found; sim step skipped (tests only)"
fi
echo "math-smoke OK"
