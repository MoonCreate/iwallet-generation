# iWallet — Privacy-First AI Agent Wallet with Policy Rules
### Implementation Plan v2 — 0G Blockchain Hackathon
### Prepared for Opus Agent Execution

---

## Executive Summary

**iWallet** is a dApp for creating deterministic sub-wallets (iWallets) controlled by AI agents, upgraded via EIP-7702 to enforce on-chain policy rules. This v2 adds a **full privacy layer** so that policy rules, agent behavior, and transaction patterns are never exposed to public observers on-chain.

Privacy is implemented in **three distinct layers**, each using the most appropriate technology for the threat model:

1. **TEE Layer (0G Sealed Inference)** — AI agent reasoning and policy evaluation happen inside a hardware-isolated enclave. No one, not even node operators or 0G, can observe the agent's logic or the policy contents during execution.
2. **ZK Layer (zk-SNARK Policy Proof)** — The on-chain enforcement mechanism only verifies a *proof* that a transaction complies with the policy, without revealing the policy rules themselves.
3. **Private Storage Layer (0G Encrypted Storage)** — Policy rules are stored encrypted on 0G's decentralized storage, retrievable only by the wallet owner or the TEE enclave.

**Bonus layer:** Optional private payment routing via stealth address pattern for transaction privacy at the settlement level.

**One iWallet = One AI Agent Identity. The agent acts — but within private, cryptographically-enforced boundaries.**

---

## 1. Why Each Privacy Technology Was Chosen

Before diving into architecture, here is the honest trade-off analysis:

### ZK Proofs for Policy Enforcement
**What it does:** Proves "this transaction satisfies the policy" without revealing what the policy is.

| Pro | Con |
|---|---|
| Trustless, fully decentralized | Requires circuit compilation per policy type |
| No hardware dependency | Proof generation takes 100ms–2s (acceptable) |
| Strong cryptographic guarantee | Complex to develop from scratch |
| Policy rules stay 100% private | Limited expressibility vs raw code |

**Verdict: Use ZK for the on-chain compliance proof.** This is the correct tool because the enforcement needs to be verifiable on-chain without a trusted party.

### TEE (0G Sealed Inference / TeeML)
**What it does:** AI agent inference and policy evaluation run in a hardware-isolated enclave. 0G's Compute Network already has `TeeML` verifiability — services marked with `verifiability: "TeeML"` run inside TEE with cryptographic attestation.

| Pro | Con |
|---|---|
| Very fast (near-native speed) | Trust in hardware vendor (Intel SGX / NVIDIA CC) |
| 0G already supports it natively | Not fully decentralized trust model |
| AI inference stays private | Attestation can be revoked by hardware vendor |
| 0G SDK directly usable | |

**Verdict: Use TEE for the AI agent compute layer.** This is native to 0G — using `@0glabs/0g-serving-broker` with `TeeML` providers gives us hardware-attested private inference out of the box. We get the Remote Attestation (RA) report for free.

### 0G Encrypted Storage
**What it does:** Store encrypted policy rules on 0G's decentralized storage (2 GB/s throughput, 100× cheaper than Ethereum DA). Only the wallet owner (and optionally the TEE key) can decrypt.

**Verdict: Use 0G Storage for private policy persistence.** Keeps policy off-chain but verifiable via storage proof. No single point of failure vs a centralized server.

### Stealth Addresses (Private Payment)
**What it does:** Every time the AI agent sends/receives funds, a fresh one-time address is derived. On-chain observers cannot link transactions to the iWallet or the user.

