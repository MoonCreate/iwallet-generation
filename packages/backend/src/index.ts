import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { agentRoutes } from "./routes/agent.ts";
import { mcpRoutes } from "./routes/mcp.ts";
import { oauthRoutes } from "./routes/oauth.ts";
import { walletRoutes } from "./routes/wallet.ts";
import { startVerifier } from "./verifier/index.ts";

const PORT = Number(process.env.PORT) || 3001;

const allowedOrigins = (
  process.env.CORS_ORIGIN ??
  "http://localhost:3000,https://wallet.goon4.site"
)
  .split(",")
  .map((s) => s.trim());

const app = new Elysia()
  .use(
    cors({
      origin: allowedOrigins,
      allowedHeaders: ["content-type", "authorization", "mcp-session-id"],
      credentials: true,
    })
  )
  .get("/health", () => ({ status: "ok", timestamp: Date.now() }))
  .use(oauthRoutes)
  .use(mcpRoutes)
  .use(walletRoutes)
  .use(agentRoutes)
  .listen(PORT);

console.log(`iWallet backend running at http://localhost:${PORT}`);
console.log(`  /mcp           — Streamable HTTP MCP (POST)`);
console.log(`  /api/wallet/*  — provisioning + tools (REST)`);

// Auto-verify newly-deployed iWallets on supported chains. Fire-and-forget
// per event; failures log and don't kill the backend. See verifier/ for
// the per-chain watcher + Etherscan-API submit logic.
startVerifier();

export type App = typeof app;
