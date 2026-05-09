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
