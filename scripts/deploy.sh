#!/usr/bin/env bash
# Deploy script run on the production server (84.247.148.107) by GitHub Actions.
# The workflow performs `git fetch && git reset --hard origin/master` before invoking this.
set -euo pipefail

cd /var/www/iwallet-generation

echo "==> HEAD: $(git rev-parse --short HEAD)  ($(git log -1 --pretty=%s))"

echo "==> bun install"
# Production deploys don't need --frozen-lockfile — each run does
# `git reset --hard origin/master`, so any local lockfile mutation is wiped
# next cycle anyway. Frozen-lockfile only adds a way to fail spuriously.
bun install

echo "==> compiling contracts"
# Use `bun x` (built-in subcommand) instead of `bunx` (separate binary)
# because the production server only ships the `bun` binary.
(cd packages/contract && bun x hardhat compile)

echo "==> building frontend"
(cd packages/frontend && bun run build)

# Defense against the silent stale-bundle case: ensure the SSR bundle
# was actually rewritten during this run.
SSR_BUNDLE=packages/frontend/dist/server/server.js
if [ ! -f "$SSR_BUNDLE" ]; then
  echo "ERROR: SSR bundle missing at $SSR_BUNDLE — frontend build did not produce output"
  exit 1
fi
SSR_AGE=$(($(date +%s) - $(stat -c %Y "$SSR_BUNDLE")))
if [ "$SSR_AGE" -gt 600 ]; then
  echo "ERROR: SSR bundle is ${SSR_AGE}s old — frontend build did not run this cycle"
  exit 1
fi

echo "==> restarting services"
systemctl restart iwallet-backend iwallet-frontend

echo "==> health check"
for i in 1 2 3 4 5 6; do
  sleep 3
  if curl -fsS --max-time 5 http://127.0.0.1:3003/health; then
    echo
    break
  fi
  if [ "$i" -eq 6 ]; then
    echo "ERROR: backend health check failed after 18s"
    systemctl status iwallet-backend --no-pager
    exit 1
  fi
  echo "  retrying ($i/6)..."
done

curl -fsS -o /dev/null --max-time 10 -w "frontend SSR: HTTP %{http_code}\n" http://127.0.0.1:3002/

echo "==> deploy complete"
