import { Elysia, t } from "elysia";
import { createHash } from "node:crypto";
import {
  registerClient,
  getClient,
  createAuthRequest,
  consumeAuthCode,
  completeAuthRequest,
  getAuthRequest,
} from "../store/oauth.ts";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL ?? "http://localhost:3001";

function pkceVerify(verifier: string, challenge: string, method: string): boolean {
  if (method === "plain") return verifier === challenge;
  if (method === "S256") {
    const hash = createHash("sha256").update(verifier).digest();
    // base64url
    const expected = hash
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return expected === challenge;
  }
  return false;
}

export const oauthRoutes = new Elysia()
  // ── RFC 9728: Protected Resource Metadata ─────────────────────
  .get(
    "/.well-known/oauth-protected-resource",
    () => ({
      resource: `${PUBLIC_BASE}/mcp`,
      authorization_servers: [PUBLIC_BASE],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp"],
    })
  )
  .get(
    "/.well-known/oauth-protected-resource/mcp",
    () => ({
      resource: `${PUBLIC_BASE}/mcp`,
      authorization_servers: [PUBLIC_BASE],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp"],
    })
  )

  // ── RFC 8414: Authorization Server Metadata ───────────────────
  .get(
    "/.well-known/oauth-authorization-server",
    () => ({
      issuer: PUBLIC_BASE,
      authorization_endpoint: `${PUBLIC_BASE}/oauth/authorize`,
      token_endpoint: `${PUBLIC_BASE}/oauth/token`,
      registration_endpoint: `${PUBLIC_BASE}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256", "plain"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
    })
  )

  // ── RFC 7591: Dynamic Client Registration ─────────────────────
  .post("/oauth/register", async ({ body, set }) => {
    const b = body as {
      client_name?: string;
      redirect_uris?: string[];
    };
    if (!b.redirect_uris || b.redirect_uris.length === 0) {
      set.status = 400;
      return { error: "invalid_redirect_uri" };
    }
    const reg = registerClient({
      clientName: b.client_name,
      redirectUris: b.redirect_uris,
    });
    return {
      client_id: reg.client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: b.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    };
  })

  // ── /oauth/authorize ──────────────────────────────────────────
  // GET: redirect user-agent to frontend /connect with auth_id
  .get("/oauth/authorize", ({ query, set }) => {
    const q = query as {
      response_type?: string;
      client_id?: string;
      redirect_uri?: string;
      state?: string;
      code_challenge?: string;
      code_challenge_method?: string;
      scope?: string;
    };
    if (q.response_type !== "code") {
      set.status = 400;
      return { error: "unsupported_response_type" };
    }
    if (!q.client_id || !q.redirect_uri || !q.code_challenge) {
      set.status = 400;
      return { error: "invalid_request" };
    }
    const client = getClient(q.client_id);
    if (!client) {
      set.status = 400;
      return { error: "invalid_client" };
    }
    if (!client.redirect_uris.includes(q.redirect_uri)) {
      set.status = 400;
      return { error: "invalid_redirect_uri" };
    }
    const { auth_id } = createAuthRequest({
      client_id: q.client_id,
      redirect_uri: q.redirect_uri,
      state: q.state,
      code_challenge: q.code_challenge,
      code_challenge_method: q.code_challenge_method ?? "plain",
      scope: q.scope,
    });
    const target = new URL(`${FRONTEND_URL}/connect`);
    target.searchParams.set("auth_id", auth_id);
    return new Response(null, {
      status: 302,
      headers: { location: target.toString() },
    });
  })

  // POST /oauth/authorize/complete (called by frontend with bearer)
  .post(
    "/oauth/authorize/complete",
    ({ body, set }) => {
      const b = body as { auth_id?: string; bearer_token?: string };
      if (!b.auth_id || !b.bearer_token) {
        set.status = 400;
        return { error: "invalid_request" };
      }
      const req = getAuthRequest(b.auth_id);
      if (!req) {
        set.status = 404;
        return { error: "auth_request_not_found" };
      }
      const out = completeAuthRequest({
        auth_id: b.auth_id,
        bearer_token: b.bearer_token,
      });
      if (!out) {
        set.status = 409;
        return { error: "already_completed" };
      }
      const redirect = new URL(req.redirect_uri);
      redirect.searchParams.set("code", out.auth_code);
      if (req.state) redirect.searchParams.set("state", req.state);
      return { redirect_uri: redirect.toString() };
    },
    {
      body: t.Object({
        auth_id: t.String(),
        bearer_token: t.String(),
      }),
    }
  )

  // ── /oauth/token ──────────────────────────────────────────────
  .post("/oauth/token", async ({ request, set }) => {
    // Per RFC 6749 §4.1.3 token endpoint accepts form-encoded body
    const ct = request.headers.get("content-type") ?? "";
    let params: Record<string, string>;
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      params = Object.fromEntries(new URLSearchParams(text));
    } else {
      params = (await request.json()) as Record<string, string>;
    }
    const grant_type = params.grant_type;
    if (grant_type !== "authorization_code") {
      set.status = 400;
      return { error: "unsupported_grant_type" };
    }
    const code = params.code;
    const verifier = params.code_verifier;
    if (!code || !verifier) {
      set.status = 400;
      return { error: "invalid_request" };
    }
    const consumed = consumeAuthCode(code);
    if (!consumed) {
      set.status = 400;
      return { error: "invalid_grant" };
    }
    if (
      !pkceVerify(verifier, consumed.code_challenge, consumed.code_challenge_method)
    ) {
      set.status = 400;
      return { error: "invalid_grant", error_description: "PKCE failed" };
    }
    return {
      access_token: consumed.bearer_token,
      token_type: "Bearer",
      scope: "mcp",
    };
  });
