/**
 * Reads Ignition's per-chain `deployed_addresses.json` files and updates
 * `packages/chains/src/deployments.ts` so the FE/backend pick up the
 * factory address without a manual edit.
 *
 * Usage:
 *   bun run scripts/sync-deployments.ts
 *
 * Run after `bunx hardhat ignition deploy …`.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..", "..");
const ignitionRoot = resolve(
  repoRoot,
  "packages/contract/ignition/deployments"
);
const depsPath = resolve(repoRoot, "packages/chains/src/deployments.ts");

if (!existsSync(ignitionRoot)) {
  console.log("No ignition deployments directory yet — nothing to sync.");
  process.exit(0);
}

if (!existsSync(depsPath)) {
  console.error(`Missing ${depsPath}`);
  process.exit(1);
}

const updates: Array<{ chainId: number; address: string }> = [];

for (const dir of readdirSync(ignitionRoot)) {
  const m = dir.match(/^chain-(\d+)$/);
  if (!m) continue;
  const chainId = Number(m[1]);
  const file = resolve(ignitionRoot, dir, "deployed_addresses.json");
  if (!existsSync(file)) continue;
  const json = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  const addr =
    json["iWalletFactoryModule#iWalletFactory"] ??
    Object.values(json).find((v) => /^0x[0-9a-fA-F]{40}$/.test(v));
  if (!addr) continue;
  updates.push({ chainId, address: addr });
}

if (updates.length === 0) {
  console.log("No deployed factory addresses found in ignition state.");
  process.exit(0);
}

let content = readFileSync(depsPath, "utf8");
for (const { chainId, address } of updates) {
  const re = new RegExp(`(\\b${chainId}\\b\\s*:\\s*)"0x[0-9a-fA-F]+"`, "m");
  if (re.test(content)) {
    content = content.replace(re, `$1"${address}"`);
  } else {
    content = content.replace(
      /(export const FACTORY_ADDRESSES[\s\S]*?\{)([\s\S]*?)\n\};/m,
      (_full, head, body) =>
        `${head}${body}\n  ${chainId}: "${address}",\n};`
    );
  }
  console.log(`  ${chainId} → ${address}`);
}

writeFileSync(depsPath, content);
console.log(`\nUpdated ${depsPath}`);
