import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import { db } from "./db.ts";
import type { ChatMessage } from "../agent/index.ts";

// ── Config ──────────────────────────────────────────────────────
const ZG_RPC = process.env.ZG_RPC ?? "https://evmrpc.0g.ai";
const ZG_INDEXER =
  process.env.ZG_INDEXER ?? "https://indexer-storage-turbo.0g.ai";
const ZG_PRIVATE_KEY = process.env.ZG_PRIVATE_KEY;

// ── DB schema ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS zg_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    iwallet_address TEXT NOT NULL,
    root_hash       TEXT NOT NULL,
    summary         TEXT,
    message_count   INTEGER NOT NULL,
    created_at      INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_zg_iwallet ON zg_history(iwallet_address);
`);

export interface ZgHistoryRow {
  id: number;
  iwallet_address: string;
  root_hash: string;
  summary: string | null;
  message_count: number;
  created_at: number;
}

// ── Singleton clients ───────────────────────────────────────────
let indexer: Indexer | null = null;
let signer: ethers.Wallet | null = null;

function getClients() {
  if (!ZG_PRIVATE_KEY) return null;
  if (!indexer) {
    const provider = new ethers.JsonRpcProvider(ZG_RPC);
    signer = new ethers.Wallet(ZG_PRIVATE_KEY, provider);
    indexer = new Indexer(ZG_INDEXER);
  }
  return { indexer: indexer!, signer: signer! };
}

export function isZgEnabled(): boolean {
  return !!ZG_PRIVATE_KEY;
}

// ── Upload conversation to 0G Storage ───────────────────────────
export async function uploadConversation(
  iWalletAddress: string,
  messages: ChatMessage[]
): Promise<string | null> {
  const clients = getClients();
  if (!clients || messages.length === 0) return null;

  const payload = JSON.stringify({
    wallet: iWalletAddress,
    timestamp: Date.now(),
    messages,
  });

  const data = new TextEncoder().encode(payload);
  const memData = new MemData(data);
  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr) {
    console.error("[0G] merkleTree error:", treeErr);
    return null;
  }

  const [tx, uploadErr] = await (clients.indexer as any).upload(
    memData,
    ZG_RPC,
    clients.signer as any
  );
  if (uploadErr) {
    console.error("[0G] upload error:", uploadErr);
    return null;
  }

  const rootHash: string = (tx as any).rootHash ?? (tx as any).rootHashes?.[0];
  if (!rootHash) return null;

  // Generate a short summary from last user message
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const summary = lastUser?.content.slice(0, 120) ?? null;

  db.run(
    `INSERT INTO zg_history (iwallet_address, root_hash, summary, message_count, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [iWalletAddress.toLowerCase(), rootHash, summary, messages.length, Date.now()]
  );

  console.log(`[0G] Uploaded ${messages.length} msgs → ${rootHash}`);
  return rootHash;
}

// ── Download conversation from 0G Storage ───────────────────────
export async function downloadConversation(
  rootHash: string
): Promise<ChatMessage[] | null> {
  const clients = getClients();
  if (!clients) return null;

  try {
    const tmpPath = `/tmp/zg_${rootHash.slice(2, 18)}_${Date.now()}.json`;
    const err = await (clients.indexer as any).download(rootHash, tmpPath, false);
    if (err) {
      console.error("[0G] download error:", err);
      return null;
    }
    const raw = await Bun.file(tmpPath).text();
    // Cleanup
    try { await Bun.file(tmpPath).unlink?.() } catch {}
    const parsed = JSON.parse(raw);
    return parsed.messages as ChatMessage[];
  } catch (e) {
    console.error("[0G] download error:", e);
    return null;
  }
}

// ── Get history entries for a wallet ────────────────────────────
export function getHistory(iWalletAddress: string): ZgHistoryRow[] {
  return db
    .query(
      `SELECT * FROM zg_history WHERE iwallet_address = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(iWalletAddress.toLowerCase()) as ZgHistoryRow[];
}

// ── Get latest conversation context for agent prompt ────────────
export async function getLatestContext(
  iWalletAddress: string
): Promise<string | null> {
  const rows = db
    .query(
      `SELECT root_hash, summary, message_count, created_at FROM zg_history
       WHERE iwallet_address = ? ORDER BY created_at DESC LIMIT 3`
    )
    .all(iWalletAddress.toLowerCase()) as ZgHistoryRow[];

  if (rows.length === 0) return null;

  // Build a summary string for the agent
  const lines = rows.map((r) => {
    const date = new Date(r.created_at).toISOString();
    return `- [${date}] ${r.message_count} messages: "${r.summary ?? "..."}"`;
  });

  return `Previous conversations for this wallet:\n${lines.join("\n")}`;
}
