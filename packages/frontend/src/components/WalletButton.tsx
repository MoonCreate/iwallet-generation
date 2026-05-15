import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect } from "wagmi";
import { Wallet, LogOut } from "lucide-react";

export function WalletButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => open()}
          className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
        >
          <Wallet className="h-3.5 w-3.5" />
          {address.slice(0, 6)}…{address.slice(-4)}
        </button>
        <button
          onClick={() => disconnect()}
          className="rounded-lg border border-emerald-500/10 p-1.5 text-emerald-400/50 transition hover:text-red-400 hover:border-red-400/30"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => open()}
      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
    >
      <Wallet className="h-3.5 w-3.5" />
      Connect
    </button>
  );
}
