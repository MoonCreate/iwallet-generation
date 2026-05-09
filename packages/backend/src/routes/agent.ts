import { Elysia, t } from "elysia";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { runAgentChat, type ChatMessage } from "../agent/index.ts";
import { getEvents, startIndexer } from "../indexer/index.ts";
import { defaultChainId, pickChain } from "@iwallet/chains";

interface AgentSession {
  privateKey: `0x${string}`;
  iWalletAddress: `0x${string}`;
  chainId: number;
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
      const { signature, index, iWalletAddress, chainId } = body;
      const resolvedChainId = chainId ?? defaultChainId();
      const chain = pickChain(resolvedChainId);
      const rpcUrl = chain.rpcUrls.default.http[0];

      const privateKey = deriveSessionPrivateKey(
        signature as `0x${string}`,
        index ?? 0
      );
      const account = privateKeyToAccount(privateKey);
      const sessionId = crypto.randomUUID();

      sessions.set(sessionId, {
        privateKey,
        iWalletAddress: iWalletAddress as `0x${string}`,
        chainId: resolvedChainId,
      });

      startIndexer(iWalletAddress as `0x${string}`, chain, rpcUrl);

      return {
        sessionId,
        sessionAddress: account.address,
        chainId: resolvedChainId,
      };
    },
    {
      body: t.Object({
        signature: t.String(),
        index: t.Optional(t.Number()),
        iWalletAddress: t.String(),
        chainId: t.Optional(t.Number()),
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

      const chain = pickChain(session.chainId);
      const rpcUrl = chain.rpcUrls.default.http[0];
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
                rpcUrl,
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
