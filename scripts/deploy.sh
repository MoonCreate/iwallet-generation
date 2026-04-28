#!/usr/bin/env bash
# Deploy script run on the production server (84.247.148.107) by GitHub Actions.
# The workflow performs `git fetch && git reset --hard origin/master` before invoking this.
set -euo pipefail

cd /var/www/iwallet-generation

echo "==> HEAD: $(git rev-parse --short HEAD)  ($(git log -1 --pretty=%s))"

echo "==> bun install"
bun install --frozen-lockfile

echo "==> compiling contracts"
(cd packages/contract && npx --yes hardhat compile)

echo "==> building frontend"
(cd packages/frontend && bun run build)

echo "==> restarting services"
systemctl restart iwallet-backend iwallet-frontend

sleep 2
systemctl is-active iwallet-backend iwallet-frontend

echo "==> health check"
curl -fsS --max-time 10 http://127.0.0.1:3003/health
echo
curl -fsS -o /dev/null --max-time 10 -w "frontend SSR: HTTP %{http_code}\n" http://127.0.0.1:3002/

echo "==> deploy complete"
