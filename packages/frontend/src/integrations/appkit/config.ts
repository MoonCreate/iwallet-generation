import { createAppKit } from "@reown/appkit/react";

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { zeroGMainnet, zeroGTestnet } from "@iwallet/chains";

// 1. Get projectId from https://dashboard.reown.com
// If VITE_REOWN_PROJECT_ID is not set we fall back to a non-empty placeholder
// so AppKit doesn't bail out, then disable analytics below to avoid the
// 403s from Reown's project-config endpoint.
const projectId =
  import.meta.env.VITE_REOWN_PROJECT_ID || "00000000000000000000000000000000";

// 2. Create a metadata object - optional
const metadata = {
  name: "iWallet",
  description: "AI-Native Smart Wallet with Policy Rules",
  url: "https://iwallet.dev",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

// 3. Networks — testnet first so it's the default network on first connect.
//    Mainnet sits in the picker. Hardhat-localhost dropped now that the
//    factory is deployed on real 0G chains.
const networks = [zeroGTestnet, zeroGMainnet] as const;

// 4. Create Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  networks: [...networks],
  projectId,
  ssr: true,
});

// 5. Create modal
createAppKit({
  adapters: [wagmiAdapter],
  networks: [...networks],
  defaultNetwork: zeroGTestnet,
  projectId,
  metadata,
  themeMode: "dark",
  themeVariables: {
    "--apkt-accent": "#10b981",
    "--apkt-color-mix": "#02130f",
    "--apkt-color-mix-strength": 40,
    "--apkt-border-radius-master": "2px",
    "--w3m-accent": "#10b981",
    "--w3m-color-mix": "#02130f",
    "--w3m-color-mix-strength": 40,
    "--w3m-border-radius-master": "2px",
  } as any,
  features: {
    analytics: false,
  },
  chainImages: {
    [zeroGTestnet.id]:
      "https://cdn.prod.website-files.com/680b884d38733122a923739b/69de313618847214109e4795_webclip.png",
    [zeroGMainnet.id]: "https://chainscan.0g.ai/favicon.ico",
  },
});
