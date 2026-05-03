import { Elysia, t } from "elysia";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { runAgentChat, type ChatMessage } from "../agent/index.ts";
import { getEvents, startIndexer } from "../indexer/index.ts";
import { localhost, zeroGTestnet } from "@iwallet/chains";

const chain = process.env.USE_LOCALHOST === "true" ? localhost : zeroGTestnet;
const RPC_URL = process.env.RPC_URL ?? chain.rpcUrls.default.http[0];

interface AgentSession {
  privateKey: `0x${string}`;
  iWalletAddress: `0x${string}`;
}

const sessions = new Map<string, AgentSession>();

function deriveSessionPrivateKey(
  signature: `0x${string}`,
  index: number
): `0x${string}` {
  return keccak256(
    toBytes(signature + index.toString(16).padStart(64, "0"))
  );
}

export const agentRoutes = new Elysia({ prefix: "/api/agent" })
  .post(
    "/derive",
    async ({ body }) => {
      const { signature, index } = body;
      const privateKey = deriveSessionPrivateKey(
        signature as `0x${string}`,
        index
      );
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

  .post(
    "/session",
    async ({ body }) => {
      const { signature, index, iWalletAddress } = body;
      const privateKey = deriveSessionPrivateKey(
        signature as `0x${string}`,
        index ?? 0
      );
      const account = privateKeyToAccount(privateKey);
      const sessionId = crypto.randomUUID();

      sessions.set(sessionId, {
        privateKey,
        iWalletAddress: iWalletAddress as `0x${string}`,
      });

      startIndexer(iWalletAddress as `0x${string}`, chain, RPC_URL);

      return { sessionId, sessionAddress: account.address };
    },
    {
      body: t.Object({
        signature: t.String(),
        index: t.Optional(t.Number()),
        iWalletAddress: t.String(),
      }),
    }
  )

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

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            const generator = runAgentChat(
              messages as ChatMessage[],
              {
                privateKey: session.privateKey,
                iWalletAddress: session.iWalletAddress,
                chain,
                rpcUrl: RPC_URL,
              },
              apiKey
            );

            for await (const event of generator) {
              const data = JSON.stringify(event);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
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

  .get("/events/:walletAddress", ({ params }) => {
    return getEvents(params.walletAddress);
  })

  .delete("/session/:sessionId", ({ params }) => {
    sessions.delete(params.sessionId);
    return { ok: true };
  });