**Verdict: Optional but recommended for DeFi-heavy agents.** Adds significant privacy with minimal complexity using ERC-5564 standard.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER MASTER WALLET                        │
│  signMessage(keccak256("iWallet-N")) → iWallet Private Key       │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │        POLICY SETUP          │
              │  User defines rules in dApp  │
              │  Rules encrypted → 0G Storage│
              │  ZK Circuit compiled for     │
              │  this policy type            │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │    EIP-7702 AUTHORIZATION    │
              │  iWallet EOA delegates to    │
              │  PrivacyPolicyWallet.sol     │
              │  (stores only policy hash,   │
              │   not plaintext rules)       │
              └──────────────┬──────────────┘
                             │
     ┌───────────────────────▼───────────────────────┐
     │              AI AGENT RUNTIME                  │
     │                                                 │
     │  ┌─────────────────────────────────────────┐   │
     │  │  0G SEALED INFERENCE (TEE / TeeML)      │   │
     │  │  - Agent reasoning stays inside enclave  │   │
     │  │  - Policy rules decrypted inside TEE     │   │
     │  │  - No one sees prompt, policy, or intent │   │
     │  │  - Response cryptographically signed     │   │
     │  │    with enclave-born key                 │   │
     │  └──────────────┬──────────────────────────┘   │
     │                 │                               │
     │  ┌──────────────▼──────────────────────────┐   │
     │  │  ZK PROOF GENERATION                    │   │
     │  │  - Prover: does tx comply with policy?  │   │
     │  │  - Generates zk-SNARK proof              │   │
     │  │  - Proof reveals nothing about policy    │   │
     │  └──────────────┬──────────────────────────┘   │
     └─────────────────┼─────────────────────────────┘
                       │
     ┌─────────────────▼──────────────────────────────┐
     │          ON-CHAIN (0G EVM)                       │
     │                                                   │
     │  PrivacyPolicyWallet.sol                          │
     │  ┌────────────────────────────────────────────┐  │
     │  │  execute(calldata, zkProof, attestation)   │  │
     │  │   1. verifyProof(zkProof) → pass/fail       │  │
     │  │   2. verifyAttestation(attestation)         │  │
     │  │   3. If both pass → forward calldata        │  │
     │  │   4. Emit PolicyVerified(txHash) event      │  │
     │  │      (no policy details exposed)            │  │
     │  └────────────────────────────────────────────┘  │
     └───────────────────────────────────────────────────┘
                       │
     ┌─────────────────▼──────────────────────────────┐
     │        STEALTH ADDRESS LAYER (Optional)          │
     │  ERC-5564: derive one-time address per tx        │
     │  → breaks on-chain tx graph linking              │
     └────────────────────────────────────────────────┘
```

---

## 3. Deep Dive: ZK Policy Proof System

### What We Are Proving
The ZK circuit proves: **"The proposed transaction satisfies all policy constraints, and I know the private policy inputs that hash to the committed policy hash on-chain."**

The on-chain contract stores only: `policyCommitment = keccak256(encryptedPolicyHash)`.

### Policy Circuit Inputs

```
Private inputs (never revealed on-chain):
  - dailySpendLimit (uint256)
  - allowedContracts[] (address[])
  - allowedTokens[] (address[])
  - cooldownSeconds (uint256)
  - expiresAt (uint256)
  - salt (bytes32)

Public inputs (visible on-chain):
  - policyCommitment (bytes32)   ← matches what's stored in contract
  - txValue (uint256)            ← the proposed tx amount
  - txTo (address)               ← the proposed tx target
  - currentDailySpent (uint256)  ← public ledger state
  - timestamp (uint256)          ← block.timestamp

Statement proven:
  1. hash(privateInputs, salt) == policyCommitment  ← I know this policy
  2. txValue + currentDailySpent <= dailySpendLimit  ← within daily limit
  3. txTo ∈ allowedContracts                         ← target is whitelisted
  4. timestamp < expiresAt                            ← agent not expired
```

### ZK Tooling Stack
Use **Circom 2 + SnarkJS** (well-supported, production-ready, EVM verifier generation built-in):

```
circuits/
├── policy_check.circom        # Main circuit
├── merkle_allowlist.circom    # Merkle proof for allowedContracts[]
└── utils/
    ├── poseidon.circom        # Hash function (ZK-friendly)
    └── comparators.circom

