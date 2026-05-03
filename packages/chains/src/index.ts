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

export const SUPPORTED_CHAINS = [zeroGMainnet, zeroGTestnet, localhost];

export { IWALLET_ABI, IWALLET_FACTORY_ABI } from "./abi.ts";
