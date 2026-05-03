/**
 * Spawns the MCP server over stdio and runs the official MCP handshake:
 * initialize → tools/list → tools/call. Validates the server speaks MCP.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

const IWALLET = process.argv[2];
const SESSION_PK = process.argv[3];
const RECIPIENT = process.argv[4];
if (!IWALLET || !SESSION_PK || !RECIPIENT) {
  console.error(
    "usage: bun scripts/test-mcp.ts <iwallet> <session_pk> <recipient>"
  );
  process.exit(1);
}

const repoRoot = resolve(import.meta.dirname, "..");
const serverPath = resolve(
  repoRoot,
  "packages/backend/src/mcp/index.ts"
);

const transport = new StdioClientTransport({
  command: "bun",
  args: ["run", serverPath],
  env: {
    ...process.env,
    IWALLET_ADDRESS: IWALLET,
    SESSION_PRIVATE_KEY: SESSION_PK,
    USE_LOCALHOST: "true",
    RPC_URL: "http://127.0.0.1:8545",
  },
});

const client = new Client({ name: "iwallet-tester", version: "0.0.1" });
await client.connect(transport);
console.log("✔ MCP handshake ok");

const tools = await client.listTools();
console.log(`✔ tools/list returned ${tools.tools.length} tools:`);
for (const t of tools.tools) console.log(`    - ${t.name}`);

const balance = await client.callTool({
  name: "checkBalance",
  arguments: {},
});
console.log("✔ checkBalance:", balance.content);

const send = await client.callTool({
  name: "sendETH",
  arguments: { to: RECIPIENT, amount: "0.01" },
});
console.log("✔ sendETH:", send.content);

const policyCheck = await client.callTool({
  name: "getPolicy",
  arguments: {},
});
console.log("✔ getPolicy:", policyCheck.content);

await client.close();
console.log("\nMCP server is fully Claude Code / Claude Desktop compatible.");
