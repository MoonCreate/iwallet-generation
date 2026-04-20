import { createAppKit } from "@reown/appkit/react";

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { zeroGMainnet, zeroGTestnet, localhost } from "@iwallet/chains";

// 1. Get projectId from https://dashboard.reown.com
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID ?? "";

// 2. Create a metadata object - optional
const metadata = {
  name: "iWallet",
  description: "AI-Native Smart Wallet with Policy Rules",
  url: "https://iwallet.dev",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

// 3. Set the networks — include localhost for local dev
const networks = [localhost, zeroGTestnet, zeroGMainnet];

// 4. Create Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true,
});

// 5. Create modal
createAppKit({
  adapters: [wagmiAdapter],
  networks: [localhost, zeroGTestnet, zeroGMainnet],
  projectId,
  metadata,
  features: {
    analytics: true,
  },
});
