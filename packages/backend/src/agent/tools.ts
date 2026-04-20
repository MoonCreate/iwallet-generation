import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { POLICY_PROXY_ABI } from "@iwallet/chains";

export const agentToolDefinitions = [
  {
    name: "checkBalance",
    description:
      "Check the ETH balance of the iWallet proxy or any address on the 0G network",
    input_schema: {
      type: "object" as const,
      properties: {
        address: {
          type: "string",
          description: "The address to check balance for. If omitted, checks the iWallet proxy balance.",
        },
      },
      required: [],
    },
  },
  {
    name: "sendETH",
    description:
      "Send ETH from the iWallet to a recipient address. This goes through the PolicyProxy which enforces spending limits.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: {
          type: "string",
          description: "The recipient address",
        },
        amount: {
          type: "string",
          description: "Amount of ETH to send (e.g. '0.01')",
        },
      },
      required: ["to", "amount"],
    },
  },
  {
    name: "getPolicy",
    description:
      "Get the current policy rules configured for this iWallet, including daily spend limit, allowed contracts, cooldown, and expiry.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "getDailySpent",
    description:
      "Check how much ETH the iWallet has spent today against the daily limit.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

export interface AgentContext {
  privateKey: `0x${string}`;
  proxyAddress: `0x${string}`;
  chain: Chain;
  rpcUrl: string;
}

export async function executeAgentTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: AgentContext
): Promise<string> {
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

  switch (toolName) {
    case "checkBalance": {
      const address = (toolInput.address as `0x${string}`) || ctx.proxyAddress;
      const balance = await publicClient.getBalance({ address });
      return `Balance of ${address}: ${formatEther(balance)} ETH`;
    }

    case "sendETH": {
      const to = toolInput.to as `0x${string}`;
      const amount = toolInput.amount as string;
      const value = parseEther(amount);

      try {
        const hash = await walletClient.writeContract({
          address: ctx.proxyAddress,
          abi: POLICY_PROXY_ABI,
          functionName: "execute",
          args: [to, value, "0x"],
        });

        return `Transaction sent! Hash: ${hash}\nSent ${amount} ETH to ${to}`;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        if (message.includes("PolicyViolation")) {
          const reason =
            message.match(/PolicyViolation: (.+?)"/)?.[1] ?? "unknown reason";
          return `BLOCKED by policy: ${reason}. The transaction was not executed.`;
        }
        return `Transaction failed: ${message}`;
      }
    }

    case "getPolicy": {
      const policy = await publicClient.readContract({
        address: ctx.proxyAddress,
        abi: POLICY_PROXY_ABI,
        functionName: "getPolicy",
      });

      const p = policy as {
        dailySpendLimitETH: bigint;
        allowedTokens: string[];
        allowedContracts: string[];
        maxGasPerTx: bigint;
        cooldownSeconds: bigint;
        expiresAt: bigint;
      };

      return [
        `Daily Spend Limit: ${formatEther(p.dailySpendLimitETH)} ETH`,
        `Allowed Tokens: ${p.allowedTokens.length === 0 ? "any" : p.allowedTokens.join(", ")}`,
        `Allowed Contracts: ${p.allowedContracts.length === 0 ? "any" : p.allowedContracts.join(", ")}`,
        `Max Gas Per Tx: ${p.maxGasPerTx === 0n ? "unlimited" : p.maxGasPerTx.toString()}`,
        `Cooldown: ${p.cooldownSeconds === 0n ? "none" : `${p.cooldownSeconds}s`}`,
        `Expires: ${p.expiresAt === 0n ? "never" : new Date(Number(p.expiresAt) * 1000).toISOString()}`,
      ].join("\n");
    }

    case "getDailySpent": {
      const spent = await publicClient.readContract({
        address: ctx.proxyAddress,
        abi: POLICY_PROXY_ABI,
        functionName: "getDailySpent",
      });
      const policy = await publicClient.readContract({
        address: ctx.proxyAddress,
        abi: POLICY_PROXY_ABI,
        functionName: "getPolicy",
      });

      const p = policy as { dailySpendLimitETH: bigint };
      const limit = p.dailySpendLimitETH;
      const spentBig = spent as bigint;

      return `Daily spent: ${formatEther(spentBig)} / ${formatEther(limit)} ETH`;
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
