import { localhost, zeroGTestnet, zeroGMainnet } from "@iwallet/chains";
export { POLICY_PROXY_ABI, POLICY_REGISTRY_ABI } from "@iwallet/chains";

/**
 * Get the PolicyRegistry proxy address for the current environment.
 * Priority: VITE_REGISTRY_ADDRESS env var > chain contract definition
 */
export function getRegistryAddress(
  chainId: number | undefined
): `0x${string}` | undefined {
  // Env override — set this after deploying locally
  const envAddr = import.meta.env.VITE_REGISTRY_ADDRESS;
  if (envAddr && envAddr !== "0x0") return envAddr as `0x${string}`;

  // Fall back to chain-embedded addresses
  switch (chainId) {
    case localhost.id:
      return localhost.contracts?.policyRegistry?.address;
    case zeroGTestnet.id:
      return zeroGTestnet.contracts?.policyRegistry?.address;
    case zeroGMainnet.id:
      return zeroGMainnet.contracts?.policyRegistry?.address;
    default:
      return undefined;
  }
}
