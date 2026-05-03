import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { db, type SessionRow } from "./db.ts";

// Symmetric key for at-rest encryption of session privkeys.
// In prod set IWALLET_DB_KEY (32-byte hex). For local dev a deterministic
// fallback is used so the DB stays decryptable across restarts.
const KEY_HEX =
  process.env.IWALLET_DB_KEY ??
  "0000000000000000000000000000000000000000000000000000000000000000";
if (KEY_HEX.length !== 64) {
  throw new Error("IWALLET_DB_KEY must be 32 bytes hex (64 chars)");
}
const KEY = Buffer.from(KEY_HEX, "hex");

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

function decrypt(blob: string): string {
  const [ivHex, tagHex, ctHex] = blob.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function hashBearer(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreateSessionInput {
  bearerToken: string;
  iWalletAddress: string;
  sessionAddress: string;
  privateKey: string;
  chainId: number;
  label?: string;
}

export interface SessionRecord {
  iWalletAddress: `0x${string}`;
  sessionAddress: `0x${string}`;
  privateKey: `0x${string}`;
  chainId: number;
  label: string | null;
  createdAt: number;
}

export function createSession(input: CreateSessionInput) {
  // Rotate: any prior, non-revoked bearer for this (iwallet, session) is
  // marked revoked so only the newest token works. Keeps the table tidy.
  db.prepare(
    `UPDATE sessions
       SET revoked_at = ?
     WHERE iwallet_address = ?
       AND session_address = ?
       AND revoked_at IS NULL`
  ).run(
    Date.now(),
    input.iWalletAddress.toLowerCase(),
    input.sessionAddress.toLowerCase()
  );
  db.prepare(
    `INSERT OR REPLACE INTO sessions
       (bearer_hash, iwallet_address, session_address, private_key_enc,
        chain_id, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    hashBearer(input.bearerToken),
    input.iWalletAddress.toLowerCase(),
    input.sessionAddress.toLowerCase(),
    encrypt(input.privateKey),
    input.chainId,
    input.label ?? null,
    Date.now()
  );
}

/// Revoke every active bearer for a (iwallet, session) pair — used when
/// the master calls revokeSession on chain so bearers stop being honored.
export function revokeBearersForSession(
  iWalletAddress: string,
  sessionAddress: string
) {
  db.prepare(
    `UPDATE sessions
       SET revoked_at = ?
     WHERE iwallet_address = ?
       AND session_address = ?
       AND revoked_at IS NULL`
  ).run(
    Date.now(),
    iWalletAddress.toLowerCase(),
    sessionAddress.toLowerCase()
  );
}

export function lookupSession(bearerToken: string): SessionRecord | null {
  const row = db
    .prepare(
      `SELECT * FROM sessions WHERE bearer_hash = ? AND revoked_at IS NULL`
    )
    .get(hashBearer(bearerToken)) as SessionRow | undefined;
  if (!row) return null;
  // touch last_used_at
  db.prepare(`UPDATE sessions SET last_used_at = ? WHERE bearer_hash = ?`).run(
    Date.now(),
    row.bearer_hash
  );
  return {
    iWalletAddress: row.iwallet_address as `0x${string}`,
    sessionAddress: row.session_address as `0x${string}`,
    privateKey: decrypt(row.private_key_enc) as `0x${string}`,
    chainId: row.chain_id,
    label: row.label,
    createdAt: row.created_at,
  };
}

export function revokeSession(bearerToken: string) {
  db.prepare(
    `UPDATE sessions SET revoked_at = ? WHERE bearer_hash = ?`
  ).run(Date.now(), hashBearer(bearerToken));
}

export function listSessionsForWallet(iWallet: string): Array<{
  sessionAddress: string;
  label: string | null;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}> {
  return db
    .prepare(
      `SELECT session_address, label, created_at, last_used_at, revoked_at
       FROM sessions WHERE iwallet_address = ?
       ORDER BY created_at DESC`
    )
    .all(iWallet.toLowerCase())
    .map((r) => {
      const row = r as Pick<
        SessionRow,
        "session_address" | "label" | "created_at" | "last_used_at" | "revoked_at"
      >;
      return {
        sessionAddress: row.session_address,
        label: row.label,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
        revokedAt: row.revoked_at,
      };
    });
}
