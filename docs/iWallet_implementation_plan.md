# iWallet — AI-Native Smart Wallet with Policy Rules
### Implementation Plan for 0G Blockchain Hackathon

---

## Executive Summary

**iWallet** is a dApp that creates deterministic sub-wallets (derived private keys) intended to be operated by AI agents. Each iWallet is upgraded via EIP-7702 to a smart contract account that enforces **on-chain policy rules** — acting as a guardrail so that even a misbehaving or "dumb" AI agent cannot exceed its boundaries. After wallet creation, users can immediately **test their agent live on the website**, making the demo loop tight and impressive.

**One iWallet = One AI Agent Identity.**

---

## 1. Architecture Overview

```
User EOA (Master Wallet)
    │
    ├─ signMessage(keccak256("iWallet-0")) → derive Private Key #0 → iWallet #0
    ├─ signMessage(keccak256("iWallet-1")) → derive Private Key #1 → iWallet #1
    └─ signMessage(keccak256("iWallet-N")) → derive Private Key #N → iWallet #N
                        │
                        ▼
             EIP-7702 Authorization
             (Upgrade EOA to Smart Account)
                        │
                        ▼
         ┌──────────────────────────────┐
         │     PolicyWallet Contract     │
         │  ─ DailySpendLimit           │
         │  ─ AllowedTokens[]           │
         │  ─ AllowedContracts[]        │
         │  ─ MaxGasPerTx               │
         │  ─ TimeLock / CoolDown       │
         │  ─ fallback() → PolicyCheck  │
         │  ─ receive() → PolicyCheck   │
         └──────────────────────────────┘
                        │
              AI Agent uses iWallet
              to sign & broadcast txs
                        │
              Policy violation? → REVERT
              Policy OK?        → EXECUTE
                        │
              Server indexes events
              → Alert user (Discord / Email / Wangsaff)
```

---

## 2. Technical Analysis: EIP-7702 Fit Assessment

### What EIP-7702 Does
EIP-7702 (introduced in Ethereum Pectra upgrade) allows an EOA to temporarily delegate its execution context to a smart contract address by attaching an **authorization tuple** `(chain_id, contract_address, nonce, signature)` to a transaction. The EOA behaves like a smart contract for the duration without losing its private key.

### ✅ Why EIP-7702 Is a Good Fit for This Project

| Concern | EIP-7702 Behavior | Verdict |
|---|---|---|
| Derived key stays an EOA | Yes, no deployment needed | ✅ |
| Can attach logic (policy) | Yes, via delegation to PolicyWallet | ✅ |
| Revocable by user | Yes, re-sign with `address(0)` | ✅ |
| Works on 0G (EVM-compatible) | Yes, if 0G supports Pectra opcodes | ⚠️ Verify |
| AI agent signs normally | Yes, private key unchanged | ✅ |
| Policy enforced on-chain | Yes, in contract's fallback/execute | ✅ |

