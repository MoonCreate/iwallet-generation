#!/usr/bin/env bun
/**
 * iWallet MCP server (stdio transport).
 *
 * Self-hosted MCP server you can plug into Claude Code, Claude Desktop,
 * Cursor, or any MCP-speaking client. Reads session credentials from env,
 * exposes the iWallet tool surface as MCP tools, and signs txs locally.
 *
 * Required env:
 *   IWALLET_ADDRESS       0x… address of the iWallet contract
 *   SESSION_PRIVATE_KEY   0x… session privkey (32 bytes hex)
 *                         OR
 *   PROVISIONING_SIGNATURE 0x… master signature + SESSION_INDEX (number)
 *
 * Optional env:
 *   RPC_URL               JSON-RPC endpoint (default: hardhat localhost)
 *   USE_LOCALHOST         "true" to use chain id 31337
 *
 * Add to Claude Code:
 *   claude mcp add iwallet bun run /abs/path/packages/backend/src/mcp/index.ts \
 *     -e IWALLET_ADDRESS=0x… -e SESSION_PRIVATE_KEY=0x…
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { localhost, zeroGTestnet } from "@iwallet/chains";
import {
  runTool,
  toolDefinitions,
  type SessionContext,
} from "../wallet/tools.ts";

// ── Config from env ─────────────────────────────────────────────

const env = process.env;

const iWalletAddress = env.IWALLET_ADDRESS as `0x${string}` | undefined;
if (!iWalletAddress) {
  console.error("[iwallet-mcp] IWALLET_ADDRESS env var is required");
  process.exit(1);
}

let privateKey: `0x${string}`;
if (env.SESSION_PRIVATE_KEY) {
  privateKey = env.SESSION_PRIVATE_KEY as `0x${string}`;
} else if (env.PROVISIONING_SIGNATURE) {
  const idx = Number(env.SESSION_INDEX ?? 0);
  privateKey = keccak256(
    toBytes(env.PROVISIONING_SIGNATURE + idx.toString(16).padStart(64, "0"))
  );
} else {
  console.error(
    "[iwallet-mcp] need SESSION_PRIVATE_KEY or PROVISIONING_SIGNATURE"
  );
  process.exit(1);
}

const chain = env.USE_LOCALHOST === "true" ? localhost : zeroGTestnet;
const rpcUrl = env.RPC_URL ?? chain.rpcUrls.default.http[0];

const ctx: SessionContext = { privateKey, iWalletAddress, chain, rpcUrl };

const sessionAddress = privateKeyToAccount(privateKey).address;
console.error(
  `[iwallet-mcp] session ${sessionAddress} → iWallet ${iWalletAddress} on ${chain.name}`
);

// ── MCP server ──────────────────────────────────────────────────

const server = new Server(
  { name: "iwallet", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  const out = await runTool(name, args, ctx);
  if (out.ok) {
    const text =
      typeof out.result === "string"
        ? out.result
        : JSON.stringify(out.result, null, 2);
    return { content: [{ type: "text", text }] };
  }
  return {
    content: [{ type: "text", text: out.error ?? "tool failed" }],
    isError: true,
  };
});

// ── Connect ─────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[iwallet-mcp] ready (stdio)");
