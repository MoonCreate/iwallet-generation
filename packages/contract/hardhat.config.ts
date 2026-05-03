import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

// Allow direct env var fallback: DEPLOY_PRIVATE_KEY=0x...
// (Hardhat 3 also auto-reads HARDHAT_VAR_DEPLOY_PRIVATE_KEY for configVariable.)
function envOrConfig(name: string): string {
	return process.env[name] ?? configVariable(name);
}

export default defineConfig({
	plugins: [hardhatToolboxViemPlugin],
	solidity: {
		profiles: {
			default: {
				version: "0.8.28",
			},
			production: {
				version: "0.8.28",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
		},
	},
	verify: {
		etherscan: { apiKey: "natsu_dragneel", enabled: true },
	},
	chainDescriptors: {
		16602: {
			name: "zeroGTestnet",
			chainType: "l1",
			blockExplorers: {
				etherscan: {
					apiUrl: "https://chainscan-galileo.0g.ai/open/api",
					name: "galileoscan",
					url: "https://chainscan-galileo.0g.ai",
				},
			},
		},
		16661: {
			name: "zeroGMainnet",
			chainType: "l1",
			blockExplorers: {
				etherscan: {
					apiUrl: "https://chainscan.0g.ai/open/api",
					name: "aristotle",
					url: "https://chainscan.0g.ai",
				},
			},
		},
	},
	networks: {
		hardhatMainnet: {
			type: "edr-simulated",
			chainType: "l1",
		},
		hardhatOp: {
			type: "edr-simulated",
			chainType: "op",
		},
		localhost: {
			type: "http",
			chainType: "l1",
			url: "http://127.0.0.1:8545",
		},
		sepolia: {
			type: "http",
			chainType: "l1",
			url: configVariable("SEPOLIA_RPC_URL"),
			accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
		},
		zeroGTestnet: {
			type: "http",
			chainType: "l1",
			chainId: 16_602,
			url: "https://evmrpc-testnet.0g.ai",
			accounts: [envOrConfig("DEPLOY_PRIVATE_KEY")],
		},
		zeroGMainnet: {
			type: "http",
			chainType: "l1",
			chainId: 16_661,
			url: "https://evmrpc.0g.ai",
			accounts: [envOrConfig("DEPLOY_PRIVATE_KEY")],
		},
	},
});
