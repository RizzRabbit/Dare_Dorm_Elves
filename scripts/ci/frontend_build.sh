#!/usr/bin/env bash
# Frontend build check for Elfhaus (Stake web-sdk pnpm/turbo monorepo).
# Looks for the app at frontend/apps/elfhaus (BUILD_PROMPT.md §5) or apps/elfhaus.
# Skips cleanly (exit 0) until the app exists.
# NOTE: adjust once the app lands (owner: Frontend Slot Dev).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
notice() { if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::notice::$*"; else echo "NOTICE: $*"; fi; }

APP=""
for d in "$ROOT/frontend/apps/elfhaus" "$ROOT/apps/elfhaus"; do
  [ -f "$d/package.json" ] && { APP="$d"; break; }
done
if [ -z "$APP" ]; then
  notice "frontend-build skipped: no apps/elfhaus/package.json yet"
  exit 0
fi

# Workspace root = nearest ancestor with pnpm-workspace.yaml / a lockfile, else the app itself.
WS="$APP"
for d in "$(dirname "$(dirname "$APP")")" "$ROOT"; do
  if [ -f "$d/pnpm-workspace.yaml" ] || [ -f "$d/pnpm-lock.yaml" ] || [ -f "$d/package-lock.json" ] || [ -f "$d/yarn.lock" ]; then WS="$d"; break; fi
done
NAME="$(node -p "require('$APP/package.json').name")"
echo "== app: ${APP#$ROOT/} (package '$NAME'), workspace: ${WS#$ROOT/}"
cd "$WS"
if [ -f pnpm-lock.yaml ] || [ -f pnpm-workspace.yaml ]; then
  if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi
  if [ "$WS" = "$APP" ]; then pnpm run build; else pnpm --filter "$NAME" run build; fi
elif [ -f package-lock.json ]; then
  npm ci && (cd "$APP" && npm run build)
elif [ -f yarn.lock ]; then
  yarn install --frozen-lockfile && (cd "$APP" && yarn build)
else
  pnpm install && (cd "$APP" && pnpm run build)
fi
echo "frontend-build OK"
