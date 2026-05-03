import { parseEther, formatEther } from "viem";

export interface PolicyConfig {
  dailyETHLimit: string;                // human-readable ETH (e.g. "0.05")
  allowedTokens: `0x${string}`[];
  tokenDailyLimits: bigint[];           // raw amounts, parallel to allowedTokens
  allowedContracts: `0x${string}`[];
  allowedSpenders: `0x${string}`[];
  cooldownSeconds: number;
  maxGasPerTx: bigint;
  expiresAt: number;                    // unix seconds, 0 = never
}

export interface PolicyOnChain {
  dailyETHLimit: bigint;
  allowedTokens: readonly `0x${string}`[];
  tokenDailyLimits: readonly bigint[];
  allowedContracts: readonly `0x${string}`[];
  allowedSpenders: readonly `0x${string}`[];
  cooldownSeconds: bigint;
  maxGasPerTx: bigint;
  expiresAt: bigint;
  active: boolean;
}

export function policyConfigToArgs(c: PolicyConfig): PolicyOnChain {
  return {
    dailyETHLimit: parseEther(c.dailyETHLimit),
    allowedTokens: c.allowedTokens,
    tokenDailyLimits: c.tokenDailyLimits,
    allowedContracts: c.allowedContracts,
    allowedSpenders: c.allowedSpenders,
    cooldownSeconds: BigInt(c.cooldownSeconds),
    maxGasPerTx: c.maxGasPerTx,
    expiresAt: BigInt(c.expiresAt),
    active: false,
  };
}

export function formatPolicy(p: PolicyOnChain): {
  active: string;
  dailyLimit: string;
  allowedTokens: string;
  allowedContracts: string;
  allowedSpenders: string;
  cooldown: string;
  expires: string;
} {
  return {
    active: p.active ? "Active" : "Revoked",
    dailyLimit: `${formatEther(p.dailyETHLimit)} ETH`,
    allowedTokens:
      p.allowedTokens.length === 0
        ? "None"
        : `${p.allowedTokens.length} whitelisted`,
    allowedContracts:
      p.allowedContracts.length === 0
        ? "None"
        : `${p.allowedContracts.length} whitelisted`,
    allowedSpenders:
      p.allowedSpenders.length === 0
        ? "None"
        : `${p.allowedSpenders.length} whitelisted`,
    cooldown:
      p.cooldownSeconds === 0n ? "None" : `${p.cooldownSeconds}s`,
    expires:
      p.expiresAt === 0n
        ? "Never"
        : new Date(Number(p.expiresAt) * 1000).toLocaleDateString(),
  };
}

export const DEFAULT_POLICY: PolicyConfig = {
  dailyETHLimit: "0.05",
  allowedTokens: [],
  tokenDailyLimits: [],
  allowedContracts: [],
  allowedSpenders: [],
  cooldownSeconds: 0,
  maxGasPerTx: 0n,
  expiresAt: 0,
};
