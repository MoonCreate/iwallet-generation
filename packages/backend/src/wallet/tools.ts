import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  encodeFunctionData,
  parseAbi,
  type Chain,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { IWALLET_ABI } from "@iwallet/chains";

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount)",
  "function approve(address spender, uint256 amount)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

export interface SessionContext {
  privateKey: `0x${string}`;
  iWalletAddress: `0x${string}`;
  chain: Chain;
  rpcUrl: string;
}

export const toolDefinitions = [
  {
    name: "checkBalance",
    description:
      "Check balance of the iWallet (ETH or an ERC20 token). Pass token address for ERC20, omit for native ETH.",
    input_schema: {
      type: "object" as const,
      properties: {
        token: {
          type: "string",
          description: "ERC20 token address. Omit for native ETH.",
        },
      },
      required: [],
    },
  },
  {
    name: "sendETH",
    description:
      "Send native ETH from the iWallet through execute(). Recipient must be in allowedContracts.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Recipient address" },
        amount: { type: "string", description: "Amount in ETH (e.g. '0.01')" },
      },
      required: ["to", "amount"],
    },
  },
  {
    name: "sendToken",
    description:
      "Transfer an ERC20 from the iWallet via execute(). Token must be allowedTokens, recipient in allowedContracts is NOT required for token-shape calls.",
    input_schema: {
      type: "object" as const,
      properties: {
        token: { type: "string", description: "ERC20 token address" },
        to: { type: "string", description: "Recipient address" },
        amount: {
          type: "string",
          description: "Raw amount (e.g. '1000000' for 1 USDC at 6 decimals)",
        },
      },
      required: ["token", "to", "amount"],
    },
  },
  {
    name: "approveToken",
    description:
      "Approve a spender to pull ERC20 tokens. Spender must be in allowedSpenders. Infinite approvals are rejected.",
    input_schema: {
      type: "object" as const,
      properties: {
        token: { type: "string" },
        spender: { type: "string" },
        amount: { type: "string", description: "Raw amount" },
      },
      required: ["token", "spender", "amount"],
    },
  },
  {
    name: "executeRaw",
    description:
      "Forward an arbitrary call through iWallet.execute(). Use for protocols not covered by other tools (DEX swaps, staking, etc).",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string" },
        value: { type: "string", description: "Wei (use '0' for non-payable)" },
        data: { type: "string", description: "Hex calldata starting with 0x" },
      },
      required: ["to", "value", "data"],
    },
  },
  {
    name: "executeBatch",
    description:
      "Atomic multi-call through iWallet.executeBatch(). All calls succeed or all revert.",
    input_schema: {
      type: "object" as const,
      properties: {
        calls: {
          type: "array",
          items: {
            type: "object",
            properties: {
              to: { type: "string" },
              value: { type: "string" },
              data: { type: "string" },
            },
            required: ["to", "value", "data"],
          },
        },
      },
      required: ["calls"],
    },
  },
  {
    name: "getPolicy",
    description: "Read the current policy applied to this session.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "getDailySpent",
    description:
      "Read this session's daily ETH spend, plus per-token spend if a token is provided.",
    input_schema: {
      type: "object" as const,
      properties: {
        token: { type: "string", description: "Optional ERC20 address" },
      },
      required: [],
    },
  },
] as const;

function makeClients(ctx: SessionContext) {
  const publicClient = createPublicClient({
    chain: ctx.chain,
    transport: http(ctx.rpcUrl),
  });
  const account = privateKeyToAccount(ctx.privateKey);
  const walletClient = createWalletClient({
    account,
    chain: ctx.chain,
    transport: http(ctx.rpcUrl),
  });
  return { publicClient, walletClient, account };
}

