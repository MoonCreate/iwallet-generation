# iWallet Deployment

Production: **https://wallet.goon4.site**

## Architecture

```
                       [ Internet :443 ]
                              │
              ┌───────────────┴─────────────────┐
              ▼                                 ▼
 [ Nginx — wallet.goon4.site ]      [ Nginx — be-wallet.goon4.site ]
  │ TLS (Let's Encrypt)              │ TLS (Let's Encrypt)
  │                                  │
  │ /assets/*  /favicon.ico          │ proxy_pass → 127.0.0.1:3003
  │   serve static from              │     iwallet-backend.service
  │   packages/frontend/dist/client  │     Bun + Elysia
  │                                  │     endpoints:
  │ /  (everything else) ──►         │       /health
  │   127.0.0.1:3002                 │       /api/agent/* (Elysia prefix)
  │     iwallet-frontend.service     │
  │     Bun + TanStack Start SSR     │
  └──────────────────────────────────┘
```

**URLs:**
- Frontend (browser-facing): `https://wallet.goon4.site`
- Backend (called by frontend, also externally reachable): `https://be-wallet.goon4.site`

**Server:** `root@84.247.148.107` (Ubuntu 24.04) — shared with `love.goon4.site` (pactly)
**Repo on server:** `/var/www/iwallet-generation`

> Port allocation on the host:
> - pactly  : backend `:3001`, frontend `:3000`
> - iwallet : backend `:3003`, frontend `:3002`

## CI/CD

Push to `master` → GitHub Actions SSHes to the server → runs `scripts/deploy.sh`.

- Workflow: `.github/workflows/deploy.yml`
- Deploy script: `scripts/deploy.sh` (runs on the server)
- Triggers on changes to: `packages/**`, `package.json`, `bun.lock`, the deploy script, the workflow itself
- Manual run: GitHub → **Actions → Deploy → Run workflow**, or `gh workflow run Deploy --repo MoonCreate/iwallet-generation --ref master`

GitHub secrets (already configured):

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | `84.247.148.107` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | shared deploy key (same pubkey is in server's `~/.ssh/authorized_keys`) |

The deploy script:
1. `bun install --frozen-lockfile`
2. `cd packages/contract && npx hardhat compile`
3. `cd packages/frontend && bun run build` — emits `dist/server` (SSR handler) and `dist/client` (static assets)
4. `systemctl restart iwallet-backend iwallet-frontend`
5. Hits `/health` and `/` to confirm services came back

### SSH cloning on the server (per-repo deploy keys)

GitHub allows a deploy key on only one repo. The server uses `~/.ssh/config` to map a host alias to the right key:

```
Host github.com           # used for pactly
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes

Host github.com-wallet    # used for iwallet
    HostName github.com
    IdentityFile ~/.ssh/wallet_deploy
    IdentitiesOnly yes
```

The iwallet clone uses `git@github.com-wallet:MoonCreate/iwallet-generation.git`. `git pull` from inside the repo continues to work because the configured remote already uses that alias.

## Updating environment variables

Two `.env` files, both on the server. **Currently filled with dummy values — replace before production use.**

### Backend — runtime, picked up on service restart
**Path:** `/var/www/iwallet-generation/packages/backend/.env`

```bash
ssh root@84.247.148.107
nano /var/www/iwallet-generation/packages/backend/.env
systemctl restart iwallet-backend
journalctl -u iwallet-backend -n 20 --no-pager
```

Keys to set:
- `PORT=3003` — keep (port nginx proxies to)
- `CORS_ORIGIN=https://wallet.goon4.site` — keep
- `NODE_ENV=production` — keep
- `USE_LOCALHOST=false` — keep (use 0G testnet, not local Hardhat node)
- `OPENAI_API_KEY=<real key>` — replace dummy; needed by the AI agent
- `RPC_URL=<custom 0G RPC>` — optional; falls back to chain default

### Frontend — **build-time**, baked into the bundle
**Path:** `/var/www/iwallet-generation/packages/frontend/.env`

Vite inlines `VITE_*` values at build. **A restart is not enough — must rebuild.**

```bash
ssh root@84.247.148.107
nano /var/www/iwallet-generation/packages/frontend/.env
cd /var/www/iwallet-generation/packages/frontend && bun run build
systemctl restart iwallet-frontend
```

Or trigger a workflow re-run:
```bash
gh workflow run Deploy --repo MoonCreate/iwallet-generation --ref master
```

Keys to set:
- `VITE_API_URL=https://be-wallet.goon4.site` — keep (frontend builds its fetch URLs as `${VITE_API_URL}/api/agent/...`, which matches the Elysia route prefix on the backend)
- `VITE_REGISTRY_ADDRESS=<deployed PolicyRegistry proxy>` — replace dummy `0x000…000` with the real testnet/mainnet proxy address
- `VITE_REOWN_PROJECT_ID=<reown id>` — replace dummy if you use a separate Reown project

## Checking logs

```bash
# Live tail
journalctl -u iwallet-backend -f
journalctl -u iwallet-frontend -f

# Recent
journalctl -u iwallet-backend -n 100 --no-pager
journalctl -u iwallet-frontend -n 100 --no-pager

# Errors only since boot, both services
journalctl -u iwallet-backend -u iwallet-frontend -p err -b --no-pager

# Status snapshot
systemctl status iwallet-backend iwallet-frontend --no-pager

# Nginx (shared with all sites on this host)
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Manual deploy / rollback

```bash
ssh root@84.247.148.107
cd /var/www/iwallet-generation
git fetch origin master && git reset --hard origin/master
bash scripts/deploy.sh

# Rollback
git reset --hard <sha>
bash scripts/deploy.sh
```

## Common operations

```bash
systemctl restart iwallet-backend iwallet-frontend  # restart both
nginx -t && systemctl reload nginx                  # apply nginx config changes
certbot renew --dry-run                             # verify cert renewal
```

## Files & locations cheat sheet

| Thing | Path |
|---|---|
| Repo on server | `/var/www/iwallet-generation` |
| Backend env | `/var/www/iwallet-generation/packages/backend/.env` |
| Frontend env | `/var/www/iwallet-generation/packages/frontend/.env` |
| Frontend SSR launcher | `/var/www/iwallet-generation/packages/frontend/serve.ts` |
| Built static assets | `/var/www/iwallet-generation/packages/frontend/dist/client/` |
| systemd units | `/etc/systemd/system/iwallet-{backend,frontend}.service` |
| Nginx site (frontend) | `/etc/nginx/sites-available/wallet.goon4.site` |
| Nginx site (backend) | `/etc/nginx/sites-available/be-wallet.goon4.site` |
| TLS cert (frontend) | `/etc/letsencrypt/live/wallet.goon4.site/` |
| TLS cert (backend) | `/etc/letsencrypt/live/be-wallet.goon4.site/` |
| Server's GitHub deploy key (this repo) | `/root/.ssh/wallet_deploy` |

## Notes

- The `serve.ts` launcher imports the TanStack Start SSR handler from `dist/server/server.js` and runs it via `Bun.serve()` on `127.0.0.1:3002`. Static assets are served by nginx, not the SSR server.
- Backend currently listens on `0.0.0.0:3003` — directly reachable, bypassing nginx/HTTPS/CORS. Bind to `127.0.0.1` in `packages/backend/src/index.ts` or add a ufw rule blocking external access to 3003.
- The iwallet workflow uses `branches: [master]` (this repo's default), unlike pactly which uses `main`.
