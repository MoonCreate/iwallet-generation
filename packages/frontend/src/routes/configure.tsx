import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";
import { Shield, Plus, X, Loader2 } from "lucide-react";
import { POLICY_REGISTRY_ABI, getRegistryAddress } from "#/lib/contracts";

interface ConfigureSearch {
  index?: number;
  address?: string;
  signature?: string;
}

export const Route = createFileRoute("/configure")({
  component: ConfigurePage,
  validateSearch: (search: Record<string, unknown>): ConfigureSearch => ({
    index: search.index !== undefined ? Number(search.index) : undefined,
    address: search.address as string | undefined,
    signature: search.signature as string | undefined,
  }),
});

function ConfigurePage() {
  const { index, address: agentAddress, signature } = Route.useSearch();
  const { isConnected, chainId } = useAccount();
  const navigate = useNavigate();

  const [dailyLimit, setDailyLimit] = useState("0.05");
  const [allowedContracts, setAllowedContracts] = useState<string[]>([]);
  const [newContract, setNewContract] = useState("");
  const [cooldown, setCooldown] = useState("0");
  const [expiryDays, setExpiryDays] = useState("30");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  function addContract() {
    const addr = newContract.trim();
    if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setAllowedContracts((prev) => [...prev, addr]);
      setNewContract("");
    }
  }

  function removeContract(idx: number) {
    setAllowedContracts((prev) => prev.filter((_, i) => i !== idx));
  }

  function deployProxy() {
    if (!agentAddress || !isConnected) return;

    const expiresAt =
      Number(expiryDays) > 0
        ? BigInt(
            Math.floor(Date.now() / 1000) +
              Number(expiryDays) * 24 * 3600
          )
        : 0n;

    const registryAddress = getRegistryAddress(chainId);
    if (!registryAddress || registryAddress === "0x0") {
      alert(
        "PolicyRegistry not deployed yet. Deploy contracts first, then set VITE_REGISTRY_ADDRESS in .env."
      );
      return;
    }

    writeContract({
      address: registryAddress,
      abi: POLICY_REGISTRY_ABI,
      functionName: "createWallet",
      args: [
        agentAddress as `0x${string}`,
        {
          dailySpendLimitETH: parseEther(dailyLimit),
          allowedTokens: [],
          allowedContracts: allowedContracts as `0x${string}`[],
          maxGasPerTx: 0n,
          cooldownSeconds: BigInt(cooldown),
          expiresAt,
        },
      ],
    });
  }

  if (!agentAddress) {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 text-center sm:p-8">
          <Shield className="mx-auto mb-3 h-8 w-8 text-[var(--sea-ink-soft)]" />
          <p className="mb-4 text-[var(--sea-ink-soft)]">
            No iWallet selected. Create one first.
          </p>
          <a
            href="/create"
            className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:bg-[rgba(79,184,178,0.24)]"
          >
            Go to Create
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Step 2</p>
        <h1 className="display-title mb-3 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          Configure Policy
        </h1>
        <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
          Set the on-chain rules for{" "}
          <span className="font-semibold text-[var(--lagoon)]">
            iWallet #{index}
          </span>{" "}
          <span className="font-mono text-xs">({agentAddress})</span>
        </p>

        <div className="space-y-5">
          {/* Daily Limit */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">
              Daily Spend Limit (ETH)
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]"
            />
            <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
              Maximum ETH the agent can spend in a 24-hour period.
            </p>
          </div>

          {/* Cooldown */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">
              Cooldown Between Transactions (seconds)
            </label>
            <input
              type="number"
              min="0"
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]"
            />
          </div>

          {/* Expiry */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">
              Agent Expiry (days from now, 0 = never)
            </label>
            <input
              type="number"
              min="0"
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]"
            />
          </div>

          {/* Allowed Contracts */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-[var(--sea-ink)]">
              Allowed Contracts (leave empty to allow all)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x..."
                value={newContract}
                onChange={(e) => setNewContract(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]"
              />
              <button
                type="button"
                onClick={addContract}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 transition hover:bg-[var(--link-bg-hover)]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {allowedContracts.length > 0 && (
              <div className="mt-2 space-y-1">
                {allowedContracts.map((addr, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg bg-[var(--surface)] px-3 py-1.5"
                  >
                    <span className="flex-1 truncate font-mono text-xs text-[var(--sea-ink)]">
                      {addr}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeContract(idx)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deploy */}
          <div className="border-t border-[var(--line)] pt-5">
            {isSuccess ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                <p className="mb-2 font-semibold text-green-800">
                  PolicyProxy deployed successfully!
                </p>
                <p className="mb-3 text-xs text-green-600">
                  Transaction: {txHash}
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/dashboard" })}
                  className="rounded-full border border-green-300 bg-green-100 px-5 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-200"
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={deployProxy}
                disabled={isPending || isConfirming || !isConnected}
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-6 py-3 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)] disabled:opacity-50"
              >
                {(isPending || isConfirming) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {isPending
                  ? "Confirm in Wallet..."
                  : isConfirming
                    ? "Deploying..."
                    : "Deploy PolicyProxy & Activate"}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
