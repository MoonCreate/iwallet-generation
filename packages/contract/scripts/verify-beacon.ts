import { network } from "hardhat";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// New upgradable factory deployment on 0G testnet (16602).
const BEACON = "0x820824425490f31E3e744867e803263368a2DA11";
const WALLET_IMPL = "0x0A1bDd15716E6cF9b8fDF4DAc300524e56704C0e";
const FACTORY_PROXY = "0xCF1f2860BA28aD3c7BCfCc29ab34c2f70D64F4ca";

// UpgradeableBeacon constructor args: (address implementation_, address initialOwner)
// initialOwner is the factory PROXY address (since `address(this)` resolved
// inside the proxy's delegated initialize call).
const ctorArgs =
  WALLET_IMPL.slice(2).toLowerCase().padStart(64, "0") +
  FACTORY_PROXY.slice(2).toLowerCase().padStart(64, "0");

// Find the build-info that contains UpgradeableBeacon as a transitive import.
// iWalletFactory pulls in the OZ beacon source, so its build-info has it.
function findFactoryBuildInfo(): string {
  const buildInfoDir = resolve("artifacts/build-info");
  for (const f of readdirSync(buildInfoDir)) {
    if (f.endsWith(".output.json")) continue;
    const j = JSON.parse(readFileSync(resolve(buildInfoDir, f), "utf8"));
    const sources = Object.keys(j.input?.sources ?? {});
    const hasBeacon = sources.some((s) => s.endsWith("/UpgradeableBeacon.sol"));
    const hasFactory = sources.some((s) => s.endsWith("/iWalletFactory.sol"));
    if (hasBeacon && hasFactory) return resolve(buildInfoDir, f);
  }
  throw new Error("No build-info with UpgradeableBeacon + iWalletFactory found");
}

async function main() {
  const buildInfo = JSON.parse(readFileSync(findFactoryBuildInfo(), "utf8"));
  const compilerInput = buildInfo.input;

  const beaconKey = Object.keys(compilerInput.sources).find((k: string) =>
    k.endsWith("/UpgradeableBeacon.sol")
  );
  if (!beaconKey) throw new Error("UpgradeableBeacon source not found");
  const contractName = `${beaconKey}:UpgradeableBeacon`;
  console.log("Using contractName:", contractName);

  const conn = await network.connect({ network: "zeroGTestnet" });
  const ethscan = conn.verification.etherscan;

  console.log("Submitting beacon for verification...");
  const guid = await ethscan.verify({
    contractAddress: BEACON,
    compilerInput,
    contractName,
    compilerVersion: "v0.8.28+commit.7893614a",
    constructorArguments: ctorArgs,
  });
  console.log("GUID:", guid);

  console.log("Polling status...");
  const result = await ethscan.pollVerificationStatus(
    guid,
    BEACON,
    "UpgradeableBeacon"
  );
  console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
