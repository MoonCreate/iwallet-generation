# iWallet

AI-Native Smart Wallet with On-Chain Policy Rules for the 0G Blockchain.

iWallet creates deterministic sub-wallets derived from your master wallet, each controlled by an AI agent. On-chain policy rules (daily spend limits, contract whitelists, cooldowns) act as guardrails — even a misbehaving agent cannot exceed its boundaries.

## Project Structure

```
iwallet/
├── packages/
│   ├── contract/       # Solidity smart contracts (Hardhat v3)
│   ├── backend/        # Elysia.js API server + AI agent
│   ├── frontend/       # React + TanStack Start + Tailwind
│   └── chains/         # Shared chain definitions & ABIs
├── docs/               # Implementation plans
└── package.json        # Bun workspace root
```

## Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Node.js](https://nodejs.org) v22 LTS (required by Hardhat)
- [MetaMask](https://metamask.io) or any EVM wallet browser extension

## Quick Start (Local Development)

### 1. Install dependencies

```bash
bun install
```

### 2. Start the local Hardhat node

Open a terminal and run:

```bash
cd packages/contract
bunx hardhat node
```

This starts a local EVM node at `http://127.0.0.1:8545` with 20 pre-funded accounts (10,000 ETH each).

Keep this terminal running.

### 3. Deploy contracts

Open a **second terminal**:

```bash
cd packages/contract
bunx hardhat run scripts/deploy-local.ts
```

This will:
- Deploy the PolicyRegistry implementation contract
- Deploy a UUPS proxy pointing to it
- Write addresses to `deployments.local.json`
- Auto-update `packages/frontend/.env.local` with `VITE_REGISTRY_ADDRESS`

You should see output like:
```
=== Deployment Complete ===
Registry (proxy): 0xe7f1725e7734ce288f8367e1bb143e90bb3f0512
```

### 4. Fund your wallet (optional)

If you're using MetaMask with a custom account, fund it from a Hardhat account:

```bash
cd packages/contract
TARGET=0xYourAddress AMOUNT=100 bunx hardhat run scripts/fund.ts
```

### 5. Start the backend

Open a **third terminal**:

```bash
cd packages/backend
bun run dev
```

The Elysia server starts at `http://localhost:3001`.

### 6. Start the frontend

Open a **fourth terminal**:

```bash
cd packages/frontend
bun run dev
```

The frontend starts at `http://localhost:3000`.

## Wallet Setup (MetaMask)

1. Open MetaMask and add a custom network:
   - **Network Name:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** ETH

2. Import a Hardhat test account using one of these private keys:
   ```
   Account #0: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   Account #1: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
   ```

3. Connect your wallet on the iWallet site at `http://localhost:3000`

## Usage Flow

1. **Create** — Go to `/create`, click "Create iWallet #0". Sign the message in MetaMask. This derives a deterministic sub-wallet address.

2. **Configure** — Click "Configure Policy" to set rules:
   - Daily ETH spend limit
   - Allowed contracts whitelist
   - Cooldown between transactions
   - Agent expiry date

3. **Activate** — Click "Deploy PolicyProxy & Activate". This deploys a proxy contract that enforces your policy on-chain.

4. **Fund** — Send some ETH to the proxy address so the agent can operate.

5. **Agent Demo** — Go to `/agent`, enter the proxy address, start a session. Chat with the AI agent — it can check balances, send ETH, and view policy. Watch it get blocked when it hits a policy limit.

## Environment Variables

### Backend (`packages/backend/.env.local`)

```env
USE_LOCALHOST=true
RPC_URL=http://127.0.0.1:8545
CORS_ORIGIN=http://localhost:3000
PORT=3001
OPENAI_API_KEY=sk-...          # Required for AI agent
```

### Frontend (`packages/frontend/.env.local`)

```env
VITE_API_URL=http://localhost:3001
VITE_REGISTRY_ADDRESS=0x...    # Auto-set by deploy script
VITE_REOWN_PROJECT_ID=...      # Optional, for WalletConnect
```

## Smart Contracts

| Contract | Description |
|---|---|
| `PolicyBase.sol` | Shared policy enforcement logic |
| `PolicyWallet.sol` | EIP-7702 delegation target |
| `PolicyProxy.sol` | Fallback proxy (agent calls `execute()`) |
| `PolicyRegistry.sol` | UUPS-upgradeable factory + registry |

### Run tests

```bash
cd packages/contract
bunx hardhat test
```

### Compile contracts

```bash
cd packages/contract
bunx hardhat compile
```

## Tech Stack

- **Contracts:** Solidity 0.8.28, Hardhat v3, OpenZeppelin (UUPS upgradeable)
- **Backend:** Bun, Elysia.js, OpenAI GPT-4o, viem
- **Frontend:** React 19, TanStack Start, Tailwind v4, shadcn/ui, wagmi v3, Reown AppKit
- **Chains:** viem chain definitions for 0G Mainnet, 0G Testnet, Hardhat Local
