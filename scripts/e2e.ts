/**
 * End-to-end test for iWallet + backend MCP-style tools.
 *
 * Prerequisites:
 *   - Hardhat node running on http://127.0.0.1:8545 (chain 31337)
 *
 * What it does:
 *   1. Deploys iWalletFactory
 *   2. Deploys an iWallet for the master account
 *   3. Funds the iWallet with ETH and deploys a TestERC20 owned by it
 *   4. Generates a session keypair, registers it on iWallet with a policy
 *   5. Funds the session EOA with gas
 *   6. Boots the backend on port 3001 (USE_LOCALHOST=true)
 *   7. Provisions the session via /api/wallet/provision
 *   8. Hits each tool to assert happy + blocked paths
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  keccak256,
  toBytes,
  encodeFunctionData,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import iWalletArtifact from "../packages/contract/artifacts/contracts/iWallet.sol/iWallet.json" with {
  type: "json",
};
import iWalletFactoryArtifact from "../packages/contract/artifacts/contracts/iWalletFactory.sol/iWalletFactory.json" with {
  type: "json",
};
import testERC20Artifact from "../packages/contract/artifacts/contracts/test/TestERC20.sol/TestERC20.json" with {
  type: "json",
};

const RPC = "http://127.0.0.1:8545";
const BACKEND_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Hardhat default accounts (deterministic)
const MASTER_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;
const FUNDER_PK =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as `0x${string}`;
const RECIPIENT_PK =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as `0x${string}`;

const log = (...args: unknown[]) => console.log("[e2e]", ...args);
const ok = (msg: string) => console.log(`  \x1b[32m✔\x1b[0m ${msg}`);
const fail = (msg: string) => {
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
  process.exit(1);
};
const expect = (cond: unknown, msg: string) => (cond ? ok(msg) : fail(msg));

async function waitForBackend(timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BACKEND_URL}/health`);
      if (r.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error("backend did not start");
}

async function main() {
  const master = privateKeyToAccount(MASTER_PK);
  const funder = privateKeyToAccount(FUNDER_PK);
  const recipient = privateKeyToAccount(RECIPIENT_PK);

  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(RPC),
  });
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

  // ── 1. Deploy factory ──────────────────────────────────────
  log("deploying iWalletFactory…");
  const deployHash = await masterClient.deployContract({
    abi: iWalletFactoryArtifact.abi,
    bytecode: iWalletFactoryArtifact.bytecode as `0x${string}`,
  });
  const deployRcpt = await publicClient.waitForTransactionReceipt({
    hash: deployHash,
  });
  const factoryAddr = deployRcpt.contractAddress as `0x${string}`;
  ok(`factory @ ${factoryAddr}`);

  // ── 2. Deploy iWallet via factory ──────────────────────────
  const salt =
    "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;
  const iWalletAddr = (await publicClient.readContract({
    address: factoryAddr,
    abi: iWalletFactoryArtifact.abi,
    functionName: "computeAddress",
    args: [master.address, salt],
  })) as `0x${string}`;

  const deployIwHash = await masterClient.writeContract({
    address: factoryAddr,
    abi: iWalletFactoryArtifact.abi,
    functionName: "deploy",
    args: [master.address, salt, parseEther("10"), [], []],
  });
  await publicClient.waitForTransactionReceipt({ hash: deployIwHash });
  ok(`iWallet @ ${iWalletAddr}`);

  // ── 3. Fund iWallet ────────────────────────────────────────
  await masterClient.sendTransaction({
    to: iWalletAddr,
    value: parseEther("5"),
  });
  const wBal = await publicClient.getBalance({ address: iWalletAddr });
  expect(wBal === parseEther("5"), `iWallet funded with 5 ETH (got ${wBal})`);

  // Deploy TestERC20, mint to iWallet
  const tokenDeployHash = await masterClient.deployContract({
    abi: testERC20Artifact.abi,
    bytecode: testERC20Artifact.bytecode as `0x${string}`,
    args: [iWalletAddr, 1_000_000n * 10n ** 18n],
  });
  const tokenRcpt = await publicClient.waitForTransactionReceipt({
    hash: tokenDeployHash,
  });
  const tokenAddr = tokenRcpt.contractAddress as `0x${string}`;
  ok(`TestERC20 @ ${tokenAddr}`);

  // ── 4. Provision session via backend (after deriving its address) ──
  // Master signs an off-chain message; backend derives session privkey.
  // We replicate that derivation here so we know the session address before
  // calling addSession on-chain.
  const provisioningSig = (await masterClient.signMessage({
    message: "iWallet session bootstrap",
  })) as `0x${string}`;

  const SESSION_INDEX = 0;
  const sessionPriv = keccak256(
    toBytes(
      provisioningSig +
        SESSION_INDEX.toString(16).padStart(64, "0")
    )
  );
  const sessionAccount = privateKeyToAccount(sessionPriv);
  const sessionAddr = sessionAccount.address;
  ok(`session @ ${sessionAddr}`);

  // ── 5. addSession on iWallet with a constrained policy ─────
  const policy = {
    dailyETHLimit: parseEther("0.05"),
    allowedTokens: [tokenAddr],
    tokenDailyLimits: [100n * 10n ** 18n],
    allowedContracts: [recipient.address],
    allowedSpenders: [funder.address],
    cooldownSeconds: 0n,
    maxGasPerTx: 0n,
    expiresAt: 0n,
    active: false,
  };
  const addHash = await masterClient.writeContract({
    address: iWalletAddr,
    abi: iWalletArtifact.abi,
    functionName: "addSession",
    args: [sessionAddr, policy],
  });
  await publicClient.waitForTransactionReceipt({ hash: addHash });
  ok("session registered on iWallet");

  // ── 6. Fund session EOA with gas ───────────────────────────
  await funderClient.sendTransaction({
    to: sessionAddr,
    value: parseEther("0.1"),
  });
  ok("session funded with gas");

  // ── 7. Boot backend ────────────────────────────────────────
  log("starting backend…");
  const backend = spawn(
    "bun",
    ["run", "--cwd", "packages/backend", "src/index.ts"],
    {
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
        USE_LOCALHOST: "true",
        RPC_URL: RPC,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const cleanup = () => backend.kill("SIGTERM");
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  await waitForBackend();
  ok("backend up");

  // ── 8. Provision a session via backend ─────────────────────
  const provisionRes = await fetch(`${BACKEND_URL}/api/wallet/provision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      signature: provisioningSig,
      index: SESSION_INDEX,
      iWalletAddress: iWalletAddr,
    }),
  });
  const provData = (await provisionRes.json()) as {
    bearerToken: string;
    sessionAddress: string;
    iWalletAddress: string;
  };
  expect(
    provData.sessionAddress.toLowerCase() === sessionAddr.toLowerCase(),
    "backend derives same session address"
  );
  const TOKEN = provData.bearerToken;

  const callTool = async (
    name: string,
    body: Record<string, unknown> = {}
  ) => {
    const r = await fetch(`${BACKEND_URL}/api/wallet/tool/${name}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    return (await r.json()) as { ok: boolean; result?: unknown; error?: string };
  };

  // ── 9. Tool tests ──────────────────────────────────────────

  log("\n── tool tests ──");

  // 9a. balance
  const bal = await callTool("checkBalance");
  expect(bal.ok && (bal.result as { eth: string }).eth === "5", "checkBalance native");

  const tokBal = await callTool("checkBalance", { token: tokenAddr });
  expect(
    tokBal.ok && (tokBal.result as { raw: string }).raw === "1000000000000000000000000",
    "checkBalance token"
  );

  // 9b. getPolicy
  const polRes = await callTool("getPolicy");
  expect(
    polRes.ok &&
      (polRes.result as { active: boolean }).active === true,
    "getPolicy returns active session"
  );

  // 9c. sendETH within cap
  const send1 = await callTool("sendETH", {
    to: recipient.address,
    amount: "0.03",
  });
  expect(send1.ok, "sendETH 0.03 within cap");

  // 9d. sendETH that would exceed cap → BLOCKED
  const send2 = await callTool("sendETH", {
    to: recipient.address,
    amount: "0.03",
  });
  expect(
    !send2.ok && (send2.error ?? "").includes("BLOCKED"),
    `sendETH overcap rejected: ${send2.error}`
  );

  // 9e. send to non-allowlisted recipient → BLOCKED
  const sendBad = await callTool("sendETH", {
    to: funder.address,
    amount: "0.001",
  });
  expect(
    !sendBad.ok && (sendBad.error ?? "").includes("BLOCKED"),
    "sendETH to non-allowlisted recipient blocked"
  );

  // 9f. sendToken within cap
  const tokenSend = await callTool("sendToken", {
    token: tokenAddr,
    to: recipient.address,
    amount: (40n * 10n ** 18n).toString(),
  });
  expect(tokenSend.ok, "sendToken 40 within cap");

  // 9g. sendToken over cap → BLOCKED
  const tokenSendOver = await callTool("sendToken", {
    token: tokenAddr,
    to: recipient.address,
    amount: (70n * 10n ** 18n).toString(),
  });
  expect(
    !tokenSendOver.ok && (tokenSendOver.error ?? "").includes("BLOCKED"),
    `sendToken overcap rejected: ${tokenSendOver.error}`
  );

  // 9h. approve allowed spender
  const approveOk = await callTool("approveToken", {
    token: tokenAddr,
    spender: funder.address,
    amount: (10n * 10n ** 18n).toString(),
  });
  expect(approveOk.ok, "approveToken to allowed spender ok");

  // 9i. infinite approval rejected
  const max = ((1n << 256n) - 1n).toString();
  const approveInf = await callTool("approveToken", {
    token: tokenAddr,
    spender: funder.address,
    amount: max,
  });
  expect(
    !approveInf.ok && (approveInf.error ?? "").includes("BLOCKED"),
    `infinite approve rejected: ${approveInf.error}`
  );

  // 9j. approve to non-allowlisted spender rejected
  const approveBad = await callTool("approveToken", {
    token: tokenAddr,
    spender: recipient.address, // not in allowedSpenders
    amount: (1n * 10n ** 18n).toString(),
  });
  expect(
    !approveBad.ok && (approveBad.error ?? "").includes("BLOCKED"),
    "approve to non-allowlisted spender blocked"
  );

  // 9k. getDailySpent
  const dailySpent = await callTool("getDailySpent", { token: tokenAddr });
  const spent = dailySpent.result as { ethSpent: string; tokenSpent?: string };
  expect(
    dailySpent.ok && spent.ethSpent === "0.03",
    `getDailySpent ethSpent=${spent.ethSpent}`
  );

  log("\nE2E PASSED ✔");
  cleanup();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
