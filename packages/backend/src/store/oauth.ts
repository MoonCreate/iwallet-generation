import { db } from "./db.ts";

db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_clients (
    client_id        TEXT PRIMARY KEY,
    client_name      TEXT,
    redirect_uris    TEXT NOT NULL,             -- JSON array
    created_at       INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS oauth_authz_requests (
    auth_id          TEXT PRIMARY KEY,
    client_id        TEXT NOT NULL,
    redirect_uri     TEXT NOT NULL,
    state            TEXT,
    code_challenge   TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL,
    scope            TEXT,
    created_at       INTEGER NOT NULL,
    completed_at     INTEGER,
    auth_code        TEXT,                       -- set on completion
    bearer_token     TEXT                        -- the access token to issue
  );

  CREATE INDEX IF NOT EXISTS idx_oauth_auth_code
    ON oauth_authz_requests(auth_code) WHERE auth_code IS NOT NULL;
`);

export interface OAuthClient {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
}

export function registerClient(input: {
  clientName?: string;
  redirectUris: string[];
}): { client_id: string } {
  const client_id = `iw_${crypto.randomUUID()}`;
  db.prepare(
    `INSERT INTO oauth_clients (client_id, client_name, redirect_uris, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(
    client_id,
    input.clientName ?? null,
    JSON.stringify(input.redirectUris),
    Date.now()
  );
  return { client_id };
}

export function getClient(clientId: string): OAuthClient | null {
  const row = db
    .prepare(`SELECT * FROM oauth_clients WHERE client_id = ?`)
    .get(clientId) as
    | { client_id: string; client_name: string | null; redirect_uris: string }
    | undefined;
  if (!row) return null;
  return {
    client_id: row.client_id,
    client_name: row.client_name,
    redirect_uris: JSON.parse(row.redirect_uris) as string[],
  };
}

export interface AuthRequest {
  auth_id: string;
  client_id: string;
  redirect_uri: string;
  state: string | null;
  code_challenge: string;
  code_challenge_method: string;
  scope: string | null;
  created_at: number;
  completed_at: number | null;
  auth_code: string | null;
  bearer_token: string | null;
}

export function createAuthRequest(input: {
  client_id: string;
  redirect_uri: string;
  state?: string;
  code_challenge: string;
  code_challenge_method: string;
  scope?: string;
}): { auth_id: string } {
  const auth_id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO oauth_authz_requests
     (auth_id, client_id, redirect_uri, state, code_challenge,
      code_challenge_method, scope, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    auth_id,
    input.client_id,
    input.redirect_uri,
    input.state ?? null,
    input.code_challenge,
    input.code_challenge_method,
    input.scope ?? null,
    Date.now()
  );
  return { auth_id };
}

export function getAuthRequest(authId: string): AuthRequest | null {
  return (
    (db
      .prepare(`SELECT * FROM oauth_authz_requests WHERE auth_id = ?`)
      .get(authId) as AuthRequest | undefined) ?? null
  );
}

export function completeAuthRequest(input: {
  auth_id: string;
  bearer_token: string;
}): { auth_code: string } | null {
  const req = getAuthRequest(input.auth_id);
  if (!req || req.completed_at) return null;
  const auth_code = crypto.randomUUID();
  db.prepare(
    `UPDATE oauth_authz_requests
     SET completed_at = ?, auth_code = ?, bearer_token = ?
     WHERE auth_id = ?`
  ).run(Date.now(), auth_code, input.bearer_token, input.auth_id);
  return { auth_code };
}

export function consumeAuthCode(
  code: string
): { bearer_token: string; redirect_uri: string; code_challenge: string; code_challenge_method: string } | null {
  const row = db
    .prepare(
      `SELECT * FROM oauth_authz_requests
       WHERE auth_code = ? AND bearer_token IS NOT NULL`
    )
    .get(code) as AuthRequest | undefined;
  if (!row) return null;
  // single-use: clear auth_code so it can't be replayed
  db.prepare(
    `UPDATE oauth_authz_requests SET auth_code = NULL WHERE auth_id = ?`
  ).run(row.auth_id);
  return {
    bearer_token: row.bearer_token!,
    redirect_uri: row.redirect_uri,
    code_challenge: row.code_challenge,
    code_challenge_method: row.code_challenge_method,
  };
}
