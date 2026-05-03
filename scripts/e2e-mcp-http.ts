/**
 * End-to-end test for the remote MCP flow.
 *
 * Steps:
 *   1. Deploys factory + iWallet
 *   2. Registers a session on-chain
 *   3. Boots backend
 *   4. (a) Hits /mcp with NO auth → expects 401 + WWW-Authenticate header
 *      (b) POSTs /api/wallet/provision → gets bearer
 *      (c) Hits /mcp with the bearer:
 *            initialize → tools/list → tools/call (sendETH success)
 *            tools/call sendETH overcap → expects isError content
 *
 * Requires Hardhat node on :8545.
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import iWalletArtifact from "../packages/contract/artifacts/contracts/iWallet.sol/iWallet.json" with {
  type: "json",
};
import iWalletFactoryArtifact from "../packages/contract/artifacts/contracts/iWalletFactory.sol/iWalletFactory.json" with {
  type: "json",
};

const RPC = "http://127.0.0.1:8545";
const BACKEND_PORT = 3015;
const BACKEND = `http://localhost:${BACKEND_PORT}`;

const MASTER_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;
const FUNDER_PK =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as `0x${string}`;
const RECIPIENT_PK =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as `0x${string}`;

const ok = (m: string) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const fail = (m: string) => {
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
  process.exit(1);
};
const expect = (c: unknown, m: string) => (c ? ok(m) : fail(m));

async function waitHttp(url: string, timeout = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error(`backend at ${url} did not start`);
}

async function rpc(
  bearer: string | null,
  body: unknown
): Promise<Response> {
  return fetch(`${BACKEND}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

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

  // 1. factory + iWallet
  const fHash = await masterClient.deployContract({
    abi: iWalletFactoryArtifact.abi,
    bytecode: iWalletFactoryArtifact.bytecode as `0x${string}`,
  });
  const fr = await publicClient.waitForTransactionReceipt({ hash: fHash });
  const factory = fr.contractAddress as `0x${string}`;
  const salt =
    "0x0000000000000000000000000000000000000000000000000000000000000099" as `0x${string}`;
  const iwAddr = (await publicClient.readContract({
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
  await masterClient.sendTransaction({ to: iwAddr, value: parseEther("5") });
  ok(`iWallet @ ${iwAddr}`);

  // 2. derive session, register, fund
  const sig = await masterClient.signMessage({
    message: "iWallet session bootstrap",
  });
  const sessionPriv = (
    await import("viem")
  ).keccak256(
    (await import("viem")).toBytes(sig + "0".repeat(64))
  );
  const session = privateKeyToAccount(sessionPriv);
  const policy = {
    dailyETHLimit: parseEther("0.05"),
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
    address: iwAddr,
    abi: iWalletArtifact.abi,
    functionName: "addSession",
    args: [session.address, policy],
  });
  await publicClient.waitForTransactionReceipt({ hash: aHash });
  await funderClient.sendTransaction({
    to: session.address,
    value: parseEther("0.1"),
  });
  ok(`session @ ${session.address}`);

  // 3. boot backend
  const backend = spawn(
    "bun",
    ["run", "packages/backend/src/index.ts"],
    {
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
        USE_LOCALHOST: "true",
        RPC_URL: RPC,
        FRONTEND_URL: "http://localhost:3000",
        DB_PATH: "./data/iwallet-e2e.db",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  process.on("exit", () => backend.kill("SIGTERM"));
  process.on("SIGINT", () => {
    backend.kill("SIGTERM");
    process.exit(130);
  });
  await waitHttp(`${BACKEND}/health`);
  ok("backend up");

  // 4a. unauthenticated MCP call → 401 + WWW-Authenticate
  const noAuth = await rpc(null, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "checkBalance", arguments: {} },
  });
  expect(noAuth.status === 401, "tools/call without auth → 401");
  expect(
    (noAuth.headers.get("www-authenticate") ?? "").includes("auth_url"),
    "WWW-Authenticate header points to auth_url"
  );

  // 4b. provision a bearer
  const provRes = await fetch(`${BACKEND}/api/wallet/provision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      signature: sig,
      index: 0,
      iWalletAddress: iwAddr,
      chainId: hardhat.id,
      label: "e2e bot",
    }),
  });
  const prov = (await provRes.json()) as {
    bearerToken: string;
    sessionAddress: string;
  };
  expect(
    prov.sessionAddress.toLowerCase() === session.address.toLowerCase(),
    "backend derives same session address"
  );
  const TOKEN = prov.bearerToken;

  // 4c. initialize
  const initRes = await rpc(TOKEN, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "e2e", version: "0" },
    },
  });
  const initJson = (await initRes.json()) as {
    result: { protocolVersion: string };
  };
  expect(
    initJson.result.protocolVersion === "2024-11-05",
    "initialize returns protocolVersion"
  );

  // 4d. tools/list
  const listRes = await rpc(TOKEN, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  const listJson = (await listRes.json()) as {
    result: { tools: Array<{ name: string }> };
  };
  expect(
    listJson.result.tools.length >= 6,
    `tools/list → ${listJson.result.tools.length} tools`
  );

  // 4e. tools/call sendETH within cap
  const sendRes = await rpc(TOKEN, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "sendETH",
      arguments: { to: recipient.address, amount: "0.03" },
    },
  });
  const sendJson = (await sendRes.json()) as {
    result: { content: Array<{ text: string }>; isError?: boolean };
  };
  expect(!sendJson.result.isError, "sendETH 0.03 within cap");

  // 4f. overcap → BLOCKED returned as isError
  const overRes = await rpc(TOKEN, {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "sendETH",
      arguments: { to: recipient.address, amount: "0.03" },
    },
  });
  const overJson = (await overRes.json()) as {
    result: { content: Array<{ text: string }>; isError?: boolean };
  };
  expect(
    overJson.result.isError === true &&
      overJson.result.content[0].text.includes("BLOCKED"),
    `overcap returns isError + BLOCKED text`
  );

  console.log("\nMCP-HTTP E2E PASSED ✔");
  backend.kill("SIGTERM");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
