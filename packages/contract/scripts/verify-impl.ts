/**
 * One-shot verifier for an already-deployed iWallet implementation.
 * Used after upgrade-wallet-impl.ts deploys + rolls but verification
 * doesn't run (e.g. RPC receipt-polling timed out).
 */

import { network } from "hardhat";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const NEW_IMPL = "0xE41A318Ea4A5B8dd731Cb84C89E5Bd3f98E41706";

function findBuildInfoFor(contractName: string): string {
	const dir = resolve("artifacts/build-info");
	for (const f of readdirSync(dir)) {
		if (f.endsWith(".output.json")) continue;
		const j = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
		const sources = Object.keys(j.input?.sources ?? {});
		const hasOurContract = sources.some((s) =>
			s.endsWith(`/${contractName}.sol`)
		);
		const isProd = j.input?.settings?.optimizer?.enabled === true;
		if (hasOurContract && isProd && sources.length < 10) {
			return resolve(dir, f);
		}
	}
	throw new Error(`no production build-info for ${contractName}`);
}

async function main() {
	const conn = await network.connect({ network: "zeroGTestnet" });
	const buildInfo = JSON.parse(readFileSync(findBuildInfoFor("iWallet"), "utf8"));

	console.log("Submitting verification for", NEW_IMPL);
	const guid = await conn.verification.etherscan.verify({
		contractAddress: NEW_IMPL,
		compilerInput: buildInfo.input,
		contractName: "project/contracts/iWallet.sol:iWallet",
		compilerVersion: "v0.8.28+commit.7893614a",
		constructorArguments: "",
	});
	console.log("GUID:", guid);

	const result = await conn.verification.etherscan.pollVerificationStatus(
		guid,
		NEW_IMPL,
		"iWallet"
	);
	console.log("Result:", JSON.stringify(result, null, 2));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
