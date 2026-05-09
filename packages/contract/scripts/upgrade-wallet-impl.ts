/**
 * Deploy a new iWallet implementation, point the factory's beacon at it,
 * and verify the new impl on the configured explorer.
 *
 * Run:
 *   $env:DEPLOY_PRIVATE_KEY = "<key>"
 *   bunx hardhat run --network zeroGTestnet --build-profile production \
 *     scripts/upgrade-wallet-impl.ts
 */

import { network } from "hardhat";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAddress } from "viem";

// 0G Galileo Testnet deployment.
const FACTORY_PROXY = "0xCF1f2860BA28aD3c7BCfCc29ab34c2f70D64F4ca" as const;

async function main() {
  const conn = await network.connect({ network: "zeroGTestnet" });
  const { viem, verification } = conn;

  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();
  console.log("Deployer:", deployer.account.address);

  // 1. Read pre-upgrade state.
  const factory = await viem.getContractAt("iWalletFactory", FACTORY_PROXY);
  const prevImpl = await factory.read.getImplementation();
  const beacon = await factory.read.beacon();
  const owner = await factory.read.owner();
  console.log("Factory:    ", FACTORY_PROXY);
  console.log("Beacon:     ", beacon);
  console.log("Prev impl:  ", prevImpl);
  console.log("Owner:      ", owner);

  if (
    getAddress(owner) !== getAddress(deployer.account.address)
  ) {
    throw new Error(
      `deployer ${deployer.account.address} is not factory owner (${owner})`
    );
  }

  // 2. Deploy new iWallet implementation.
  console.log("\n==> deploying new iWallet implementation...");
  const newImpl = await viem.deployContract("iWallet");
  console.log("New impl:   ", newImpl.address);
  if (
    getAddress(newImpl.address) === getAddress(prevImpl)
  ) {
    throw new Error(
      "deployed address matches prev impl — unexpected (CREATE2 collision?)"
    );
  }

  // 3. Roll the beacon.
  console.log("\n==> calling factory.upgradeImplementation...");
  const txHash = await factory.write.upgradeImplementation(
    [newImpl.address],
    { account: deployer.account }
  );
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("Tx:         ", txHash);

  // 4. Confirm the swap.
  const currentImpl = await factory.read.getImplementation();
  if (getAddress(currentImpl) !== getAddress(newImpl.address)) {
    throw new Error(
      `beacon impl is ${currentImpl}, expected ${newImpl.address}`
    );
  }
  console.log("Active impl: ", currentImpl, "✓");

  // 5. Verify the new impl's source on the explorer.
  console.log("\n==> submitting impl source for verification...");
  const buildInfoPath = findBuildInfoFor("iWallet");
  const buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf8"));
  const guid = await verification.etherscan.verify({
    contractAddress: newImpl.address,
    compilerInput: buildInfo.input,
    contractName: "contracts/iWallet.sol:iWallet",
    compilerVersion: "v0.8.28+commit.7893614a",
    constructorArguments: "",
  });
  console.log("Verify GUID:", guid);

  console.log("\n==> polling verification status...");
  const result = await verification.etherscan.pollVerificationStatus(
    guid,
    newImpl.address,
    "iWallet"
  );
  console.log("Result:", JSON.stringify(result));
}

function findBuildInfoFor(contractName: string): string {
  const dir = resolve("artifacts/build-info");
  const fs = require("node:fs") as typeof import("node:fs");
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".output.json")) continue;
    const j = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
    const sources = Object.keys(j.input?.sources ?? {});
    const hasOurContract = sources.some((s) =>
      s.endsWith(`/${contractName}.sol`)
    );
    const isProductionProfile =
      j.input?.settings?.optimizer?.enabled === true;
    // Prefer the smallest build-info that contains our contract — that's
    // the dedicated one, not a transitive bundle.
    if (hasOurContract && isProductionProfile && sources.length < 10) {
      return resolve(dir, f);
    }
  }
  throw new Error(
    `no production build-info contains contracts/${contractName}.sol`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
