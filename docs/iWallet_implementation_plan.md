# iWallet — Wallet Infrastructure for AI Agents

## Executive Summary

**iWallet** is a smart-contract wallet that lets a master EOA delegate
**bounded** spending power to AI agents through scoped session keys. Funds
live in the iWallet contract; agents act through it within an on-chain
policy (daily caps, allowlists, cooldowns, expiry, approval rules). The
server side exposes an **MCP-style tool surface** so any agent — Claude
Desktop, Cursor, Claude Code, custom bots — can plug in.

**Positioning:** infrastructure for AI agents, not another consumer AI
wallet. The user is the *master*; the *customer* is anyone running an
agent that needs spend authority.

---

## 1. Architecture

```
                ┌───────────────────────────┐
                │   Master Wallet (EOA)     │
                │  ─ deploys iWallet        │
                │  ─ deposits funds         │
                │  ─ adds/revokes sessions  │
                │  ─ can withdraw anytime   │
                └─────────────┬─────────────┘
                              │
                              ▼
                ┌───────────────────────────┐
                │     iWallet (contract)    │
                │  ─ holds ETH + ERC20s     │
                │  ─ policies[session]      │
                │  ─ execute / executeBatch │
                │  ─ ERC-1271 (master only) │
                │  ─ owner withdraw         │
                │  ─ pauseAll kill switch   │
                └─────────────▲─────────────┘
                              │ session signs tx → calls execute()
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
   Session A             Session B               Session C
   (privkey in MCP)      (privkey in MCP)        (privkey in MCP)
       │                      │                      │
   trading bot          subscriptions          autonomous trader
       │                      │                      │
   bearer token →       bearer token →         bearer token →
   MCP HTTP API         MCP HTTP API           MCP HTTP API
       │                      │                      │
   Claude Desktop       Cron / scripts          Custom agent
```

**Two layers:**

1. **On-chain:** `iWallet.sol` (CREATE2-deployed via `iWalletFactory.sol`) is
   the trust anchor. Funds live here. Per-session policies enforced on every
   call.
2. **Off-chain (server):** an HTTP API (Elysia) exposes MCP-style tools
   (`sendETH`, `sendToken`, `executeRaw`, `executeBatch`, `approveToken`,
   `checkBalance`, `getPolicy`, `getDailySpent`). Each request is bearer-token
   authed; the bearer maps to a session keypair held server-side.

---

## 2. Why a contract, not an EOA + EIP-7702

Contracts have no privkey. There is no "outbound bypass" path. Every
movement of iWallet's funds must go through `execute()` / `executeBatch()`,
which runs `_enforcePerCall` / `_enforceCooldown`.

EIP-7702 was considered and rejected for iWallet itself because any EOA
under 7702 still has a privkey (which someone holds), and that privkey can
sign outbound txs that the chain executes regardless of delegated code.
The only structural fix is: **iWallet must be a contract address**.

7702 may be revisited later as an *ergonomic upgrade* for the master
wallet (batch admin actions in one tx). It is not part of the core trust
boundary.

---

## 3. Trust model & honesty

| Layer | Custody | Notes |
|---|---|---|
| iWallet funds | **Master, non-custodial** | Master can `withdraw` anytime. |
| Master privkey | Master | Compromise = total loss (always was). |
| Session privkey | **Custodial in hosted MCP** / non-custodial in self-hosted | Hosted: encrypted at rest. Loss bounded by session policy. |
| Session bearer token | Custodial | Rotatable, revocable. |

Funds are non-custodial. Session keys are custodial in hosted mode and
non-custodial in self-hosted mode. We say so explicitly. There is no
"hot wallet vs treasury" disclaimer — the wallet *is* the treasury;
agents don't drain it because the contract refuses to.

Worst-case session-key compromise = one session's daily cap. Master can
revoke immediately on chain.

---

## 4. Contracts

```
contracts/
├── iWallet.sol              ← funds + per-session policy + ERC-1271
├── iWalletFactory.sol       ← CREATE2 deployment (deterministic per master)
├── interfaces/IiWallet.sol  ← Policy, Call, events
└── test/TestERC20.sol       ← test fixture
```

### Policy struct

```solidity
struct Policy {
    uint256 dailyETHLimit;        // 0 = ETH not allowed for this session
    address[] allowedTokens;
    uint256[] tokenDailyLimits;   // parallel to allowedTokens
    address[] allowedContracts;   // generic call targets
    address[] allowedSpenders;    // valid `approve` spender targets
    uint256 cooldownSeconds;
    uint256 maxGasPerTx;
    uint256 expiresAt;            // 0 = never
    bool    active;
}
```

