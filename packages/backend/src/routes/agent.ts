import { Elysia, t } from "elysia";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { runAgentChat, type ChatMessage } from "../agent/index.ts";
import { getEvents, startIndexer } from "../indexer/index.ts";
import { localhost, zeroGTestnet, POLICY_PROXY_ABI } from "@iwallet/chains";

const chain = process.env.USE_LOCALHOST === "true" ? localhost : zeroGTestnet;
const RPC_URL = process.env.RPC_URL ?? chain.rpcUrls.default.http[0];

// In-memory session store: sessionId → { privateKey, proxyAddress }
const sessions = new Map<
  string,
  { privateKey: `0x${string}`; proxyAddress: `0x${string}` }
>();

export const agentRoutes = new Elysia({ prefix: "/api/agent" })
  // Derive iWallet address from a signature (for display only)
  .post(
    "/derive",
    async ({ body }) => {
      const { signature, index } = body;
      // Use first 32 bytes of signature as deterministic private key
      const privateKey = signature.slice(0, 66) as `0x${string}`;
      const account = privateKeyToAccount(privateKey);
      return { address: account.address, index };
    },
    {
      body: t.Object({
        signature: t.String(),
        index: t.Number(),
      }),
    }
  )

  // Start an agent session — stores private key in memory
  .post(
    "/session",
    async ({ body }) => {
      const { signature, proxyAddress } = body;
      const privateKey = signature.slice(0, 66) as `0x${string}`;
      const account = privateKeyToAccount(privateKey);
      const sessionId = crypto.randomUUID();

      sessions.set(sessionId, {
        privateKey,
        proxyAddress: proxyAddress as `0x${string}`,
      });

      // Start indexer for this proxy
      startIndexer(proxyAddress as `0x${string}`, chain, RPC_URL);

      return { sessionId, agentAddress: account.address };
    },
    {
      body: t.Object({
        signature: t.String(),
        proxyAddress: t.String(),
      }),
    }
  )

  // Chat with the AI agent — returns SSE stream
  .post(
    "/chat",
    async ({ body, set }) => {
      const { sessionId, messages } = body;
      const session = sessions.get(sessionId);

      if (!session) {
        set.status = 401;
        return { error: "Invalid session" };
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        set.status = 500;
        return { error: "OPENAI_API_KEY not configured" };
      }

      // Return SSE stream
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            const generator = runAgentChat(
              messages as ChatMessage[],
              {
                privateKey: session.privateKey,
                proxyAddress: session.proxyAddress,
                chain,
                rpcUrl: RPC_URL,
              },
              apiKey
            );

            for await (const event of generator) {
              const data = JSON.stringify(event);
              controller.enqueue(
                encoder.encode(`data: ${data}\n\n`)
              );
            }
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : String(err);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", content: msg })}\n\n`
              )
            );
          } finally {
            controller.close();
          }
        },
      });

      set.headers["content-type"] = "text/event-stream";
      set.headers["cache-control"] = "no-cache";
      set.headers["connection"] = "keep-alive";

      return stream;
    },
    {
      body: t.Object({
        sessionId: t.String(),
        messages: t.Array(
          t.Object({
            role: t.Union([t.Literal("user"), t.Literal("assistant")]),
            content: t.String(),
          })
        ),
      }),
    }
  )

  // Get indexed events for a proxy
  .get(
    "/events/:proxyAddress",
    ({ params }) => {
      return getEvents(params.proxyAddress);
    }
  )

  // End session
  .delete(
    "/session/:sessionId",
    ({ params }) => {
      sessions.delete(params.sessionId);
      return { ok: true };
    }
  );
