import { parseEther, formatEther } from "viem";

export interface PolicyConfig {
  dailySpendLimitETH: string; // human-readable ETH amount
  allowedTokens: `0x${string}`[];
  allowedContracts: `0x${string}`[];
  maxGasPerTx: bigint;
  cooldownSeconds: number;
  expiresAt: number; // unix timestamp, 0 = never
}

export interface PolicyOnChain {
  dailySpendLimitETH: bigint;
  allowedTokens: readonly `0x${string}`[];
  allowedContracts: readonly `0x${string}`[];
  maxGasPerTx: bigint;
  cooldownSeconds: bigint;
  expiresAt: bigint;
}

export function policyConfigToArgs(config: PolicyConfig): PolicyOnChain {
  return {
    dailySpendLimitETH: parseEther(config.dailySpendLimitETH),
    allowedTokens: config.allowedTokens,
    allowedContracts: config.allowedContracts,
    maxGasPerTx: config.maxGasPerTx,
    cooldownSeconds: BigInt(config.cooldownSeconds),
    expiresAt: BigInt(config.expiresAt),
  };
}

export function formatPolicy(policy: PolicyOnChain): {
  dailyLimit: string;
  allowedTokens: string;
  allowedContracts: string;
  maxGas: string;
  cooldown: string;
  expires: string;
} {
  return {
    dailyLimit: `${formatEther(policy.dailySpendLimitETH)} ETH`,
    allowedTokens:
      policy.allowedTokens.length === 0
        ? "Any"
        : `${policy.allowedTokens.length} whitelisted`,
    allowedContracts:
      policy.allowedContracts.length === 0
        ? "Any"
        : `${policy.allowedContracts.length} whitelisted`,
    maxGas:
      policy.maxGasPerTx === 0n
        ? "Unlimited"
        : policy.maxGasPerTx.toString(),
    cooldown:
      policy.cooldownSeconds === 0n
        ? "None"
        : `${policy.cooldownSeconds}s`,
    expires:
      policy.expiresAt === 0n
        ? "Never"
        : new Date(Number(policy.expiresAt) * 1000).toLocaleDateString(),
  };
}

export const DEFAULT_POLICY: PolicyConfig = {
  dailySpendLimitETH: "0.05",
  allowedTokens: [],
  allowedContracts: [],
  maxGasPerTx: 0n,
  cooldownSeconds: 0,
  expiresAt: 0,
};