function parsePolicyError(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  const m = message.match(/Policy: ([^"\n]+?)(?:["'\n]|$)/);
  if (m) return `BLOCKED by policy: ${m[1]}`;
  if (message.includes("session inactive")) return "BLOCKED: session inactive";
  if (message.includes("paused")) return "BLOCKED: wallet paused";
  return null;
}

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: SessionContext
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const { publicClient, walletClient } = makeClients(ctx);

  try {
    switch (name) {
      case "checkBalance": {
        const token = input.token as `0x${string}` | undefined;
        if (!token) {
          const wei = await publicClient.getBalance({
            address: ctx.iWalletAddress,
          });
          return {
            ok: true,
            result: { eth: formatEther(wei), wei: wei.toString() },
          };
        }
        const [bal, sym, dec] = await Promise.all([
          publicClient.readContract({
            address: token,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [ctx.iWalletAddress],
          }),
          publicClient
            .readContract({
              address: token,
              abi: ERC20_ABI,
              functionName: "symbol",
            })
            .catch(() => "?"),
          publicClient
            .readContract({
              address: token,
              abi: ERC20_ABI,
              functionName: "decimals",
            })
            .catch(() => 18),
        ]);
        return {
          ok: true,
          result: {
            token,
            symbol: sym,
            decimals: dec,
            raw: (bal as bigint).toString(),
          },
        };
      }

      case "sendETH": {
        const to = getAddress(input.to as string);
        const value = parseEther(input.amount as string);
        const hash = await walletClient.writeContract({
          address: ctx.iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "execute",
          args: [to, value, "0x"],
        });
        return { ok: true, result: { hash, to, amount: input.amount } };
      }

      case "sendToken": {
        const token = getAddress(input.token as string);
        const to = getAddress(input.to as string);
        const amount = BigInt(input.amount as string);
        const data = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [to, amount],
        });
        const hash = await walletClient.writeContract({
          address: ctx.iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "execute",
          args: [token, 0n, data],
        });
        return { ok: true, result: { hash, token, to, amount: amount.toString() } };
      }

      case "approveToken": {
        const token = getAddress(input.token as string);
        const spender = getAddress(input.spender as string);
        const amount = BigInt(input.amount as string);
        const data = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, amount],
        });
        const hash = await walletClient.writeContract({
          address: ctx.iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "execute",
          args: [token, 0n, data],
        });
        return {
          ok: true,
          result: { hash, token, spender, amount: amount.toString() },
        };
      }

      case "executeRaw": {
        const to = getAddress(input.to as string);
        const value = BigInt(input.value as string);
        const data = input.data as `0x${string}`;
        const hash = await walletClient.writeContract({
          address: ctx.iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "execute",
          args: [to, value, data],
          value,
        });
        return { ok: true, result: { hash, to, value: value.toString() } };
      }

      case "executeBatch": {
        const raw = input.calls as Array<{
          to: string;
          value: string;
          data: string;
        }>;
        const calls = raw.map((c) => ({
          to: getAddress(c.to),
          value: BigInt(c.value),
          data: c.data as `0x${string}`,
        }));
        const total = calls.reduce((a, c) => a + c.value, 0n);
        const hash = await walletClient.writeContract({
          address: ctx.iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "executeBatch",
          args: [calls],
          value: total,
        });
        return { ok: true, result: { hash, calls: calls.length } };
      }

      case "getPolicy": {
        const account = privateKeyToAccount(ctx.privateKey);
        const policy = await publicClient.readContract({
          address: ctx.iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "getSessionPolicy",
          args: [account.address],
        });
        return { ok: true, result: serializePolicy(policy) };
      }

      case "getDailySpent": {
        const account = privateKeyToAccount(ctx.privateKey);
        const eth = await publicClient.readContract({
          address: ctx.iWalletAddress,
          abi: IWALLET_ABI,
          functionName: "getSessionDailyEthSpent",
          args: [account.address],
        });
        const out: Record<string, string> = {
          ethSpent: formatEther(eth as bigint),
        };
        if (input.token) {
          const tokSpent = await publicClient.readContract({
            address: ctx.iWalletAddress,
            abi: IWALLET_ABI,
            functionName: "getSessionDailyTokenSpent",
            args: [account.address, getAddress(input.token as string)],
          });
          out.tokenSpent = (tokSpent as bigint).toString();
        }
        return { ok: true, result: out };
      }

      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const blocked = parsePolicyError(err);
    if (blocked) return { ok: false, error: blocked };
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function serializePolicy(p: unknown): Record<string, unknown> {
  const policy = p as {
    dailyETHLimit: bigint;
    allowedTokens: readonly string[];
    tokenDailyLimits: readonly bigint[];
    allowedContracts: readonly string[];
    allowedSpenders: readonly string[];
    cooldownSeconds: bigint;
    maxGasPerTx: bigint;
    expiresAt: bigint;
    active: boolean;
  };
  return {
    active: policy.active,
    dailyETHLimit: formatEther(policy.dailyETHLimit),
    allowedTokens: policy.allowedTokens,
    tokenDailyLimits: policy.tokenDailyLimits.map((x) => x.toString()),
    allowedContracts: policy.allowedContracts,
    allowedSpenders: policy.allowedSpenders,
    cooldownSeconds: policy.cooldownSeconds.toString(),
    maxGasPerTx: policy.maxGasPerTx.toString(),
    expiresAt: policy.expiresAt.toString(),
  };
}
