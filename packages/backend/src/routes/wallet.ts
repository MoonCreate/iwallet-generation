import { Elysia, t } from "elysia";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { localhost, zeroGTestnet } from "@iwallet/chains";
import { runTool, toolDefinitions, type SessionContext } from "../wallet/tools.ts";
import {
  createSession,
  lookupSession,
  revokeSession,
  revokeBearersForSession,
  listSessionsForWallet,
} from "../store/sessions.ts";

const defaultChain =
  process.env.USE_LOCALHOST === "true" ? localhost : zeroGTestnet;
const RPC_URL = process.env.RPC_URL ?? defaultChain.rpcUrls.default.http[0];

function deriveSessionPrivateKey(
  signature: `0x${string}`,
  index: number
): `0x${string}` {
  return keccak256(
    toBytes(signature + index.toString(16).padStart(64, "0"))
  );
}

function bearerFromHeaders(
  headers: Record<string, string | undefined>
): string | null {
  const auth = headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function ctxFromBearer(bearer: string): SessionContext | null {
  const sess = lookupSession(bearer);
  if (!sess) return null;
  const chain = sess.chainId === localhost.id ? localhost : zeroGTestnet;
  return {
    privateKey: sess.privateKey,
    iWalletAddress: sess.iWalletAddress,
    chain,
    rpcUrl: RPC_URL,
  };
}

export const walletRoutes = new Elysia({ prefix: "/api/wallet" })
  .get("/tools", () => ({ tools: toolDefinitions }))

  .post(
    "/provision",
    async ({ body }) => {
      const { signature, index, iWalletAddress, label, chainId } = body;
      const privateKey = deriveSessionPrivateKey(
        signature as `0x${string}`,
        index
      );
      const account = privateKeyToAccount(privateKey);
      const bearerToken = crypto.randomUUID();
      createSession({
        bearerToken,
        iWalletAddress: iWalletAddress as string,
        sessionAddress: account.address,
        privateKey,
        chainId: chainId ?? defaultChain.id,
        label: label,
      });
      return {
        bearerToken,
        sessionAddress: account.address,
        iWalletAddress,
        chainId: chainId ?? defaultChain.id,
      };
    },
    {
      body: t.Object({
        signature: t.String(),
        index: t.Number(),
        iWalletAddress: t.String(),
        chainId: t.Optional(t.Number()),
        label: t.Optional(t.String()),
      }),
    }
  )

  .delete("/session", ({ headers }) => {
    const bearer = bearerFromHeaders(headers);
    if (bearer) revokeSession(bearer);
    return { ok: true };
  })

  .get("/sessions/:iWalletAddress", ({ params }) => ({
    sessions: listSessionsForWallet(params.iWalletAddress),
  }))

  // Master-side hook: after they call revokeSession on chain, kill the
  // matching bearer(s) so the agent's MCP token can't be used.
  .post(
    "/sessions/:iWalletAddress/:sessionAddress/revoke-bearers",
    ({ params }) => {
      revokeBearersForSession(params.iWalletAddress, params.sessionAddress);
      return { ok: true };
    }
  )

  .post(
    "/tool/:name",
    async ({ params, body, headers, set }) => {
      const bearer = bearerFromHeaders(headers);
      if (!bearer) {
        set.status = 401;
        return { ok: false, error: "missing bearer" };
      }
      const ctx = ctxFromBearer(bearer);
      if (!ctx) {
        set.status = 401;
        return { ok: false, error: "invalid bearer" };
      }
      const out = await runTool(
        params.name,
        body as Record<string, unknown>,
        ctx
      );
      if (!out.ok) set.status = 400;
      return out;
    },
    {
      body: t.Record(t.String(), t.Any()),
      params: t.Object({ name: t.String() }),
    }
  );
