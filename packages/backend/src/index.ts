import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { agentRoutes } from "./routes/agent.ts";

const PORT = Number(process.env.PORT) || 3001;

const app = new Elysia()
  .use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }))
  .get("/health", () => ({ status: "ok", timestamp: Date.now() }))
  .use(agentRoutes)
  .listen(PORT);

console.log(`iWallet backend running at http://localhost:${PORT}`);

export type App = typeof app;
