# iWallet Backend

Elysia.js API server powering the iWallet AI agent, MCP protocol, and 0G Storage integration.

## Architecture

```
src/
├── index.ts            # Server entry (Elysia + CORS + routes)
├── agent/              # AI agent (MiniMax M2.5, tool calling, streaming)
├── routes/
│   ├── agent.ts        # Agent chat sessions + 0G history endpoints
│   ├── wallet.ts       # Session provisioning + tool execution (bearer auth)
│   ├── mcp.ts          # MCP protocol (Streamable HTTP, OAuth 2.1)
│   └── oauth.ts        # OAuth authorization server for MCP clients
├── wallet/
│   └── tools.ts        # On-chain tool implementations (sendETH, getPolicy, etc.)
├── store/
│   ├── db.ts           # SQLite database (sessions, bearers)
│   ├── sessions.ts     # Session CRUD + bearer hashing + encryption
│   ├── oauth.ts        # OAuth client/code store
│   └── zg-storage.ts   # 0G Storage upload/download/history
├── indexer/            # On-chain event watcher (iWallet events)
├── verifier/           # Auto-verify deployed wallets on block explorers
└── mcp/                # MCP server implementation
```

## Key Features

- **AI Agent** — OpenAI-compatible LLM (MiniMax M2.5) with tool calling for on-chain operations
- **0G Storage** — Upload conversation history to 0G decentralized storage after each chat
- **MCP Protocol** — Streamable HTTP MCP server with OAuth 2.1 discovery
- **Session Management** — Bearer token auth, encrypted private key storage, session rotation
- **Event Indexer** — Watch iWallet contract events in real-time

## Environment Variables

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000

# LLM ... Below is example that we used
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.minimax.io/v1
LLM_MODEL=MiniMax-M2.7

# 0G Storage
ZG_PRIVATE_KEY=0x...
ZG_RPC=https://evmrpc-testnet.0g.ai
ZG_INDEXER=https://indexer-storage-testnet-turbo.0g.ai

# Optional
IWALLET_DB_KEY=<32-byte-hex>   # Encryption key for session private keys at rest
DB_PATH=./data/iwallet.db
```

## Running

```bash
# Development (with hot reload)
bun run dev

# Production
bun run start

# MCP server (stdio mode for local clients)
bun run mcp
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/api/wallet/provision` | — | Provision a new session (returns bearer) |
| POST | `/api/wallet/tools/call` | Bearer | Execute a tool on the iWallet |
| GET | `/api/wallet/sessions/:address` | — | List sessions for a wallet |
| POST | `/api/agent/session/bearer` | — | Start agent chat session from bearer |
| POST | `/api/agent/chat` | — | Stream agent chat (SSE) |
| GET | `/api/agent/history/:address` | — | Get 0G Storage history entries |
| GET | `/api/agent/history/:address/:hash` | — | Download conversation from 0G |
| POST | `/mcp` | Bearer/OAuth | MCP protocol endpoint |

## 0G Storage Integration

After each agent chat completes:
1. Full conversation (user + assistant messages) serialized to JSON
2. Uploaded to 0G Storage Log layer via `MemData` + `indexer.upload()`
3. Root hash stored in SQLite keyed by wallet address
4. On next session start, recent history injected into agent system prompt

Conversations are permanently stored on 0G decentralized storage and can be retrieved by root hash from any storage node.
