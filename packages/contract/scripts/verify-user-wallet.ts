import { network } from "hardhat";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { encodeAbiParameters, type Address } from "viem";

/**
 * Verify a user's iWallet (BeaconProxy) on the configured explorer.
 * Each user wallet from a given factory has IDENTICAL bytecode and
 * constructor args (same beacon, empty initData) — only the deployment
 * address differs. So this script is reusable for every user.
 *
 * Configure via env (defaults are testnet):
 *   NETWORK         hardhat network (default: zeroGTestnet)
 *   IWALLET         the user's iWallet (BeaconProxy) address — required
 *   BEACON_ADDRESS  the beacon address the proxy points at
 *
 * Run:
 *   $env:IWALLET = "0x0E9f965815ce3165B2d93aF52175a1f62E86df84"
 *   bunx hardhat run --build-profile production scripts/verify-user-wallet.ts
 */

const NETWORK = process.env.NETWORK ?? "zeroGTestnet";
const IWALLET = process.env.IWALLET;
const BEACON =
	(process.env.BEACON_ADDRESS as Address | undefined) ??
	"0x820824425490f31E3e744867e803263368a2DA11";

if (!IWALLET) {
	console.error("Missing IWALLET env var (the user's wallet address).");
	process.exit(1);
}

// BeaconProxy(address beacon, bytes data) → abi.encode(beacon, "")
// Wallets from iWalletFactory.deploy() are always created with empty
// initData (the factory initializes via a separate post-deploy call).
const ctorArgs = encodeAbiParameters(
	[{ type: "address" }, { type: "bytes" }],
	[BEACON, "0x"]
).slice(2); // strip 0x

function findFactoryBuildInfo(): string {
	const buildInfoDir = resolve("artifacts/build-info");
	for (const f of readdirSync(buildInfoDir)) {
		if (f.endsWith(".output.json")) continue;
		const j = JSON.parse(readFileSync(resolve(buildInfoDir, f), "utf8"));
		const sources = Object.keys(j.input?.sources ?? {});
		const hasBeaconProxy = sources.some((s) => s.endsWith("/BeaconProxy.sol"));
		const hasFactory = sources.some((s) => s.endsWith("/iWalletFactory.sol"));
		if (hasBeaconProxy && hasFactory) return resolve(buildInfoDir, f);
	}
	throw new Error(
		"No build-info with BeaconProxy + iWalletFactory found — run `bunx hardhat compile` first"
	);
}

async function main() {
	console.log(`Verifying iWallet (BeaconProxy) on ${NETWORK}`);
	console.log(`  iWallet : ${IWALLET}`);
	console.log(`  beacon  : ${BEACON}`);

	const buildInfo = JSON.parse(readFileSync(findFactoryBuildInfo(), "utf8"));
	const compilerInput = buildInfo.input;

	const beaconProxyKey = Object.keys(compilerInput.sources).find((k: string) =>
		k.endsWith("/BeaconProxy.sol")
	);
	if (!beaconProxyKey) throw new Error("BeaconProxy source not found");
	const contractName = `${beaconProxyKey}:BeaconProxy`;
	console.log("Using contractName:", contractName);

	const conn = await network.connect({ network: NETWORK });
	const ethscan = conn.verification.etherscan;

	console.log("Submitting BeaconProxy for verification...");
	const guid = await ethscan.verify({
		contractAddress: IWALLET as Address,
		compilerInput,
		contractName,
		compilerVersion: "v0.8.28+commit.7893614a",
		constructorArguments: ctorArgs,
	});
	console.log("GUID:", guid);

	console.log("Polling status...");
	const result = await ethscan.pollVerificationStatus(
		guid,
		IWALLET,
		"BeaconProxy"
	);
	console.log("Result:", JSON.stringify(result, null, 2));
	console.log(
		`\nView on explorer:\n  https://chainscan-galileo.0g.ai/address/${IWALLET}#code`
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
