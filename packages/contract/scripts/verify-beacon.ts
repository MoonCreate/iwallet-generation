import { network } from "hardhat";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Verify the UpgradeableBeacon deployed inline by iWalletFactory.initialize.
 * `hardhat verify` CLI auto-detection only matches local `contracts/`
 * artifacts, not transitive `node_modules` ones, so OZ's UpgradeableBeacon
 * needs the lower-level verification.etherscan.verify() API call with the
 * full source key as contractName.
 *
 * Configure via env (defaults are testnet):
 *   NETWORK              hardhat network name (default: zeroGTestnet)
 *   BEACON_ADDRESS       deployed beacon
 *   WALLET_IMPL_ADDRESS  current iWallet implementation
 *   FACTORY_PROXY        the factory proxy that owns the beacon
 *
 * Run:
 *   $env:NETWORK = "zeroGMainnet"
 *   $env:BEACON_ADDRESS = "0x..."; $env:WALLET_IMPL_ADDRESS = "0x..."
 *   $env:FACTORY_PROXY = "0x..."
 *   bunx hardhat run --build-profile production scripts/verify-beacon.ts
 */

const NETWORK = process.env.NETWORK ?? "zeroGTestnet";
const BEACON =
	process.env.BEACON_ADDRESS ??
	"0x820824425490f31E3e744867e803263368a2DA11";
const WALLET_IMPL =
	process.env.WALLET_IMPL_ADDRESS ??
	"0xE41A318Ea4A5B8dd731Cb84C89E5Bd3f98E41706";
const FACTORY_PROXY =
	process.env.FACTORY_PROXY ??
	"0xCF1f2860BA28aD3c7BCfCc29ab34c2f70D64F4ca";

// UpgradeableBeacon constructor args: (address implementation_, address initialOwner)
// initialOwner is the factory PROXY address (since `address(this)` resolved
// inside the proxy's delegated initialize call).
const ctorArgs =
	WALLET_IMPL.slice(2).toLowerCase().padStart(64, "0") +
	FACTORY_PROXY.slice(2).toLowerCase().padStart(64, "0");

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
	console.log(`Verifying beacon ${BEACON} on ${NETWORK}`);
	console.log(`  walletImpl=${WALLET_IMPL}`);
	console.log(`  factory   =${FACTORY_PROXY}`);

	const buildInfo = JSON.parse(readFileSync(findFactoryBuildInfo(), "utf8"));
	const compilerInput = buildInfo.input;

	const beaconKey = Object.keys(compilerInput.sources).find((k: string) =>
		k.endsWith("/UpgradeableBeacon.sol")
	);
	if (!beaconKey) throw new Error("UpgradeableBeacon source not found");
	const contractName = `${beaconKey}:UpgradeableBeacon`;
	console.log("Using contractName:", contractName);

	const conn = await network.connect({ network: NETWORK });
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
