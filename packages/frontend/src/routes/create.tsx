import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Copy, Check, Plus, Wallet } from "lucide-react";
import { getIWalletMessage, deriveIWalletAddress } from "#/lib/derive";

export const Route = createFileRoute("/create")({ component: CreatePage });

interface DerivedWallet {
  index: number;
  address: `0x${string}`;
  signature: `0x${string}`;
}

function CreatePage() {
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [wallets, setWallets] = useState<DerivedWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  async function createWallet() {
    if (!isConnected) return;
    setLoading(true);
    try {
      const index = wallets.length;
      const message = getIWalletMessage(index);
      const signature = await signMessageAsync({ message: { raw: message } });
      const { address: iWalletAddr } = deriveIWalletAddress(signature);

      setWallets((prev) => [
        ...prev,
        { index, address: iWalletAddr, signature },
      ]);
    } catch (err) {
      console.error("Failed to derive iWallet:", err);
    } finally {
      setLoading(false);
    }
  }

  function copyAddress(addr: string, idx: number) {
    navigator.clipboard.writeText(addr);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Step 1</p>
        <h1 className="display-title mb-3 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          Create an iWallet
        </h1>
        <p className="mb-6 max-w-2xl text-base text-[var(--sea-ink-soft)]">
          Derive a deterministic sub-wallet from your master wallet. Each
          iWallet gets a unique address controlled by an AI agent, with
          policy rules you define.
        </p>

        {!isConnected ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center">
            <Wallet className="mx-auto mb-3 h-8 w-8 text-[var(--sea-ink-soft)]" />
            <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">
              Connect your wallet to get started.
            </p>
            <appkit-button />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(79,184,178,0.14)]">
                <Wallet className="h-4 w-4 text-[var(--lagoon)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--sea-ink-soft)]">
                  Master Wallet
                </p>
                <p className="font-mono text-sm text-[var(--sea-ink)]">
                  {address}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={createWallet}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {loading
                ? "Signing..."
                : `Create iWallet #${wallets.length}`}
            </button>
          </div>
        )}
      </section>

      {/* Derived wallets list */}
      {wallets.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold text-[var(--sea-ink)]">
            Your iWallets
          </h2>
          {wallets.map((w) => (
            <div
              key={w.index}
              className="island-shell flex items-center justify-between gap-3 rounded-xl p-4"
            >
              <div>
                <p className="text-xs font-semibold text-[var(--lagoon)]">
                  iWallet #{w.index}
                </p>
                <p className="font-mono text-sm text-[var(--sea-ink)]">
                  {w.address}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyAddress(w.address, w.index)}
                  className="rounded-lg p-2 text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)]"
                  title="Copy address"
                >
                  {copiedIdx === w.index ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <Link
                  to="/configure"
                  search={{ index: w.index, address: w.address, signature: w.signature }}
                  className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-3 py-1.5 text-xs font-semibold text-[var(--lagoon-deep)] no-underline transition hover:bg-[rgba(79,184,178,0.24)]"
                >
                  Configure Policy
                </Link>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
