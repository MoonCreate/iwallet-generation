import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount, useReadContract, useBalance } from "wagmi";
import { formatEther } from "viem";
import {
  Wallet,
  Shield,
  Activity,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import {
  POLICY_REGISTRY_ABI,
  POLICY_PROXY_ABI,
  getRegistryAddress,
} from "#/lib/contracts";
import { formatPolicy, type PolicyOnChain } from "#/lib/policy";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { isConnected, address, chainId } = useAccount();

  const registryAddress = getRegistryAddress(chainId);
  const registryReady =
    registryAddress && registryAddress !== "0x0";

  const { data: wallets, isLoading } = useReadContract({
    address: registryAddress as `0x${string}`,
    abi: POLICY_REGISTRY_ABI,
    functionName: "getWallets",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && !!registryReady },
  });

  if (!isConnected) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 text-center sm:p-8">
          <Wallet className="mx-auto mb-3 h-8 w-8 text-[var(--sea-ink-soft)]" />
          <p className="mb-4 text-[var(--sea-ink-soft)]">
            Connect your wallet to view your iWallets.
          </p>
          <appkit-button />
        </section>
      </main>
    );
  }

  if (!registryReady) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 text-center sm:p-8">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="text-[var(--sea-ink-soft)]">
            PolicyRegistry contract not deployed yet. Deploy contracts
            and update the address in <code>@iwallet/chains</code>.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-12">
      <section className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--sea-ink)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Manage your iWallets and monitor agent activity.
          </p>
        </div>
        <Link
          to="/create"
          className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-4 py-2 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:bg-[rgba(79,184,178,0.24)]"
        >
          + Create New
        </Link>
      </section>

      {isLoading ? (
        <div className="island-shell rounded-2xl p-8 text-center">
          <Activity className="mx-auto mb-2 h-6 w-6 animate-pulse text-[var(--lagoon)]" />
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Loading wallets...
          </p>
        </div>
      ) : !wallets || wallets.length === 0 ? (
        <div className="island-shell rounded-2xl p-8 text-center">
          <Wallet className="mx-auto mb-3 h-8 w-8 text-[var(--sea-ink-soft)]" />
          <p className="mb-4 text-[var(--sea-ink-soft)]">
            No iWallets found. Create one to get started.
          </p>
          <Link
            to="/create"
            className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:bg-[rgba(79,184,178,0.24)]"
          >
            Create iWallet
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {wallets.map((w, idx) => (
            <WalletCard
              key={idx}
              index={idx}
              proxy={w.proxy}
              agent={w.agent}
              active={w.active}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function WalletCard({
  index,
  proxy,
  agent,
  active,
}: {
  index: number;
  proxy: `0x${string}`;
  agent: `0x${string}`;
  active: boolean;
}) {
  const { data: balance } = useBalance({ address: proxy });
  const { data: policy } = useReadContract({
    address: proxy,
    abi: POLICY_PROXY_ABI,
    functionName: "getPolicy",
  });
  const { data: dailySpent } = useReadContract({
    address: proxy,
    abi: POLICY_PROXY_ABI,
    functionName: "getDailySpent",
  });
  const { data: isRevoked } = useReadContract({
    address: proxy,
    abi: POLICY_PROXY_ABI,
    functionName: "isRevoked",
  });

  const formatted = policy
    ? formatPolicy(policy as unknown as PolicyOnChain)
    : null;

  return (
    <div
      className={`island-shell rounded-2xl p-5 ${!active ? "opacity-60" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield
            className={`h-5 w-5 ${
              isRevoked
                ? "text-red-500"
                : active
                  ? "text-[var(--lagoon)]"
                  : "text-gray-400"
            }`}
          />
          <span className="text-sm font-semibold text-[var(--sea-ink)]">
            iWallet #{index}
          </span>
          {isRevoked && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Revoked
            </span>
          )}
          {!active && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              Inactive
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-[var(--lagoon)]">
          {balance ? `${formatEther(balance.value)} ETH` : "..."}
        </span>
      </div>

      <div className="mb-3 space-y-1 text-xs text-[var(--sea-ink-soft)]">
        <p>
          <span className="font-medium">Proxy:</span>{" "}
          <span className="font-mono">{proxy}</span>
        </p>
        <p>
          <span className="font-medium">Agent:</span>{" "}
          <span className="font-mono">{agent}</span>
        </p>
      </div>

      {formatted && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <PolicyBadge label="Daily Limit" value={formatted.dailyLimit} />
          <PolicyBadge
            label="Spent Today"
            value={
              dailySpent !== undefined
                ? `${formatEther(dailySpent as bigint)} ETH`
                : "..."
            }
          />
          <PolicyBadge label="Cooldown" value={formatted.cooldown} />
          <PolicyBadge label="Contracts" value={formatted.allowedContracts} />
          <PolicyBadge label="Expires" value={formatted.expires} />
        </div>
      )}

      <div className="flex gap-2">
        <Link
          to="/agent"
          search={{ proxy }}
          className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)] no-underline transition hover:bg-[rgba(79,184,178,0.24)]"
        >
          Open Agent
        </Link>
      </div>
    </div>
  );
}

function PolicyBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface)] px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--sea-ink-soft)]">
        {label}
      </p>
      <p className="text-xs font-semibold text-[var(--sea-ink)]">{value}</p>
    </div>
  );
}