### Locked-in design decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Per-session caps + global kill-switch caps** | Granular control + blast-radius limit. |
| D2 | **Per-token caps, no USD oracle in v1** | No oracle dependency, deterministic. |
| D3 | **`allowedSpenders` for approvals + infinite-approve banned + approval counts toward token cap** | Approvals are dangerous; structured policy beats blanket bans. |
| D4 | **UTC daily bucket** (`block.timestamp / 86400`) | Predictable; simple. |
| D5 | **Empty allowlists = nothing allowed** (fail-closed) | The current code now flips the "empty = unlimited" footgun. |
| D6 | **ERC-1271 master-only in v1** | Sessions can't sign Permit2/EIP-712 yet; v2 feature. |

### Enforcement order (per call, in `_enforcePerCall`)

1. `expiresAt` check
2. `maxGasPerTx` check
3. ETH spend (if `value > 0`): per-session daily cap, then global daily cap
4. If calldata starts with an ERC20 selector (`transfer`, `transferFrom`,
   `approve`):
   - Target token must be in `allowedTokens`
   - For `approve`: spender must be in `allowedSpenders`; reject
     `type(uint256).max`; charge against token daily cap
   - For `transfer`: charge amount against token daily cap
   - For `transferFrom` from iWallet itself: charge against token daily cap
5. Else (generic contract call): target must be in `allowedContracts`

Cooldown is enforced once per outermost entrypoint call (not per-batch-call),
via `_enforceCooldown`.

### Owner ops (`onlyOwner`)

- `addSession(address, Policy)`
- `updateSessionPolicy(address, Policy)`
- `revokeSession(address)`
- `setGlobalLimits(uint256, address[], uint256[])`
- `pauseAll()` / `resumeAll()`
- `withdraw(token, amount, to)`
- `executeAsOwner(to, value, data)`

### CREATE2 factory

`iWalletFactory.deploy(master, salt, globalDailyETHLimit, globalTokens, globalLimits)`
deploys an `iWallet` at a deterministic address derived from
`keccak256(abi.encode(master, salt))`. `computeAddress(master, salt)`
returns the predicted address before deployment.

---

## 5. Backend (MCP-style tool surface)

```
packages/backend/
├── src/
│   ├── index.ts                ← Elysia app (port 3001)
│   ├── routes/
│   │   ├── wallet.ts           ← /api/wallet/* tool surface (NEW)
│   │   └── agent.ts            ← /api/agent/* AI demo (uses wallet/tools)
│   ├── wallet/
│   │   └── tools.ts            ← MCP tool implementations (NEW)
│   ├── agent/
│   │   ├── index.ts            ← OpenAI chat loop (demo client)
│   │   └── tools.ts            ← thin shim over wallet/tools
│   └── indexer/index.ts        ← watches iWallet events
```

### Tool surface

```
GET  /api/wallet/tools              → list tool definitions
POST /api/wallet/provision          → derive session keypair + return bearer
DELETE /api/wallet/session          → revoke bearer (client-side)
POST /api/wallet/tool/checkBalance
POST /api/wallet/tool/sendETH
POST /api/wallet/tool/sendToken
POST /api/wallet/tool/approveToken
POST /api/wallet/tool/executeRaw
POST /api/wallet/tool/executeBatch
POST /api/wallet/tool/getPolicy
POST /api/wallet/tool/getDailySpent
```

Authorization: `Authorization: Bearer <token>` on every tool call.

### Provisioning flow

1. Master signs an off-chain message (e.g. `"iWallet session bootstrap"`).
2. Frontend POSTs `{ signature, index, iWalletAddress }` to
   `/api/wallet/provision`.
3. Backend derives session privkey: `keccak256(signature || index)` (32 bytes).
4. Backend stores `(privkey, iWalletAddress)` keyed by a fresh bearer token.
5. Backend returns `{ bearerToken, sessionAddress, iWalletAddress }`.
6. Master submits an on-chain `addSession(sessionAddress, policy)` tx.
7. Master funds `sessionAddress` with a small gas float.
8. Agent uses the bearer token to call MCP tools.

### Hosted vs self-hosted