scripts/
├── compile.sh                 # circom compile → R1CS + WASM
├── trusted_setup.sh           # Powers of Tau ceremony (or use Hermez's)
├── generate_proof.ts          # Client-side proof generation
└── export_verifier.sh         # → PolicyVerifier.sol
```

### Why Circom/SnarkJS over alternatives:

| Tool | Pros | Cons | Decision |
|---|---|---|---|
| Circom + SnarkJS | Mature, EVM verifier auto-gen, widely used | Trusted setup required | ✅ Use this |
| Noir (Aztec) | Rust-like syntax, no trusted setup (UltraPlonk) | Less tooling, fewer examples | Consider for v2 |
| Risc0 | General-purpose, no custom circuits | Heavy, overkill for simple policy | Skip |
| PLONK/Halo2 | No trusted setup | Very complex to implement | Skip |

**For hackathon:** Use Groth16 with Circom. Trusted setup can reuse existing Powers of Tau (ptau) from Hermez/Iden3 — no ceremony needed for hackathon.

---

## 4. Deep Dive: 0G Sealed Inference Integration

### What 0G Provides (Live on Mainnet)
0G's Sealed Inference is a security architecture for its live Compute Network where every AI inference call is executed inside a hardware-isolated Trusted Execution Environment and cryptographically signed before the response is returned — no one, not node operators, not 0G, can access user data during processing.

In the 0G Compute Network SDK, services with `verifiability: "TeeML"` run with verification in a Trusted Execution Environment, while an empty value means no verification.

Developers can integrate through a Web UI, CLI, or TypeScript SDK with transparent per-token pricing. Additional verification methods including OPML and ZKML are in active development.

### SDK Integration Pattern

```typescript
import { createZGServingNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

// Setup broker with iWallet signer
const broker = await createZGServingNetworkBroker(iWalletSigner);

// List services — filter for TeeML only
const services = await broker.inference.listService();
const teeServices = services.filter(s => s.verifiability === "TeeML");

// Acknowledge TEE provider on-chain (payment in escrow)
await broker.inference.acknowledgeProviderSigner(teeServices[0].provider);

// Run agent inference — fully inside TEE
const response = await broker.inference.generateText(
  teeServices[0].provider,
  teeServices[0].model,
  [
    { role: "system", content: systemPrompt },          // policy context
    { role: "user",   content: agentInstruction }
  ]
);

// Verify TEE signature on response
await broker.inference.processResponse(
  teeServices[0].provider,
  response,           // contains enclave signature
  agentInstruction
);
// If processResponse doesn't throw → response is authentic, TEE-attested
```

### What This Gives iWallet
- Policy rules sent as the `system prompt` to the TEE model are **never visible outside the enclave**.
- The agent's reasoning chain (chain-of-thought) stays private.
- The Remote Attestation report can be shown in the UI as a trust badge.
- No custom TEE infrastructure needed — 0G's network is already live.

---

## 5. Deep Dive: 0G Encrypted Storage for Policy Rules

0G's decentralized storage supports up to 2 GB per second throughput and is 50,000 times faster and 100 times cheaper than Ethereum DA.

### Storage Flow

```typescript
// 1. User sets policy rules in UI
const policy: PolicyRules = {
  dailySpendLimit: parseEther("0.05"),
  allowedContracts: ["0xDEX...", "0xLENDING..."],
  allowedTokens: ["0xUSDC...", "0xWETH..."],
  cooldownSeconds: 30,
  expiresAt: Math.floor(Date.now()/1000) + 30*24*3600
};

// 2. Encrypt with user's key (derived from master wallet signature)
const encryptionKey = await deriveEncryptionKey(masterWallet, "iWallet-policy-0");
const encrypted = await encrypt(JSON.stringify(policy), encryptionKey);

// 3. Also encrypt a copy for TEE enclave (using TEE public key from attestation)
const teePublicKey = await getTEEPublicKeyFromAttestation(providerAddress);
const encryptedForTEE = await encryptAsymmetric(JSON.stringify(policy), teePublicKey);

// 4. Store on 0G Storage
import { ZgFile, Indexer } from "@0glabs/0g-ts-sdk";
const zgFile = await ZgFile.fromBytes(
  Buffer.from(JSON.stringify({ userCopy: encrypted, teeCopy: encryptedForTEE }))
);
const [tree, err] = await zgFile.merkleTree();
const [txHash, uploadErr] = await indexer.upload(zgFile, 0, rpcEndpoint, wallet);

// 5. Store only the storage root hash on-chain (in PolicyWallet)
await policyWallet.setPolicyStorageRoot(tree.rootHash(), zkPolicyCommitment);
```

### What Observers See On-Chain
```
policyStorageRoot: 0x7f3a...   ← 0G storage root (opaque)
policyCommitment:  0x8b2c...   ← ZK commitment (opaque)
```

No policy details. No spending limits. No whitelists. Just two hashes.

---

## 6. Stealth Addresses for Transaction Privacy (Bonus Layer)

Using **ERC-5564** stealth address standard:

```
User publishes: meta-address (spending pubkey + viewing pubkey)

For each AI agent tx:
  1. Agent generates ephemeral keypair
  2. Computes stealth address from meta-address + ephemeral key
  3. Sends to stealth address instead of iWallet directly
  4. Publishes ephemeral pubkey to ERC-5564 announcer contract

User scans announcer → finds their txs → recovers funds
On-chain: just N independent addresses with no linkage
```

**When to use:** Recommended for receiving payments into iWallet (e.g., AI agent earns fees). For outgoing agent txs, the stealth layer is less critical since the agent is already gated by policy.

---

## 7. Smart Contract Architecture

```
contracts/
│
├── PrivacyPolicyWallet.sol        ← EIP-7702 delegation target
│   ├── State:
│   │   policyCommitment           bytes32  (ZK input)
│   │   policyStorageRoot          bytes32  (0G storage pointer)
│   │   verifier                   address  (Groth16Verifier)
│   │   dailySpent[day]            mapping  (public, needed for ZK public input)
│   │   lastTxTimestamp            uint256  (public, for cooldown check)
│   │
│   ├── execute(
│   │     calldata txData,
│   │     uint[2] zkProofA,
│   │     uint[2][2] zkProofB,
│   │     uint[2] zkProofC,
│   │     uint[] publicInputs,
│   │     bytes teeAttestation      ← optional: binds this tx to TEE session
│   │   )
│   │     → verifyProof() via Groth16Verifier
│   │     → verifyAttestation() (check enclave sig)
│   │     → forward call
│   │     → emit PolicyVerified(txHash, day, spent)
│   │
│   ├── updatePolicy(
│   │     bytes32 newCommitment,
│   │     bytes32 newStorageRoot,
│   │     bytes ownerSignature
│   │   )  ← owner-only
│   │
│   └── revokeAgent()  ← emergency kill, sets expiresAt = 0
│
├── PolicyProxyV2.sol              ← EIP-7702 fallback (same interface)
│
├── Groth16Verifier.sol            ← auto-generated by SnarkJS from circuit
│
├── StealthRegistry.sol            ← ERC-5564 announcer for stealth addresses
│
└── PolicyRegistry.sol             ← Optional: registry mapping iWallet → metadata
```

---

## 8. Frontend dApp Architecture

### Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Wallet:** wagmi v2 + viem + RainbowKit
- **ZK Proving:** snarkjs (runs in browser Web Worker — non-blocking)
- **0G Compute SDK:** `@0glabs/0g-serving-broker`
- **0G Storage SDK:** `@0glabs/0g-ts-sdk`
- **AI Agent UI:** Vercel AI SDK (streaming)
- **UI:** Tailwind CSS + shadcn/ui
- **Encryption:** Web Crypto API (AES-GCM, ECDH)

### Page Structure

```
/
├── /                          Landing — "AI wallets need guardrails"
├── /create                    Derive iWallet, fund it
├── /configure                 Set policy rules
│   ├── PolicyForm.tsx         → daily limit, allowlist, expiry
│   └── ZKCircuitCompiler.tsx  → compiles policy → ZK commitment (in browser)
├── /activate                  EIP-7702 authorization tx
├── /dashboard                 All iWallets, policy status, spend tracker
├── /agent                     ⭐ LIVE DEMO
│   ├── ChatInterface.tsx       → user talks to AI agent
│   ├── TEEBadge.tsx            → shows Remote Attestation proof
│   ├── PolicyProofLog.tsx      → shows ZK proofs as each tx is submitted
│   ├── TxTimeline.tsx          → success vs blocked transactions
│   └── PrivacyPanel.tsx        → toggle: show what's private vs visible
└── /privacy                   Explainer page — what observers see vs what's hidden
```

### ⭐ The `/agent` Demo Page — What Makes This Shine

The demo has a **"Privacy Transparency Mode"** toggle showing two columns side by side:

```
┌─────────────────────┬──────────────────────────────────┐
│   WHAT AN OBSERVER  │    WHAT'S ACTUALLY HAPPENING      │
│   SEES ON-CHAIN     │    (visible only to you + TEE)    │
├─────────────────────┼──────────────────────────────────┤
│ policyCommitment:   │ dailyLimit: 0.05 ETH              │
│   0x8b2c...         │ allowedContracts: [Uniswap, Aave] │
│                     │ cooldown: 30s                     │
├─────────────────────┼──────────────────────────────────┤
│ ZK Proof:           │ Agent thought: "User wants to     │
│   π_a: [0x3f...]    │ swap 0.03 ETH. Checking policy:   │
│   π_b: [[0x2a...]   │ 0.03 < 0.05 limit ✅ Uniswap      │
│   π_c: [0x9d...]    │ is whitelisted ✅ Proceeding..."  │
│                     │                                   │
├─────────────────────┼──────────────────────────────────┤
│ TeeAttestation:     │ Inference ran in Intel TDX        │
│   sig: 0xef01...    │ Enclave ID: 0xab34...             │
│                     │ RA Report: verified ✅             │
└─────────────────────┴──────────────────────────────────┘
```

This split-view is the **killer demo moment** for hackathon judges. It makes privacy tangible.

---

## 9. Key Derivation & Encryption Key Derivation

```typescript
// iWallet private key derivation (same as v1)
async function deriveiWalletKey(masterWallet: Wallet, index: number): Promise<Wallet> {
  const message = `iWallet-${index}`;
  const msgHash = ethers.id(message);                          // keccak256
  const signature = await masterWallet.signMessage(getBytes(msgHash));
  const iWalletPrivKey = signature.slice(0, 66);               // first 32 bytes
  return new Wallet(iWalletPrivKey);
}

// Policy encryption key derivation (deterministic, no extra prompts)
async function derivePolicyEncKey(masterWallet: Wallet, index: number): Promise<CryptoKey> {
  const message = `iWallet-policy-enc-${index}`;
  const msgHash = ethers.id(message);
  const signature = await masterWallet.signMessage(getBytes(msgHash));
  const keyMaterial = hexToBytes(signature.slice(0, 66));
  return crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// ZK policy commitment (public, stored on-chain)
async function computePolicyCommitment(policy: PolicyRules, salt: bigint): Promise<string> {
  // Uses Poseidon hash (ZK-friendly, same as in circuit)
  return poseidon([...policyToFieldElements(policy), salt]).toString(16);
}
```

---

## 10. Data Flow: One Complete Agent Transaction

```
1. USER → AGENT
   User: "Swap 0.03 ETH for USDC"

2. AGENT REASONING (inside 0G TEE enclave)
   System prompt: [encrypted policy rules, decrypted inside enclave only]
   Agent reasoning: "0.03 ETH requested. Policy: limit 0.05 ETH/day.
                     Current daily spent: 0.01 ETH. Total: 0.04 < 0.05. OK.
                     Target: Uniswap V3 at 0xE592... Is it in allowlist? YES.
                     → Approve and generate tx calldata."
   → TEE signs the decision with enclave key
   → Returns: { calldata, teeSignature, attestation }

3. ZK PROOF GENERATION (client-side, in browser Web Worker)
   Private inputs: [policy rules from 0G Storage]
   Public inputs:  [txValue=0.03eth, txTo=0xUniswap, currentSpent=0.01eth, timestamp]
   snarkjs.groth16.fullProve(inputs, circuit.wasm, zkey) → proof

4. ON-CHAIN EXECUTION (0G EVM)
   PrivacyPolicyWallet.execute(swapCalldata, zkProof, publicInputs, teeAttestation)
   → Groth16Verifier.verifyProof(zkProof, publicInputs) → true ✅
   → verifyTEEAttestation(teeAttestation) → valid ✅
   → dailySpent[today] += 0.03 ETH
   → forward: iWallet.call(Uniswap, swapCalldata)
   → emit PolicyVerified(txHash)

5. SERVER INDEXER
   Indexes PolicyVerified events
   Tracks daily spend across all iWallets
   Sends alert if spend > 80% of daily limit

6. BLOCKED SCENARIO (same flow, step 4 fails)
   User: "Now swap 0.02 ETH more" → totalWould = 0.06 > 0.05 limit
   ZK circuit: constraint violated → snarkjs throws, no valid proof
   No proof → no tx submitted → UI shows "Agent blocked: DailyLimitHit"
   Crucially: the limit value NEVER appears on-chain. Just the block.
```

---

## 11. Business Model

### Primary Positioning
**iWallet is the trust layer between humans and AI agents on 0G.** As 0G's Aristotle Mainnet provides the three capabilities every autonomous AI agent needs to operate independently: verified compute, persistent memory, and onchain settlement, iWallet adds the **fourth capability: private, policy-enforced authorization**.

### Revenue Model

**Tier 1 — Free (Growth)**
- 1 iWallet, basic policy (3 rules), 0G Storage (standard)
- 0G Sealed Inference: pay-per-token (user pays directly)
- Goal: onboard 0G ecosystem developers

**Tier 2 — Pro ($12/month or 50 0G tokens/month)**
- Unlimited iWallets
- Advanced policy types (multi-sig approval threshold, AI behavior scoring)
- Custom alert webhooks (Discord, Telegram, email)
- Policy templates library (pre-audited circuits)
- Priority TEE provider routing

**Tier 3 — Teams ($49/month)**
- Organization-level dashboard
- Multiple team members can define policy for shared agents
- Audit log with ZK proof history
- SDK access for embedding iWallet into other dApps

**Ecosystem Play (Non-dilutive)**
- Position as the standard wallet library for AI agent dApps on 0G
- Apply for 0G Foundation builder grants
- Revenue share with 0G on compute routing (take % of TeeML inference fees brokered through iWallet)

### Why Users Pay
The problem is not "storing policy rules" — that's solved by encryption. The problem is **trust**: can I deploy an AI agent with real money without babysitting it? iWallet's value prop is: **"Set it and forget it, with cryptographic proof your AI can't go rogue."** Privacy is the premium feature — no competitor (Smart Wallet, Safe, Argent) offers ZK-private policy enforcement combined with TEE-verified agent execution.

---

## 12. 0G Ecosystem Fit — Why This Wins

0G is staking its position as the blockchain purpose-built for AI agents, delivering the onchain layer where autonomous AI agents compute, store, and transact. iWallet directly addresses what's missing from this stack:

| 0G Provides | iWallet Adds |
|---|---|
| Verified compute (TeeML) | Private policy evaluation inside enclave |
| Persistent memory (0G Storage) | Encrypted policy storage, user-owned |
| Onchain settlement (EVM) | ZK-proven policy compliance without data leak |
| Sealed Inference (TEE) | AI agent reasoning is confidential by default |

iWallet is not competing with 0G — it is **middleware that makes 0G's AI agent stack production-ready for real-money use cases**.

---

## 13. Implementation Phases

### Phase 1 — Hackathon MVP (12–14 days)

**Week 1: Core contracts + ZK circuit**
- [ ] `policy_check.circom` circuit with daily limit + allowlist merkle proof
- [ ] Compile circuit → `Groth16Verifier.sol` (SnarkJS export)
- [ ] `PrivacyPolicyWallet.sol` with `execute(calldata, zkProof, publicInputs)`
- [ ] `PolicyProxyV2.sol` (EIP-7702 fallback)
- [ ] Deploy on 0G testnet
- [ ] Unit tests (Hardhat/Foundry)

**Week 2: Frontend + Agent Demo**
- [ ] `/create` page: key derivation + iWallet address display
- [ ] `/configure` page: policy form + ZK commitment computation (browser)
- [ ] `/activate` page: EIP-7702 auth OR proxy deploy
- [ ] `/agent` page: TEE agent chat + proof log + split privacy view
- [ ] 0G Sealed Inference integration (`@0glabs/0g-serving-broker`, TeeML filter)
- [ ] 0G Storage integration for encrypted policy storage
- [ ] Proof generation Web Worker (non-blocking UI)
- [ ] Demo video + pitch deck

### Phase 2 — Post-Hackathon (Month 1–2)
- [ ] Noir/UltraPlonk migration (remove trusted setup requirement)
- [ ] More circuit types: token-specific limits, time-window rules, multi-sig
- [ ] Server indexer for event monitoring
- [ ] Discord/Telegram alert integration
- [ ] Multi-iWallet dashboard
- [ ] Stealth address (ERC-5564) integration

### Phase 3 — Growth (Month 3–6)
- [ ] Smart contract audit
- [ ] Policy template NFT marketplace
- [ ] SDK: `npm install @iwallet/sdk`
- [ ] Integration guides for top 0G dApps
- [ ] Multi-chain (Ethereum mainnet, Arbitrum)
- [ ] Agent behavior scoring (ML model for anomaly detection inside TEE)

---

## 14. Repository Structure

```
iwallet/
├── circuits/
│   ├── policy_check.circom
│   ├── merkle_allowlist.circom
│   ├── utils/poseidon.circom
│   ├── build/                  # compiled artifacts (gitignored except ptau)
│   └── scripts/
│       ├── compile.sh
│       ├── setup.sh            # trusted setup with hermez ptau
│       └── export_verifier.sh
│
├── contracts/
│   ├── PrivacyPolicyWallet.sol
│   ├── PolicyProxyV2.sol
│   ├── Groth16Verifier.sol     # auto-generated
│   ├── StealthRegistry.sol
│   └── test/
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── create/page.tsx
│   │   ├── configure/page.tsx
│   │   ├── activate/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── agent/
│   │       ├── page.tsx
│   │       ├── TEEBadge.tsx
│   │       ├── PolicyProofLog.tsx
│   │       ├── PrivacyPanel.tsx
│   │       └── TxTimeline.tsx
│   ├── lib/
│   │   ├── derive.ts           # iWallet key + encryption key derivation
│   │   ├── zk.ts               # snarkjs wrapper, proof generation
│   │   ├── storage.ts          # 0G storage upload/download
│   │   ├── tee.ts              # 0G serving broker wrapper
│   │   ├── stealth.ts          # ERC-5564 stealth address helpers
│   │   └── policy.ts           # policy type definitions + helpers
│   └── workers/
│       └── prover.worker.ts    # Web Worker for non-blocking ZK proving
│
├── backend/
│   ├── indexer.ts              # PolicyVerified event listener
│   ├── alerts.ts               # Discord/email notifications
│   └── tee-relay.ts            # Optional: server-side TEE session manager
│
├── scripts/
│   └── deploy.ts
│
├── hardhat.config.ts
└── README.md
```

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| ZK proof generation too slow for demo | Use pre-computed proofs for demo, real proving runs async in Web Worker |
| Circom circuit bugs | Keep circuit minimal for hackathon (only daily limit + allowlist), expand post-hackathon |
| 0G EIP-7702 not confirmed | `PolicyProxyV2.sol` as automatic fallback, same UX |
| TEE attestation verification complexity | Use 0G SDK's `processResponse()` — it handles attestation verification internally |
| Stealth address UX complexity | Make it optional at configuration step, default off for MVP |
| Trusted setup for Groth16 | Reuse Hermez Powers of Tau (ptau14 or ptau15) — publicly available, no ceremony needed |

---

## 16. Hackathon Pitch Angle

> "Giving an AI agent a wallet without guardrails is dangerous. Giving it guardrails that are visible on-chain means anyone can see what your agent is allowed to do — competitors, front-runners, attackers.
>
> iWallet solves both problems. Your agent operates within cryptographically-enforced policy rules — but thanks to zero-knowledge proofs and 0G's Sealed Inference TEE, those rules are invisible to everyone except you.
>
> The blockchain sees a proof. The enclave knows the truth. The agent acts — privately, within bounds you set."

**Unique differentiators for judges:**
1. Only project combining EIP-7702 + ZK policy proofs + 0G native TEE inference
2. Uses 0G's own Sealed Inference feature — demonstrates deep ecosystem integration
3. Privacy is not a checkbox — it's the core UX (split-view demo makes it tangible)
4. Addresses a real problem in the trillion-dollar agentic AI economy

---

*Document v2 — revised with full privacy architecture. Prepared for execution by Opus agent. All implementation details are self-contained. Start with Phase 1, Week 1: circuits and contracts.*
