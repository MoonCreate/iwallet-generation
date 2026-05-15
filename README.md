# iWallet

AI-Native Smart Wallet with On-Chain Policy Rules — built on the **0G Blockchain**.

iWallet creates deterministic sub-wallets derived from your master wallet, each controlled by an AI agent. On-chain policy rules (daily spend limits, contract whitelists, cooldowns) act as guardrails — even a misbehaving agent cannot exceed its boundaries. Agent conversations are permanently stored on **0G decentralized storage**.

## Live Demo

- **Frontend:** [https://wallet.goon4.site](https://wallet.goon4.site)
- **Backend/MCP:** [https://be-wallet.goon4.site](https://be-wallet.goon4.site)
- **Contract (Mainnet):** [0x08a7Ea416AF2b8DD4614aa6A314ee7c96F8aA68d](https://chainscan.0g.ai/address/0x08a7Ea416AF2b8DD4614aa6A314ee7c96F8aA68d)
- **Contract (Testnet):** [0xCF1f2860BA28aD3c7BCfCc29ab34c2f70D64F4ca](https://chainscan-galileo.0g.ai/address/0xCF1f2860BA28aD3c7BCfCc29ab34c2f70D64F4ca)

## Key Features

- **On-Chain Policy Enforcement** — daily limits, allowed contracts, cooldowns enforced by smart contracts
- **0G Storage Integration** — agent conversations permanently archived on decentralized storage
- **AI Agent with Tool Calling** — check balances, send ETH, read policy via LLM
- **MCP Protocol** — any MCP-compatible client (Claude, Cursor, VS Code) can control the wallet
- **Deterministic Sub-Wallets** — derived from master wallet signature, no new seed phrases

## 0G Ecosystem Integration

| 0G Service | Usage in iWallet |
|---|---|
| **0G Chain** | Smart contracts deployed on Mainnet + Testnet |
| **0G Storage** | Persistent agent memory (conversation archival via Log layer) |
| **MCP over 0G** | Decentralized AI agent tool execution |

## Project Structure

```
iwallet/
├── packages/
│   ├── contract/       # Solidity smart contracts (Hardhat v3)
│   ├── backend/        # Elysia.js API + AI agent + 0G Storage
│   ├── frontend/       # React + TanStack Start + Tailwind
│   ├── chains/         # Shared chain definitions & ABIs
│   └── tokens/         # Token registry
├── scripts/            # Deploy & E2E scripts
└── package.json        # Bun workspace root
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Node.js](https://nodejs.org) v22 LTS (required by Hardhat)
- MetaMask or any EVM wallet

### Install & Run

```bash
# Install all dependencies
bun install

# Start backend (port 3001)
cd packages/backend
bun run dev

# Start frontend (port 3000)
cd packages/frontend
bun run dev
```

### Wallet Setup

1. Add **0G Galileo Testnet** to MetaMask:
   - RPC: `https://evmrpc-testnet.0g.ai`
   - Chain ID: `16602`
   - Symbol: `0G`
2. Get testnet tokens: [faucet.0g.ai](https://faucet.0g.ai)
3. Connect wallet on the app

## Environment Variables

### Backend (`packages/backend/.env.local`)

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000

# LLM (MiniMax or any OpenAI-compatible)
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.minimax.io/v1
LLM_MODEL=MiniMax-M2.7

# 0G Storage (enables persistent agent memory)
ZG_PRIVATE_KEY=0x...
ZG_RPC=https://evmrpc-testnet.0g.ai
ZG_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
```

### Frontend (`packages/frontend/.env.local`)

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_REOWN_PROJECT_ID=...      # Optional, for WalletConnect
```

## Usage Flow

1. **Connect** — Connect your wallet on the landing page
2. **Policy** — Go to `/policy`, configure rules (daily limit, allowed contracts, cooldown, expiry)
3. **Fund** — Send 0G to your iWallet address + session key for gas
4. **Agent** — Go to `/agent`, start a chat session, interact with the AI agent
5. **MCP** — Go to `/mcp` for instructions to connect Claude, Cursor, or any MCP client

## Smart Contracts

| Contract | Description |
|---|---|
| `iWallet.sol` | Agent-bounded smart wallet with per-session policy enforcement |
| `iWalletFactory.sol` | UUPS-upgradeable factory + beacon proxy deployer |

```bash
# Compile
cd packages/contract && bunx hardhat compile

# Test
cd packages/contract && bunx hardhat test
```

## Tech Stack

- **Contracts:** Solidity 0.8.28, Hardhat v3, OpenZeppelin (UUPS + Beacon upgradeable)
- **Backend:** Bun, Elysia.js, LLM (MiniMax or any OpenAI-compatible), viem, 0G Storage SDK
- **Frontend:** React 19, TanStack Start, Tailwind v4, wagmi v3, Reown AppKit, Three.js
- **Protocol:** MCP (Model Context Protocol) for AI agent interoperability
- **Storage:** 0G Storage (Log layer for immutable conversation archival)

## License

MIT
