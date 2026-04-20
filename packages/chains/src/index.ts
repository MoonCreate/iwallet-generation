import { defineChain } from "viem";
import {
  zeroGMainnet as mainnetBase,
  zeroGTestnet as testnetBase,
  hardhat as hardhatBase,
} from "viem/chains";

// Contract addresses — update after deployment
export const CONTRACT_ADDRESSES = {
  mainnet: {
    policyRegistry: "0x0" as `0x${string}`,
  },
  testnet: {
    policyRegistry: "0x0" as `0x${string}`,
  },
  localhost: {
    policyRegistry: "0x0" as `0x${string}`,
  },
} as const;

export const zeroGMainnet = defineChain({
  ...mainnetBase,
  contracts: {
    ...mainnetBase.contracts,
    policyRegistry: {
      address: CONTRACT_ADDRESSES.mainnet.policyRegistry,
      blockCreated: 0,
    },
  },
});

export const zeroGTestnet = defineChain({
  ...testnetBase,
  contracts: {
    ...testnetBase.contracts,
    policyRegistry: {
      address: CONTRACT_ADDRESSES.testnet.policyRegistry,
      blockCreated: 0,
    },
  },
});

export const localhost = defineChain({
  ...hardhatBase,
  contracts: {
    policyRegistry: {
      address: CONTRACT_ADDRESSES.localhost.policyRegistry,
      blockCreated: 0,
    },
  },
});

// Re-export ABIs for use across packages
export { POLICY_PROXY_ABI, POLICY_REGISTRY_ABI } from "./abi.ts";
