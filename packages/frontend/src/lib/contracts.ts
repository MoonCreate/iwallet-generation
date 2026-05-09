import {
  zeroGTestnet,
  zeroGMainnet,
  getFactoryAddressForChain,
} from "@iwallet/chains";
export {
  IWALLET_ABI,
  IWALLET_FACTORY_ABI,
  SUPPORTED_CHAINS,
} from "@iwallet/chains";

/** Address of the iWalletFactory for the connected chain. */
export function getFactoryAddress(
  chainId: number | undefined
): `0x${string}` | undefined {
  if (chainId === undefined) return undefined;
  return getFactoryAddressForChain(chainId);
}

export const SUPPORTED_CHAIN_IDS = {
  zeroGTestnet: zeroGTestnet.id,
  zeroGMainnet: zeroGMainnet.id,
} as const;

export function chainName(chainId: number | undefined): string {
  switch (chainId) {
    case zeroGTestnet.id:
      return "0G Galileo Testnet";
    case zeroGMainnet.id:
      return "0G Mainnet";
    default:
      return chainId ? `Chain ${chainId}` : "—";
  }
}

/** Backend base URL — VITE_BACKEND_URL overrides. */
export function getBackendUrl(): string {
  return (
    import.meta.env.VITE_BACKEND_URL ??
    (import.meta.env.DEV
      ? "http://localhost:3001"
      : "https://be-wallet.goon4.site")
  );
}