### ⚠️ One Caveat: 0G EVM Compatibility
0G is EVM-compatible but may not have EIP-7702 support yet (it's a Pectra/post-Cancun feature). **Fallback plan below.**

---

## 3. Alternative / Hybrid Approach (Recommended)

If EIP-7702 is not yet live on 0G, use a **hybrid architecture** that is equally powerful and more compatible:

### Option A: EIP-7702 (Preferred if supported)
Use as described above. iWallet EOA is upgraded per-transaction.

### Option B: PolicyProxy Contract (Fallback — fully compatible today)
Deploy a lightweight `PolicyProxy` contract owned by the user. The iWallet (derived EOA) is authorized as a **signer**, but all transactions are **routed through the proxy**, which enforces policy before forwarding.

```
iWallet (EOA) → signs UserOp/calldata
        ↓
PolicyProxy.execute(calldata, signature)
        ↓
  check: DailyLimit? AllowedTarget? TimeWindow?
        ↓
  PASS → forward call
  FAIL → revert with reason
```

### Option C: ERC-4337 Account Abstraction (Most flexible, most complex)
Use a Bundler + EntryPoint + PolicyAccount. Adds `validateUserOp()` hook where all policy rules live. Downside: requires Bundler infrastructure on 0G.

### 🏆 Recommendation: Option A (EIP-7702) with Option B as automatic fallback
- Detect at runtime whether 0G supports EIP-7702.
- If yes → use EIP-7702 delegation.
- If no → automatically deploy a lightweight `PolicyProxy` and route through it.
- Same UX for the user either way.

---

## 4. Policy Rules Design

```solidity
struct Policy {
    uint256 dailySpendLimitETH;     // max ETH spend per 24h
    uint256 dailySpendLimitUSD;     // soft limit in USD equiv (oracle)
    address[] allowedTokens;        // whitelist of ERC20 tokens
    address[] allowedContracts;     // whitelist of contract targets
    uint256 maxGasPerTx;            // prevent gas griefing
    uint256 cooldownSeconds;        // min time between txs
    uint256 expiresAt;              // sunset the agent after N seconds
    bool    requireUserApproval;    // any tx above threshold needs human sig
}
```

**Policy enforcement flow:**
1. AI agent submits transaction.
2. `fallback()` or `execute()` intercepts.
3. Check `dailySpend[today] + value <= dailySpendLimitETH`.
4. Check `to` is in `allowedContracts`.
5. Check `block.timestamp - lastTx >= cooldownSeconds`.
6. Check `tx.gasprice * gaslimit <= maxGasPerTx`.
7. All pass → forward the call.
8. Any fail → `revert("PolicyViolation: <reason>")`.
9. Server indexes `DailyLimitHit` event → sends alert to user.

---

## 5. iWallet Key Derivation

```javascript
// Frontend (ethers.js / viem)
async function deriveiWallet(masterWallet, index) {
  const message = `iWallet-${index}`;
  const msgHash = ethers.utils.id(message); // keccak256
  const signature = await masterWallet.signMessage(ethers.utils.arrayify(msgHash));

  // Use first 32 bytes of signature as deterministic private key
  const iWalletPrivateKey = signature.slice(0, 66); // "0x" + 64 hex chars
  const iWallet = new ethers.Wallet(iWalletPrivateKey);
  return iWallet;
}
```

**Security note:** The derived key is as secure as the master wallet's signing security. The user must keep the master wallet safe — losing it means losing access to all iWallets. Add optional BIP-39 passphrase layer for extra entropy.

---

## 6. Smart Contract Architecture

### Contracts to Build

```
contracts/
├── PolicyWallet.sol          # Core: EIP-7702 delegation target
│   ├── execute()             # main entrypoint for AI agent calls
│   ├── fallback()            # catch-all with policy check
│   ├── receive()             # ETH receive with daily limit check
│   ├── updatePolicy()        # owner-only policy update
│   └── revokeAgent()         # emergency kill switch
│
├── PolicyProxy.sol           # Fallback if EIP-7702 not available
│   ├── execute(calldata, sig) # verify sig from iWallet EOA, then policy check
│   └── same policy logic
│
├── PolicyRegistry.sol        # Optional: on-chain policy storage
│   └── policies[wallet]      # lookup policy by iWallet address
│
└── interfaces/
    ├── IPolicy.sol
    └── IPolicyWallet.sol
```

---

## 7. Frontend dApp Architecture

### Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Wallet:** wagmi + viem + RainbowKit
- **UI:** Tailwind CSS + shadcn/ui
- **AI Agent Simulation:** Vercel AI SDK + Claude API (Anthropic)
- **Blockchain:** 0G testnet (EVM RPC)
- **Indexer:** Custom server (Express + ethers.js event listener) or The Graph

### Pages / Features

```
/
├── /                        # Landing page — explain iWallet concept
├── /create                  # Step 1: Connect wallet, derive iWallet
├── /configure               # Step 2: Set policy rules (form UI)
├── /activate                # Step 3: EIP-7702 authorization / proxy deploy
├── /dashboard               # View all iWallets, balances, policy status
├── /agent                   # 🌟 DEMO: Live AI agent simulation
│   ├── Chat interface
│   ├── Agent tries to make on-chain moves
│   ├── Policy intercepts shown in real-time
│   └── Transaction log / event stream
└── /alerts                  # Alert history from server indexer
```

### Key UX Flow (Happy Path)
1. User connects MetaMask / wallet.
2. Clicks "Create iWallet #0" → signs deterministic message → iWallet address shown.
3. User sets policy: daily limit 0.01 ETH, allowed contracts = [DEX address].
4. Activates EIP-7702 (or deploys proxy).
5. Funds iWallet with small amount.
6. Goes to `/agent` page → AI agent chat opens.
7. User tells agent: "Swap 0.005 ETH for USDC on [DEX]."
8. Agent constructs tx, signs with iWallet key (handled backend), broadcasts.
9. Policy: 0.005 ETH ≤ 0.01 ETH daily limit ✅ → tx succeeds, shown in UI.
10. User says: "Now swap 0.008 ETH more."
11. Total would be 0.013 ETH > 0.01 ETH limit → PolicyViolation → tx reverts.
12. UI shows red alert: "Agent blocked: DailyLimitHit."

---

## 8. AI Agent Simulation (Demo Layer)

The `/agent` page is the showstopper demo feature.

### How It Works
- Backend spins an AI agent using **Claude API** (or OpenAI).
- Agent is given tools: `sendETH`, `callContract`, `checkBalance`, `swapTokens`.
- Each tool routes through the iWallet backend signer.
- The iWallet backend holds the derived private key **server-side in session** (never persisted).
- Policy rules are checked both **off-chain** (preview, show user) and **on-chain** (enforce).
- Results stream back to frontend in real-time via Server-Sent Events.

### Agent Tool Schema (simplified)
```json
{
  "name": "sendETH",
  "description": "Send ETH to an address",
  "parameters": {
    "to": "address",
    "amount": "string (ETH)"
  }
}
```

### Security for Demo
- iWallet private key lives in memory only per session.
- Max demo balance cap: 0.05 ETH hardcoded.
- Policy rules enforced on-chain regardless.
- User can revoke agent at any time.

---

## 9. Business Model

### Primary: B2C — AI Agent Infrastructure for Power Users
Target: crypto-native users who run AI trading bots, DeFi automation agents, or agentic workflows.

**Monetization options:**

| Model | Description | Pros | Cons |
|---|---|---|---|
| **Freemium SaaS** | Free: 1 iWallet, basic policy. Pro $9/mo: unlimited wallets, advanced rules, webhook alerts | Recurring revenue, low barrier | Needs user retention |
| **Transaction Fee** | Take 0.1–0.3% of value routed through PolicyProxy | Aligns incentives with usage | Complex to implement fairly |
| **Policy Templates NFT** | Sell pre-audited policy templates as NFTs (e.g., "Safe DeFi Agent v1") | Web3 native, viral potential | Volatile demand |
| **Enterprise API** | Sell API access to projects building AI agent products | High LTV | Long sales cycle |
| **Hackathon → 0G Ecosystem** | Win grant, become 0G's native AI wallet infra | Non-dilutive capital | One-time |

### 🏆 Recommended Business Model for Hackathon Stage
**Freemium + 0G ecosystem grant play.**

- Free tier gets you users and feedback.
- Position iWallet as **the standard AI agent wallet for 0G ecosystem**.
- Pitch to 0G Foundation for integration as a recommended tool for AI agent dApps on 0G.
- Long-term: become the "Safe{Wallet} for AI agents."

---

## 10. Implementation Phases

### Phase 1 — Hackathon MVP (1–2 weeks)
- [ ] iWallet key derivation (frontend, ethers.js)
- [ ] PolicyWallet.sol with basic limits (daily ETH cap, allowed contracts)
- [ ] PolicyProxy.sol (EIP-7702 fallback)
- [ ] Frontend: /create, /configure, /activate pages
- [ ] Basic AI agent demo on /agent (Claude + 2 tools: sendETH, checkBalance)
- [ ] Deploy on 0G testnet
- [ ] Pitch deck + demo video

### Phase 2 — Post-Hackathon (1 month)
- [ ] Full policy rule set (timelock, cooldown, multi-token limits)
- [ ] Server indexer for DailyLimitHit events
- [ ] Discord / email alert integration
- [ ] Multiple iWallet dashboard
- [ ] Agent with more tools (swap, stake, bridge)

### Phase 3 — Growth (3 months)
- [ ] Policy template marketplace
- [ ] SDK for developers to embed iWallet into their dApps
- [ ] Multi-chain support (Ethereum mainnet, Arbitrum, Base)
- [ ] Audit PolicyWallet.sol
- [ ] ERC-4337 variant for platforms with Bundler support

---

## 11. 0G Blockchain Specific Considerations

- **Confirm EIP-7702 support:** Check 0G's EVM version / hardfork status. If not supported, use PolicyProxy (Option B) for hackathon.
- **0G DA Layer:** Consider using 0G's data availability layer to store agent action logs cheaply off-chain but verifiably.
- **0G Storage:** Could store policy rule history in 0G decentralized storage for auditability.
- **0G Compute:** If 0G has verifiable compute, the AI agent inference could be done on-chain/verified — strong demo angle.

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| EIP-7702 not on 0G | Use PolicyProxy fallback, same UX |
| Derived key security | Clear docs, session-only storage, no persistence |
| AI agent calls wrong contract | Allowlist enforced on-chain, can't be bypassed |
| Daily limit too low for real use | Configurable, user controls it |
| Smart contract bugs | Simple contracts, extensive tests, NatSpec docs |
| Demo agent acts unpredictably | Constrained tool set, sandboxed to testnet |

---

## 13. Repository Structure

```
iwallet/
├── contracts/
│   ├── PolicyWallet.sol
│   ├── PolicyProxy.sol
│   ├── PolicyRegistry.sol
│   └── test/
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Landing
│   │   ├── create/page.tsx
│   │   ├── configure/page.tsx
│   │   ├── activate/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── agent/page.tsx     # Demo star
│   ├── lib/
│   │   ├── derive.ts          # iWallet key derivation
│   │   ├── policy.ts          # policy rule helpers
│   │   └── agent.ts           # AI agent tools
│   └── components/
├── backend/
│   ├── indexer.ts             # Event listener
│   ├── alerts.ts              # Discord/email notifications
│   └── agent-signer.ts        # Session-based iWallet signer
├── scripts/
│   └── deploy.ts
└── README.md
```

---

## 14. Hackathon Pitch Angle

> "Every AI agent needs a wallet. But today, giving an AI agent a wallet is like giving a toddler a credit card with no limit.  
> iWallet solves this: deterministic sub-wallets derived from your master wallet, upgraded via EIP-7702 to enforce on-chain policy rules. The AI can act — but only within boundaries you set. And you can try it right now, with a live AI agent, on our website."

**Unique value props:**
1. **Derived keys** — no new seed phrases, deterministic, recoverable.
2. **On-chain policy** — not just software limits, blockchain-enforced.
3. **EIP-7702** — cutting-edge standard, shows technical depth.
4. **Live demo** — judges can see the agent blocked in real time.
5. **0G native** — built on and for 0G ecosystem.

---

*Document prepared for execution by Opus agent. All implementation details above are self-contained and sufficient to begin Phase 1 development.*
