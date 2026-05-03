/**
 * Streamable HTTP MCP endpoint at POST /mcp
 *
 * Speaks JSON-RPC 2.0 per the MCP spec. Each request authenticates via
 * `Authorization: Bearer <token>` against the SQLite session store.
 *
 * On missing/invalid bearer we return 401 with WWW-Authenticate pointing
 * at the dashboard, so Claude Code's "claude mcp add URL" flow surfaces
 * the auth URL to the user.
 *
 * No session-id semantics: each request is stateless from MCP's POV.
 * Tools live in wallet/tools.ts.
 */

import { Elysia } from "elysia";
import { localhost, zeroGTestnet } from "@iwallet/chains";
import { runTool, toolDefinitions } from "../wallet/tools.ts";
import { lookupSession } from "../store/sessions.ts";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL ?? "http://localhost:3001";
const PROTOCOL_VERSION = "2024-11-05";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function chainFor(chainId: number) {
  if (chainId === localhost.id) return localhost;
  return zeroGTestnet;
}

function rpcResult(id: string | number | null | undefined, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, data } };
}

async function dispatch(
  msg: JsonRpcRequest,
  bearer: string | null
): Promise<JsonRpcResponse | null> {
  // Notifications (no id) return null — no response sent
  const isNotification = msg.id === undefined || msg.id === null;

  switch (msg.method) {
    case "initialize":
      return rpcResult(msg.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "iwallet", version: "0.1.0" },
      });

    case "notifications/initialized":
    case "notifications/cancelled":
      return null;

    case "ping":
      return rpcResult(msg.id, {});

    case "tools/list": {
      if (!bearer) {
        return rpcError(msg.id, -32001, "unauthenticated", {
          authUrl: `${FRONTEND_URL}/connect`,
        });
      }
      const sess = lookupSession(bearer);
      if (!sess) {
        return rpcError(msg.id, -32001, "invalid bearer", {
          authUrl: `${FRONTEND_URL}/connect`,
        });
      }
      return rpcResult(msg.id, {
        tools: toolDefinitions.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.input_schema,
        })),
      });
    }

    case "tools/call": {
      if (!bearer) {
        return rpcError(
          msg.id,
          -32001,
          "unauthenticated",
          { authUrl: `${FRONTEND_URL}/connect` }
        );
      }
      const sess = lookupSession(bearer);
      if (!sess) {
        return rpcError(
          msg.id,
          -32001,
          "invalid bearer",
          { authUrl: `${FRONTEND_URL}/connect` }
        );
      }
      const { name, arguments: args } = msg.params as {
        name: string;
        arguments: Record<string, unknown>;
      };
      const out = await runTool(name, args ?? {}, {
        privateKey: sess.privateKey,
        iWalletAddress: sess.iWalletAddress,
        chain: chainFor(sess.chainId),
        rpcUrl:
          process.env.RPC_URL ??
          chainFor(sess.chainId).rpcUrls.default.http[0],
      });
      if (out.ok) {
        const text =
          typeof out.result === "string"
            ? out.result
            : JSON.stringify(out.result, null, 2);
        return rpcResult(msg.id, {
          content: [{ type: "text", text }],
        });
      }
      return rpcResult(msg.id, {
        content: [{ type: "text", text: out.error ?? "tool failed" }],
        isError: true,
      });
    }

    default:
      if (isNotification) return null;
      return rpcError(msg.id, -32601, `method not found: ${msg.method}`);
  }
}

export const mcpRoutes = new Elysia()
  // Some clients probe with GET — return method-not-allowed JSON.
  .get("/mcp", ({ set }) => {
    set.status = 405;
    set.headers["allow"] = "POST";
    return { error: "use POST for MCP requests" };
  })
  .post("/mcp", async ({ body, headers, set }) => {
    const auth = headers.authorization;
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

    // Top-level auth gate for tools/call only — MCP allows
    // initialize/list without auth so 401 Bears the browser auth flow.
    const msgs = Array.isArray(body) ? body : [body];

    // Top-level auth challenge: any non-initialize/non-notification call
    // requires bearer. Returning 401 + WWW-Authenticate triggers OAuth
    // discovery in MCP clients (Claude Code, etc).
    const requiresAuth = msgs.some((m) => {
      const method = (m as JsonRpcRequest)?.method;
      return (
        method === "tools/list" ||
        method === "tools/call" ||
        method === "resources/list" ||
        method === "resources/read" ||
        method === "prompts/list" ||
        method === "prompts/get"
      );
    });
    if (requiresAuth && !bearer) {
      set.status = 401;
      set.headers["www-authenticate"] =
        `Bearer realm="iwallet", resource_metadata="${PUBLIC_BASE}/.well-known/oauth-protected-resource"`;
      set.headers["content-type"] = "application/json";
      return {
        error: "unauthenticated",
        message: "Bearer token required. See OAuth metadata to authenticate.",
        auth_url: `${FRONTEND_URL}/connect`,
      };
    }

    // Dispatch all messages, keep order.
    const responses: JsonRpcResponse[] = [];
    for (const m of msgs) {
      const r = await dispatch(m as JsonRpcRequest, bearer);
      if (r) responses.push(r);
    }

    set.headers["content-type"] = "application/json";
    return Array.isArray(body) ? responses : (responses[0] ?? null);
  });
