import { network } from "hardhat";
import { encodeFunctionData } from "viem";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const { viem } = await network.connect("localhost");
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying with account:", deployer.account.address);

  // 1. Deploy PolicyRegistry implementation
  console.log("\n1. Deploying PolicyRegistry implementation...");
  const impl = await viem.deployContract("PolicyRegistry");
  console.log("   Implementation:", impl.address);

  // 2. Encode initialize call
  const initData = encodeFunctionData({
    abi: impl.abi,
    functionName: "initialize",
    args: [deployer.account.address],
  });

  // 3. Deploy ERC1967 UUPS Proxy
  console.log("2. Deploying ERC1967 UUPS Proxy...");
  const proxy = await viem.deployContract("ERC1967Proxy", [
    impl.address,
    initData,
  ]);
  console.log("   Proxy:", proxy.address);

  // 4. Verify initialization
  const registry = await viem.getContractAt("PolicyRegistry", proxy.address);
  const owner = await registry.read.owner();
  console.log("3. Registry owner:", owner);

  // 5. Write deployment addresses to a shared JSON file
  const rootDir = resolve(import.meta.dirname, "..", "..", "..");
  const deployment = {
    chainId: 31337,
    network: "localhost",
    contracts: {
      policyRegistryImpl: impl.address,
      policyRegistryProxy: proxy.address,
    },
    deployer: deployer.account.address,
    timestamp: new Date().toISOString(),
  };

  const outPath = resolve(rootDir, "deployments.local.json");
  writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\n4. Deployment JSON written to deployments.local.json`);

  // 6. Auto-update frontend .env.local with the registry address
  const feEnvPath = resolve(rootDir, "packages", "frontend", ".env.local");
  let feEnv = "";
  if (existsSync(feEnvPath)) {
    feEnv = readFileSync(feEnvPath, "utf-8");
  }

  if (feEnv.includes("VITE_REGISTRY_ADDRESS=")) {
    // Replace existing line
    feEnv = feEnv.replace(
      /^#?\s*VITE_REGISTRY_ADDRESS=.*/m,
      `VITE_REGISTRY_ADDRESS=${proxy.address}`
    );
  } else {
    feEnv += `\nVITE_REGISTRY_ADDRESS=${proxy.address}\n`;
  }
  writeFileSync(feEnvPath, feEnv);
  console.log("5. Updated frontend .env.local with VITE_REGISTRY_ADDRESS");

  console.log("\n=== Deployment Complete ===");
  console.log(`Registry (proxy): ${proxy.address}`);
  console.log("\nNext steps:");
  console.log("  1. bun run --cwd packages/backend dev");
  console.log("  2. bun run --cwd packages/frontend dev");
  console.log("  3. Connect MetaMask to http://127.0.0.1:8545 (chain 31337)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