- **Hosted MCP:** session keys held by us, encrypted at rest. Easier UX.
- **Self-hosted MCP:** ship a Docker image / npm package; user runs locally.
  Same code, key never leaves their box. The deterministic derivation means
  users can move between modes by re-signing the bootstrap message.

---

## 6. Frontend flows (to update)

```
/                       Landing — pitch as "wallet for AI agents"
/dashboard              List iWallets + sessions per master
/wallet/new             Deploy iWallet via factory
/wallet/:addr           Manage one iWallet:
                          ─ add/revoke/edit sessions
                          ─ deposit / withdraw
                          ─ pause / resume
                          ─ event log (from indexer)
/agent (demo)           Chat client wired to a session's bearer token
                          ─ proves the MCP tools actually work
```

The current `/configure`, `/activate` pages collapse into `/wallet/:addr`.

---

## 7. E2E test (passing)

`scripts/e2e.ts` exercises the whole stack on a local Hardhat node:

1. Deploys `iWalletFactory`
2. Deploys an iWallet for the master
3. Funds with 5 ETH and a TestERC20
4. Registers a session on-chain with a constrained policy
5. Funds session EOA with gas
6. Boots the backend (`USE_LOCALHOST=true`)
7. Provisions session via `/api/wallet/provision`
8. Asserts:
   - `checkBalance` (native + token)
   - `getPolicy` returns active session
   - `sendETH` within cap (success)
   - `sendETH` overcap (BLOCKED)
   - `sendETH` to non-allowlisted recipient (BLOCKED)
   - `sendToken` within cap (success)
   - `sendToken` overcap (BLOCKED)
   - `approveToken` to allowed spender (success)
   - `approveToken` infinite (BLOCKED)
   - `approveToken` to non-allowlisted spender (BLOCKED)
   - `getDailySpent` reflects the spend

Run: `bun run scripts/e2e.ts` (requires hardhat node on `:8545`).

Hardhat unit tests: `bun --cwd packages/contract x hardhat test` — 18 passing,
covering owner/session permissioning, daily caps, global caps, allowlists,
approval policy, ban on infinite approve, expiry, cooldown, revoke,
pauseAll, owner withdraw, batch atomicity, ERC-1271, factory determinism.

---

## 8. Roadmap

### v1 (this hackathon / current state)

- Contracts: `iWallet`, `iWalletFactory` (DONE)
- Backend MCP surface (DONE)
- E2E + unit tests (DONE)
- Frontend dashboard rewrite (TODO)
- Self-hosted MCP packaging (TODO)
- Public hosted MCP endpoint (TODO)

### v2

- ERC-1271 with per-session message-type allowlists (Permit2 + Seaport
  + CowSwap signed orders, scoped to allowed spenders + caps)
- USD-denominated caps via Chainlink oracle (display layer first, then
  enforcement)
- Multi-master / org-multisig as iWallet owner
- Gasless session tx via meta-tx relayer (signed userOps, server pays gas
  from iWallet's ETH)
- Subscription-mode policies (monthly resets, per-vendor caps)

### v3

- ERC-4337 variant (compatible with EntryPoint, bundler-friendly)
- 7702 ergonomics for master (batch admin in one signed tx)
- Policy templates marketplace
- Cross-chain iWallet (same address via CREATE2 nonce sync)

---

## 9. Pitch

> "Every AI agent needs a wallet — but giving an agent your master keys
> is suicide. iWallet is a smart-contract wallet that lets you grant a
> scoped session credential to any agent, with on-chain caps the agent
> can't bypass. Plug it into Claude Desktop, Cursor, your own bot, or a
> cron job — the contract enforces the policy, your master wallet keeps
> control, and you can revoke instantly. Wallet infrastructure for AI
> agents."

**Unique value props:**

1. **iWallet is the actor.** It holds funds, makes trades, owns positions —
   one identity that any agent can act through.
2. **Funds non-custodial, sessions revocable.** Master controls; agents are
   bounded by contract logic.
3. **Per-session policy.** Trading bot has trading rules; subscription bot
   has subscription rules; both run from one iWallet.
4. **MCP-shaped tool surface.** Any agent that speaks HTTP can plug in.
   Hosted or self-hosted.
5. **No off-chain trust required for fund safety.** Even if our backend is
   compromised, an attacker is bounded by the on-chain policy.

---

*Architecture aligned with the v1 codebase: contracts compile, 18 unit
tests pass, E2E passes. This document is the source of truth for the
design — when code drifts from here, update one or the other.*
