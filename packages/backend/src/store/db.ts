import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH ?? "./data/iwallet.db";

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`PRAGMA foreign_keys = ON;`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    bearer_hash       TEXT PRIMARY KEY,
    iwallet_address   TEXT NOT NULL,
    session_address   TEXT NOT NULL,
    private_key_enc   TEXT NOT NULL,
    chain_id          INTEGER NOT NULL,
    label             TEXT,
    created_at        INTEGER NOT NULL,
    last_used_at      INTEGER,
    revoked_at        INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_iwallet ON sessions(iwallet_address);
`);

export interface SessionRow {
  bearer_hash: string;
  iwallet_address: string;
  session_address: string;
  private_key_enc: string;
  chain_id: number;
  label: string | null;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}
