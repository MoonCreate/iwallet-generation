import { defineChain } from "viem";
import {
  zeroGMainnet as mainnetBase,
  zeroGTestnet as testnetBase,
  hardhat as hardhatBase,
} from "viem/chains";
import { FACTORY_ADDRESSES, getFactoryAddressForChain } from "./deployments.ts";

export { FACTORY_ADDRESSES, getFactoryAddressForChain };

export const zeroGMainnet = defineChain({
  ...mainnetBase,
  contracts: {
    ...mainnetBase.contracts,
    iWalletFactory: {
      address: FACTORY_ADDRESSES[mainnetBase.id] ?? ("0x0" as `0x${string}`),
      blockCreated: 0,
    },
  },
});

export const zeroGTestnet = defineChain({
  ...testnetBase,
  contracts: {
    ...testnetBase.contracts,
    iWalletFactory: {
      address: FACTORY_ADDRESSES[testnetBase.id] ?? ("0x0" as `0x${string}`),
      blockCreated: 0,
    },
  },
});

export const localhost = defineChain({
  ...hardhatBase,
  contracts: {
    iWalletFactory: {
      address: FACTORY_ADDRESSES[hardhatBase.id] ?? ("0x0" as `0x${string}`),
      blockCreated: 0,
    },
  },
});

export const SUPPORTED_CHAINS = [zeroGMainnet, zeroGTestnet, localhost] as const;

/**
 * Etherscan-compatible verification API URLs per chainId. Used by the
 * backend's auto-verifier to submit fresh BeaconProxy wallet bytecode
 * for source verification when factory.Deployed fires.
 *
 * 0G ChainScan exposes the Etherscan API at /open/api on both nets.
 * Localhost has no explorer; key absent → verifier skips that chain.
 */
export const EXPLORER_API_URLS: Record<number, string> = {
  [zeroGTestnet.id]: "https://chainscan-galileo.0g.ai/open/api",
  [zeroGMainnet.id]: "https://chainscan.0g.ai/open/api",
};

/**
 * Resolve a chainId to one of the supported viem chain objects.
 * Throws if the chainId isn't supported — surface this as a clear error to the
 * caller rather than silently defaulting to testnet (which masks bugs and can
 * route mainnet traffic to testnet RPC by accident).
 */
export function pickChain(chainId: number) {
  for (const c of SUPPORTED_CHAINS) {
    if (c.id === chainId) return c;
  }
  throw new Error(
    `pickChain: unsupported chainId ${chainId} (supported: ${SUPPORTED_CHAINS.map(
      (c) => c.id
    ).join(", ")})`
  );
}

/**
 * Default chainId for endpoints that don't yet know which chain the user is on
 * (e.g. provisioning a session before the FE has resolved their connected
 * wallet's chain). Reads from the `DEFAULT_CHAIN_ID` env var; falls back to
 * 0G Galileo testnet (16602). Set `DEFAULT_CHAIN_ID=16661` on a mainnet-only
 * deploy.
 */
export function defaultChainId(): number {
  const raw =
    typeof process !== "undefined" ? process.env?.DEFAULT_CHAIN_ID : undefined;
  if (!raw) return zeroGTestnet.id;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return zeroGTestnet.id;
  return parsed;
}

export { IWALLET_ABI, IWALLET_FACTORY_ABI } from "./abi.ts";

/**
 * Pre-extracted Solidity Standard JSON Input + compiler metadata for
 * verifying any user's BeaconProxy iWallet on an Etherscan-compatible
 * explorer. Identical bytecode + constructor shape for every wallet from
 * the factory (only the beacon address differs per chain), so this asset
 * is reusable across all verifications. Regenerate after contract changes
 * via the bun -e snippet in scripts/ that reads from build-info.
 */
export { default as BEACON_PROXY_VERIFICATION } from "./beacon-proxy-verification.json";
