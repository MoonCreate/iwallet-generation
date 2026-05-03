/**
 * Local helper: deploys factory + iWallet, registers a session, prints
 * the env vars you need to add this MCP server to Claude Code.
 *
 * Run: `bun run scripts/setup-and-mcp.ts`
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { resolve } from "node:path";
import iWalletFactoryArtifact from "../packages/contract/artifacts/contracts/iWalletFactory.sol/iWalletFactory.json" with {
  type: "json",
};
import iWalletArtifact from "../packages/contract/artifacts/contracts/iWallet.sol/iWallet.json" with {
  type: "json",
};

const RPC = "http://127.0.0.1:8545";
const MASTER_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;
const FUNDER_PK =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as `0x${string}`;
const RECIPIENT_PK =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as `0x${string}`;

async function main() {
  const master = privateKeyToAccount(MASTER_PK);
  const funder = privateKeyToAccount(FUNDER_PK);
  const recipient = privateKeyToAccount(RECIPIENT_PK);

  const publicClient = createPublicClient({ chain: hardhat, transport: http(RPC) });
  const masterClient = createWalletClient({
    account: master,
    chain: hardhat,
    transport: http(RPC),
  });
  const funderClient = createWalletClient({
    account: funder,
    chain: hardhat,
    transport: http(RPC),
  });

  // Deploy factory
  const fHash = await masterClient.deployContract({
    abi: iWalletFactoryArtifact.abi,
    bytecode: iWalletFactoryArtifact.bytecode as `0x${string}`,
  });
  const fr = await publicClient.waitForTransactionReceipt({ hash: fHash });
  const factory = fr.contractAddress as `0x${string}`;

  // Deploy iWallet
  const salt =
    "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
  const iWalletAddr = (await publicClient.readContract({
    address: factory,
    abi: iWalletFactoryArtifact.abi,
    functionName: "computeAddress",
    args: [master.address, salt],
  })) as `0x${string}`;
  const dHash = await masterClient.writeContract({
    address: factory,
    abi: iWalletFactoryArtifact.abi,
    functionName: "deploy",
    args: [master.address, salt, parseEther("1"), [], []],
  });
  await publicClient.waitForTransactionReceipt({ hash: dHash });

  // Fund it
  await masterClient.sendTransaction({
    to: iWalletAddr,
    value: parseEther("5"),
  });

  // Derive session
  const sig = (await masterClient.signMessage({
    message: "iWallet session bootstrap",
  })) as `0x${string}`;
  const idx = 0;
  const sessionPriv = keccak256(
    toBytes(sig + idx.toString(16).padStart(64, "0"))
  );
  const session = privateKeyToAccount(sessionPriv);

  // Register session with a permissive policy (recipient allowlisted)
  const policy = {
    dailyETHLimit: parseEther("0.5"),
    allowedTokens: [],
    tokenDailyLimits: [],
    allowedContracts: [recipient.address],
    allowedSpenders: [],
    cooldownSeconds: 0n,
    maxGasPerTx: 0n,
    expiresAt: 0n,
    active: false,
  };
  const aHash = await masterClient.writeContract({
    address: iWalletAddr,
    abi: iWalletArtifact.abi,
    functionName: "addSession",
    args: [session.address, policy],
  });
  await publicClient.waitForTransactionReceipt({ hash: aHash });

  // Fund session for gas
  await funderClient.sendTransaction({
    to: session.address,
    value: parseEther("0.1"),
  });

  const repoRoot = resolve(import.meta.dirname, "..");
  console.log("\n══════ iWallet ready ══════");
  console.log(`iWallet:    ${iWalletAddr}`);
  console.log(`session:    ${session.address}`);
  console.log(`recipient:  ${recipient.address}  (allowlisted)`);
  console.log("\nAdd to Claude Code:");
  console.log(
    `  claude mcp add iwallet bun run ${repoRoot}/packages/backend/src/mcp/index.ts \\`
  );
  console.log(`    -e IWALLET_ADDRESS=${iWalletAddr} \\`);
  console.log(`    -e SESSION_PRIVATE_KEY=${sessionPriv} \\`);
  console.log(`    -e USE_LOCALHOST=true \\`);
  console.log(`    -e RPC_URL=${RPC}`);
  console.log("\nOr Claude Desktop config (~/.claude/config or claude_desktop_config.json):");
  console.log(
    JSON.stringify(
      {
        mcpServers: {
          iwallet: {
            command: "bun",
            args: ["run", `${repoRoot}/packages/backend/src/mcp/index.ts`],
            env: {
              IWALLET_ADDRESS: iWalletAddr,
              SESSION_PRIVATE_KEY: sessionPriv,
              USE_LOCALHOST: "true",
              RPC_URL: RPC,
            },
          },
        },
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
