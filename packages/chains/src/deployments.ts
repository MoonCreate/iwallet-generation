/**
 * Per-chain deployed addresses for iWalletFactory.
 *
 * Update this file after deploying with `bunx hardhat run scripts/deploy.ts
 * --network <network>`. The deploy script also writes deployments/<chainId>.json
 * for ops/automation; this file is the source of truth used by the FE/backend.
 *
 * Set to `0x0` for chains where the factory hasn't been deployed yet — the
 * UI will show "factory not deployed on this chain" with a switch-network
 * prompt.
 */

export const FACTORY_ADDRESSES: Record<number, `0x${string}`> = {
  // Hardhat local — set by `bun run --cwd packages/contract deploy:local`
  31337: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",

  // 0G Galileo Testnet
  16602: "0xd350F7C77333e0E1147811346d920887990d160D",

  // 0G Mainnet
  16661: "0x0",
};

export function getFactoryAddressForChain(
  chainId: number
): `0x${string}` | undefined {
  const addr = FACTORY_ADDRESSES[chainId];
  if (!addr || addr === "0x0") return undefined;
  return addr;
}
